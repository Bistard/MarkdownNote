import { Disposable, IDisposable } from "src/base/common/dispose";
import { ErrorHandler } from "src/base/common/error";
import { Emitter, Register } from "src/base/common/event";
import { Arrays } from "src/base/common/utilities/array";
import { panic } from "src/base/common/utilities/panic";
import { Callable, isNullable, isNumber, isString, Mutable } from "src/base/common/utilities/type";

export interface IAction extends IDisposable {
    /** 
     * The ID of the action.
     */
    readonly id: string;
    
    /**
     * The tips fo the action (description).
     */
    readonly tip?: string;

    /**
     * If the action is enabled.
     */
    enabled: boolean;
    
    /**
     * Try to run the action if enabled.
     * @param args The arguments passed for the action.
     */
    run(args?: any): unknown;
}

/**
 * Options for constructing an {@link Action}.
 */
export interface IActionOptions {
    readonly id: string;
    readonly enabled: boolean;
    readonly tip?: string;
    /**
     * Any context will be passed as this function first argument.
     */
    readonly callback: Callable<any[], any>;
}

/**
 * @class An {@link Action} is more lightweight, flexible than a {@link Command}.
 * Essentially acts like a wrapper over a callback.
 */
export class Action implements IAction {

    // [fields]

    public readonly id: string;
    public readonly tip?: string;
    public enabled: boolean;
    
    private readonly _callback: Callable<any[], any>;
    
    // [constructor]

    constructor(opts: IActionOptions) {
        this.id = opts.id;
        this.enabled = opts.enabled;
        this._callback = opts.callback;
    }

    // [public methods]

    public run(...args: any): void {
        if (this.enabled) {
            this._callback(...args);
        }
    }

    public dispose(): void {
        // noop
    }
}

export interface IActionRunEvent {
    readonly action: IAction;
    readonly error?: Error;
}

/**
 * An interface only for {@link ActionList}.
 */
export interface IActionList<TAction extends IAction, TItem extends IActionListItem> extends IDisposable {
    
    onDidInsert: Register<TItem[]>;
    onBeforeRun: Register<IActionRunEvent>;
    onDidRun: Register<IActionRunEvent>;

    run(index: number): void;
    run(id: string): void;
    run(action: IAction): void;
    run(arg: IAction | number | string): void;

    get(index: number): IAction | undefined;
    get(id: string): IAction | undefined;
    get(arg: number | string): IAction | undefined;
    
    has(id: string): boolean;
    has(action: IAction): boolean;
    has(arg: IAction | string): boolean;
    
    insert(action: IAction[], index?: number): void;
    insert(action: IAction, index?: number): void;
    insert(arg: IAction | IAction[], index?: number): void;
    
    delete(index: number): boolean;
    delete(id: string): boolean;
    delete(action: IAction): boolean;
    delete(arg: IAction | number | string): boolean;

    size(): number;
    empty(): boolean;

    /**
     * @description Add a new action item provider to construct the actions.
     * @note When constructing items, the latest added {@link IActionItemProvider} 
     * will be tried first.
     */
    addActionItemProvider(provider: IActionItemProvider<TAction, TItem>): void;
}

/**
 * Interface for {@link ActionListItem}.
 */
export interface IActionListItem extends IDisposable {
    readonly action: IAction;
    run(context: unknown): void;
}

/**
 * @class A wrapper that wraps over a {@link IAction} so that it can be stored
 * inside a {@link ActionList}. 
 * @note The item owns the {@link IAction} (shares the lifecycle).
 */
export class ActionListItem extends Disposable implements IActionListItem {

    // [fields]

    public readonly action: IAction;

    // [constructor]

    constructor(action: IAction) {
        super();
        this.action = this.__register(action);
    }

    // [public methods]

    public run(context: unknown): void {
        this.action.run(context);
    }
}

/**
 * Retrieve the latest context.
 */
export interface IContextProvider {
    (): unknown;
}

/**
 * If the provider cannot construct an item for the given action, returns 
 * undefined.
 */
export interface IActionItemProvider<TAction extends IAction, TItem extends IActionListItem> {
    (action: TAction): TItem | undefined;
}

/**
 * Construction options for {@link ActionList}.
 */
export interface IActionListOptions<TAction extends IAction, TItem extends IActionListItem> {
    
    /**
     * A callback that always return the latest context of the current 
     * {@link ActionList}. It will be the global context with respects to all 
     * the stored {@link IActionListItem}s.
     */
    readonly contextProvider: IContextProvider;

    /**
     * A list of providers that defines how to construct an action item. When
     * constructing an action item, the {@link ActionList} will loop over every 
     * provider until the action item can be constructed from one of them.
     */
    readonly actionItemProviders?: IActionItemProvider<TAction, TItem>[];

    /**
     * Optional {@link ActionRunner} that provided by the client. Able to share 
     * {@link IActionRunEvent}s across different {@link ActionList}s.
     */
    readonly actionRunner?: ActionRunner;
}

/**
 * @class An abstraction container that contains a list of {@link IAction}s 
 * using wrapper {@link TItem}.
 * 
 * @note The client may run the given {@link IAction} by given certain context.
 * @note The {@link TItem} shares the same lifetime as the action list.
 */
export abstract class ActionList<TAction extends IAction, TItem extends IActionListItem> extends Disposable implements IActionList<TAction, TItem> {

    // [fields]

    protected readonly _items: TItem[];
    protected readonly _contextProvider: IContextProvider;
    protected readonly _actionRunner: ActionRunner;
    
    private readonly _itemProviders: IActionItemProvider<TAction, TItem>[];
    
    // [event]

    private readonly _onDidInsert = this.__register(new Emitter<TItem[]>());
    public readonly onDidInsert = this._onDidInsert.registerListener;
    
    public readonly onBeforeRun: Register<IActionRunEvent>;
    public readonly onDidRun: Register<IActionRunEvent>;

    // [constructor]

    constructor(opts: IActionListOptions<TAction, TItem>) {
        super();
        this._items = [];
        this._contextProvider = opts.contextProvider;
        this._itemProviders = [...(opts.actionItemProviders ?? [])];
        
        this._actionRunner = this.__register(opts.actionRunner ?? new ActionRunner());
        this.onBeforeRun = this._actionRunner.onBeforeRun;
        this.onDidRun = this._actionRunner.onDidRun;
        
        // WARN: do not access the context at the construction stage
    }

    // [public methods]

    public addActionItemProvider(provider: IActionItemProvider<TAction, TItem>): void {
        this._itemProviders.push(provider);
    }

    public run(index: number): void;
    public run(action: IAction): void;
    public run(id: string): void;
    public run(arg: IAction | number | string): void {
        const ctx = this._contextProvider();
        
        let action: IAction | undefined;

        if (isNumber(arg)) {
            action = this._items[arg]?.action;
        } else {
            const id = isString(arg) ? arg : arg.id;
            action = this.get(id);
        }

        if (!action || !action.enabled) {
            return;
        }

        (async () => {
            this._actionRunner.run(action, ctx);
        })();
    }

    public get(index: number): IAction | undefined;
    public get(id: string): IAction | undefined;
    public get(arg: number | string): IAction | undefined {
        if (isNumber(arg)) {
            return this._items[arg]?.action;
        }
        for (const curr of this._items) {
            if (curr.action.id === arg) {
                return curr.action;
            }
        }
        return undefined;
    }
    
    public has(id: string): boolean;
    public has(action: IAction): boolean;
    public has(arg: IAction | string): boolean {
        const id = isString(arg) ? arg : arg.id;
        for (const curr of this._items) {
            if (curr.action.id === id) {
                return true;
            }
        }
        return false;
    }

    public insert(arg: TAction, index?: number): void;
    public insert(arg: TAction[], index?: number): void;
    public insert(arg: TAction | TAction[], index?: number): void {
        const actions = Array.isArray(arg) ? [...arg] : [arg];
        const items: TItem[] = [];

        for (const action of actions) {
            let item: TItem | undefined;

            Arrays.reverseIterate(this._itemProviders, (provider) => {
                item = provider(action);
                if (item) {
                    return true;
                }

                return false;
            });
            
            if (!item) {
                panic(`Action list cannot create item with action id '${action.id}'`);
            }

            items.push(this.__register(item));
        
            if (isNullable(index)) {
                this._items.push(item);
                continue;
            }

            this._items.splice(index, 0, item);
            index++;
        }

        /**
         * Tells the client we just created the item and let them do 
         * whatever they need to do.
         */
        this._onDidInsert.fire(items);
    }

    public delete(index: number): boolean;
    public delete(id: string): boolean;
    public delete(action: IAction): boolean;
    public delete(arg: IAction | number | string): boolean {
        if (isNumber(arg)) {
            const deleted = this._items.splice(arg, 1);
            return !!deleted.length;
        }

        const id = isString(arg) ? arg : arg.id;
        for (let i = 0; i < this._items.length; i++) {
            const item = this._items[i]!;
            if (item.action.id === id) {
                this._items.splice(i, 1);
                return true;
            }
        }
        
        return false;
    }

    public size(): number {
        return this._items.length;
    }

    public empty(): boolean {
        return !this._items.length;
    }

    public override dispose(): void {
        super.dispose();
        this._items.forEach(item => item.dispose());
        (<Mutable<TItem[]>>this._items) = [];
    }
}

/**
 * @class A very simple wrapper class that wraps {@link IActionRunEvent}s. This
 * enables sharing the {@link IActionRunEvent} across multiple {@link IActionList}s.
 */
export class ActionRunner extends Disposable {

    // [event]

    private readonly _onBeforeRun = this.__register(new Emitter<IActionRunEvent>());
    public readonly onBeforeRun = this._onBeforeRun.registerListener;

    private readonly _onDidRun = this.__register(new Emitter<IActionRunEvent>());
    public readonly onDidRun = this._onDidRun.registerListener;

    // [constructor]

    constructor() {
        super();
    }

    // [public method]

    public async run(action: IAction, context: unknown): Promise<void> {
        this._onBeforeRun.fire({ action: action });
            
        let err: Error | undefined;
        try {
            await action.run(context);
        } catch (error: any) {
            err = error;
            ErrorHandler.onUnexpectedError(err);
        }

        this._onDidRun.fire({ action: action, error: err });
    }
}