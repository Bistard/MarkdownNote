import "src/base/browser/basic/menu/menu.scss";
import { FocusTracker } from "src/base/browser/basic/focusTracker";
import { CheckMenuItem, IMenuAction, IMenuItem, MenuAction, MenuItemType, MenuSeparatorItem as MenuSeparatorItem, SimpleMenuItem, SubmenuItem } from "src/base/browser/basic/menu/menuItem";
import { ActionList, ActionRunner, IAction, IActionItemProvider, IActionList, IActionListOptions, IActionRunEvent } from "src/base/common/action";
import { addDisposableListener, DirectionX, DomEventHandler, DomUtility, EventType } from "src/base/browser/basic/dom";
import { Emitter, Register } from "src/base/common/event";
import { createStandardKeyboardEvent, IStandardKeyboardEvent, KeyCode } from "src/base/common/keyboard";
import { Constructor, Mutable, isNullable } from "src/base/common/utilities/type";
import { IDimension, IDomBox, IPosition } from "src/base/common/utilities/size";
import { AnchorMode, calcViewPositionAlongAxis } from "src/base/browser/basic/view";
import { AnchorAbstractPosition } from "src/base/browser/basic/view";
import { Disposable, LooseDisposableBucket } from "src/base/common/dispose";
import { FastElement } from "src/base/browser/basic/fastElement";
import { panic } from "src/base/common/utilities/panic";

// region - interface

export interface IMenuActionRunEvent extends IActionRunEvent {
    readonly action: IMenuAction;
}

/**
 * An interface only for {@link BaseMenu}.
 */
export interface IMenu extends IActionList<MenuAction, IMenuItem> {

    /**
     * The HTMLElement of the {@link IMenu}.
     */
    readonly element: HTMLElement;

    /**
     * The {@link ActionRunner} of the {@link IMenu}.
     */
    readonly actionRunner: ActionRunner;

    /**
     * Fires when any menu actions before gets actually run.
     */
    readonly onBeforeRun: Register<IMenuActionRunEvent>;
    
    /**
     * Fires when any menu actions run completed.
     */
    readonly onDidRun: Register<IMenuActionRunEvent>;
    
    /**
     * Fires when the menu is blurred.
     */
    readonly onDidBlur: Register<FocusEvent>;

    /**
     * Fires when the menu is closed.
     */
    readonly onDidClose: Register<void>;
    
    /**
     * @description Builds the menu.
     * @param actions The list of actions for building.
     * @throws An exception will be thrown if the menu was already built.
     */
    build(actions: IMenuAction[]): void;

    /**
     * @description Focus the item at the given index.
     * @param index The index of the item to be focused. If not provided, focus
     *              the first one. If index equals -1, only focus the entire 
     *              menu.
     * @note The index will NOT be recalculated to avoid the disabled items.
     */
    focus(index?: number): void;

    /**
     * @description If the menu has any focused item.
     */
    anyFocused(): boolean;

    /**
     * @description The index of the current focused item, -1 means none.
     */
    getCurrFocusIndex(): number;

    /**
     * @description Returns the current context of the {@link IMenu}.
     */
    getContext(): unknown;
}

/**
 * Interface for {@link BaseMenu} construction.
 */
export interface IMenuOptions extends IActionListOptions<IMenuAction, IMenuItem> {
    
    /**
     * A list of possible trigger keys to determine which keys can execute the 
     * current focused item.
     * @default [KeyCode.Enter, KeyCode.Space]
     */
    readonly triggerKeys?: KeyCode[];
}

// region - BaseMenu

/**
 * @class A {@link BaseMenu} is build on top of {@link ActionList}, provides a 
 * UI-related component that represents a 'menu list'. Each {@link IMenuAction} 
 * will be bind to a UI-related item named {@link IMenuItem}.
 * 
 * @note The {@link BaseMenu} do not handle the concrete construction of each
 * {@link IMenuItem}. Instead, the inheritance should handle it.
 */
export abstract class BaseMenu extends ActionList<MenuAction, IMenuItem> implements IMenu {

    // [fields]

    public static readonly CLASS_NAME = 'menu';

    private readonly _element: HTMLElement;
    declare protected readonly _items: IMenuItem[];
    
    private readonly _focusTracker: FocusTracker;
    private _currFocusedIndex: number; // index, -1 means no focused items.

    private _built = false;

    /** an array of key pressings to trigger the current focused item. */
    private readonly _triggerKeys: KeyCode[];

    // [events]

    private readonly _onDidBlur = this.__register(new Emitter<FocusEvent>());
    public readonly onDidBlur = this._onDidBlur.registerListener;

    private readonly _onDidClose = this.__register(new Emitter<void>());
    public readonly onDidClose = this._onDidClose.registerListener;

    declare public readonly onBeforeRun: Register<IMenuActionRunEvent>;
    declare public readonly onDidRun: Register<IMenuActionRunEvent>;

    // [constructor]

    constructor(container: HTMLElement, opts: IMenuOptions) {
        super(opts);

        this._element = document.createElement('div');
        this._element.className = BaseMenu.CLASS_NAME;
        
        // TODO: move into ThemeService
        {
            this._element.style.setProperty('--menu-item-height', '30px');
        }

        this._currFocusedIndex = -1;
        this._triggerKeys = opts.triggerKeys ?? [KeyCode.Enter, KeyCode.Space];
        this._focusTracker = this.__register(new FocusTracker(this._element, true));
        
        this.__registerListeners();

        // actual render
        container.appendChild(this._element);
    }
    
    // [public methods]

    get element(): HTMLElement {
        return this._element;
    }

    get actionRunner(): ActionRunner {
        return this._actionRunner;
    }

    public getContext(): unknown {
        return this._contextProvider();
    }

    public build(actions: MenuAction[]): void {
        if (this._built) {
            panic('Menu cannot build twice.');
        }
        this.insert(actions);
        this._built = true;
    }

    public focus(index?: number): void {
        
        if (isNullable(index)) {
            index = 0;
        }

        if (index === -1) {
            this.__unfocusTheCurrentItem();
            this._element.focus();
            return;
        }

        if (index < 0 || index >= this._items.length) {
            return;
        }

        this.__focusItemAt(index);
    }

    public anyFocused(): boolean {
        return this.__hasAnyFocused();
    }

    public getCurrFocusIndex(): number {
        return this._currFocusedIndex;
    }

    public override dispose(): void {
        super.dispose();
    }

    // [private helper methods]

    private __registerListeners(): void {
        
        // Renders the item after every insertion operation.
        this.__register(this.onDidInsert(items => {
            
            const fragment = <HTMLElement><unknown>document.createDocumentFragment();
            items.forEach((item, index) => {

                // bind the item running environment to the action list
                item.actionRunner = this.run.bind(this);
                
                // render the item
                item.render(fragment);

                // focus when hovering
                this.__register(item.onDidHover(e => {
                    if (e.hovering && item.action.enabled) {
                        this.focus(index);
                    } else {
                        this.focus(-1);
                    }
                }));
            });
            
            // rendering the whole fragment at once for performance
            this._element.appendChild(fragment);
            
            // re-focus
            if (this.__hasAnyFocused()) {
                this.focus(this.getCurrFocusIndex());
            }
        }));

        // Blur event
        this.__register(this._focusTracker.onDidBlur(e => {
            const activeNode = DomUtility.Elements.getActiveElement();
            
            /**
             * There can be situations where the blur event is fired for the 
             * current node, but the new active element is a child element 
             * within the current node.
             */
            if (!(activeNode === this._element || !DomUtility.Elements.isAncestor(this._element, activeNode))) {
                return;
            }

            this._currFocusedIndex = -1;
            this._onDidBlur.fire(e);
        }));

        // Keydown event
        this.__register(addDisposableListener(this._element, EventType.keydown, (e) => {
            const event = createStandardKeyboardEvent(e);
            let eventHandled = true;

            switch (event.key) {
                case KeyCode.Escape: {
                    this._onDidClose.fire();
                    break;
                }
                case KeyCode.Home: {
                    this.focus(0);
                    break;
                }
                case KeyCode.End: {
                    this.focus(this._items.length - 1);
                    break;
                }
                case KeyCode.UpArrow: {
                    this.__focusPrev();
                    break;
                }
                case KeyCode.DownArrow: {
                    this.__focusNext();
                    break;
                }
                default:
                    eventHandled = false;
                    break;
            }

            if (eventHandled) {
                event.preventDefault();
                event.stopPropagation();
            }
        }));

        // Keyup event
        this.__register(addDisposableListener(this._element, EventType.keyup, (e) => {
            const event = createStandardKeyboardEvent(e);
            const item = this._items[this._currFocusedIndex];
            
            // not enabled
            if (!item?.action.enabled) {
                return;
            }

            // try to run the current focused item
            if (this.__isTriggerKeys(event) && this.__hasAnyFocused()) {
                this.run(this._currFocusedIndex);
                event.preventDefault();
                event.stopPropagation();
            }
        }));
    }

    private __focusPrev(): void {
        this.__focusByOffset(-1);
    }

    private __focusNext(): void {
        this.__focusByOffset(1);
    }

    private __focusByOffset(offset: -1 | 1): void {
        if (this._items.length === 0) {
            return;
        }
        
        if (!this.__hasAnyFocused()) {
            this.__focusItemAt(0);
            return;
        }

        if (this._currFocusedIndex === 0 && this._items.length === 1) {
            return;
        }

        let actualIndex = this._currFocusedIndex;
        let actualItem: IMenuItem;
        do {
            actualIndex = ((actualIndex + offset) + this._items.length) % this._items.length;
            actualItem = this._items[actualIndex]!;
        } 
        while (!actualItem.action.enabled);

        this.__focusItemAt(actualIndex);
    }

    private __focusItemAt(newIndex: number): void {
        const item = this._items[newIndex];
        if (!item) {
            this._element.focus({ preventScroll: true });
            return;
        }
        
        this.__unfocusTheCurrentItem();

        this._currFocusedIndex = newIndex;
        item.focus();
    }

    private __hasAnyFocused(): boolean {
        return this._currFocusedIndex !== -1;
    }

    private __unfocusTheCurrentItem(): void {
        const prevFocusItem = this._items[this._currFocusedIndex];
        prevFocusItem?.blur();
        this._currFocusedIndex = -1;
    }

    private __isTriggerKeys(event: IStandardKeyboardEvent): boolean {
        return this._triggerKeys.findIndex(key => key === event.key) !== -1;
    }
}

// region - Menu

/**
 * @class A basic implementation over {@link BaseMenu}.
 */
export class Menu extends BaseMenu {

    constructor(container: HTMLElement, opts: IMenuOptions) {
        super(container, opts);
        this.addActionItemProvider((action: MenuAction) => {
            if (action.type === MenuItemType.Separator) {
                return new MenuSeparatorItem(action);
            }
    
            else if (action.type === MenuItemType.General) {
                return new SimpleMenuItem(action);
            }

            else if (action.type === MenuItemType.Check) {
                return new CheckMenuItem(action);
            }
    
            return undefined;
        });
    }
}

// region - MenuDecorator

export abstract class MenuDecorator extends Disposable implements IMenu {

    // [fields]

    protected readonly _menu: IMenu;

    // [events]

    public readonly onDidInsert: Register<IMenuItem[]>;
    public readonly onBeforeRun: Register<IMenuActionRunEvent>;
    public readonly onDidRun: Register<IMenuActionRunEvent>;
    public readonly onDidBlur: Register<FocusEvent>;
    public readonly onDidClose: Register<void>;

    // [constructor]

    constructor(menu: IMenu) {
        super();
        this._menu = this.__register(menu);
        this.onDidInsert = this._menu.onDidInsert;
        this.onBeforeRun = this._menu.onBeforeRun;
        this.onDidRun = this._menu.onDidRun;
        this.onDidBlur = this._menu.onDidBlur;
        this.onDidClose = this._menu.onDidClose;
    }

    // [public methods]

    get element(): HTMLElement {
        return this._menu.element;
    }

    get actionRunner(): ActionRunner {
        return this._menu.actionRunner;
    }

    public getContext(): unknown {
        return this._menu.getContext();
    }

    public build(actions: MenuAction[]): void {
        this._menu.build(actions);
    }

    public addActionItemProvider(provider: IActionItemProvider<MenuAction, IMenuItem>): void {
        this._menu.addActionItemProvider(provider);
    }

    public focus(index?: number | undefined): void {
        this._menu.focus(index);
    }

    public anyFocused(): boolean {
        return this._menu.anyFocused();
    }

    public getCurrFocusIndex(): number {
        return this._menu.getCurrFocusIndex();
    }

    public run(index: number): void;
    public run(action: IAction): void;
    public run(id: string): void;
    public run(arg: IAction | number | string): void {
        this._menu.run(arg);
    }

    public get(index: number): IAction | undefined;
    public get(id: string): IAction | undefined;
    public get(arg: string | number): IAction | undefined {    
        return this._menu.get(arg);
    }

    public has(id: string): boolean;
    public has(action: IAction): boolean;
    public has(arg: string | IAction): boolean {
        return this._menu.has(arg);
    }

    public insert(action: IAction[], index?: number | undefined): void;
    public insert(action: IAction, index?: number | undefined): void;
    public insert(arg: IAction | IAction[], index?: number | undefined): void {
        this._menu.insert(arg, index);
    }

    public delete(index: number): boolean;
    public delete(id: string): boolean;
    public delete(action: IAction): boolean;
    public delete(arg: string | number | IAction): boolean {
        return this._menu.delete(arg);
    }

    public empty(): boolean {
        return this._menu.empty();
    }

    public size(): number {
        return this._menu.size();
    }
}

// region - MenuWithSubmenu

/**
 * @class With additional to {@link Menu}, the class supports to construct a
 * submenu also with interface {@link IMenu}.
 */
export class MenuWithSubmenu extends MenuDecorator {

    // [field]

    private readonly _submenuCtor: Constructor<MenuDecorator>;

    private _submenuContainer?: FastElement<HTMLElement>;
    private _submenu?: IMenu;
    private readonly _submenuLifecycle: LooseDisposableBucket;

    // [constructor]

    constructor(menu: IMenu, submenuCtor: Constructor<MenuDecorator> = MenuWithSubmenu) {
        super(menu);
        this._submenuCtor = submenuCtor;
        this._submenuLifecycle = this.__register(new LooseDisposableBucket());

        this._menu.addActionItemProvider((action: MenuAction) => {
            if (action.type === MenuItemType.Submenu) {
                
                const item = new SubmenuItem(action, {
                    closeCurrSubmenu: this.__closeCurrSubmenu.bind(this),
                    openNewSubmenu: this.__openNewSubmenu.bind(this),
                    isSubmenuActive: () => !!this._submenu,
                    focusParentMenu: this.__focusParentMenu.bind(this),
                });

                // bind the item-run to the action-run.
                action.onRun = item.run.bind(item);

                return item;
            }
            return undefined;
        });
    }

    // [public methods]

    public override dispose(): void {
        super.dispose();
        this.__closeCurrSubmenu();
    }

    // [private helper methods]

    private __closeCurrSubmenu(): void {
        this.release(this._submenu);
        this._submenu = undefined;

        this.release(this._submenuContainer);
        this._submenuContainer = undefined;
        
        this.release(this._submenuLifecycle);
    }

    private __openNewSubmenu(anchor: HTMLElement, actions: IMenuAction[]): void {
        
        /**
         * If there is already a submenu, we simply focus it instead of recreate 
         * it.
         */
        if (this._submenu) {
            this._submenu.focus(-1);
            return;
        }

        this.__constructSubmenu(anchor, actions);
        this.__submenuEventRegistration();
    }

    private __constructSubmenu(anchor: HTMLElement, actions: IMenuAction[]): void {
        const submenuContainer = this.__register(new FastElement(document.createElement('div')));
        this._submenuContainer = submenuContainer;
        
        anchor.appendChild(submenuContainer.raw);
        {
            submenuContainer.addClassList('context-menu');
            submenuContainer.setPosition('fixed');
            submenuContainer.setZIndex(0);
            submenuContainer.setTop(0);
            submenuContainer.setLeft(0);
        }
        const parentMenuTop = parseFloat(this.element.style.paddingTop || '0') || 0;

        this._submenu = this.__register(
            new this._submenuCtor(
                new Menu(this._submenuContainer.raw, {
                    contextProvider: this._menu.getContext.bind(this._menu),
                    /** shares the same {@link IActionRunEvent} with the parent menu */
                    actionRunner: this._menu.actionRunner,
                })
            )
        );
        
        this._submenu.build(actions);
        this._submenu.focus(-1);
        
        const rawAnchorBox = anchor.getBoundingClientRect();
        const anchorBox = {
            /**
             * The inner top of the submenu row to the parent menu.
             */
            top: rawAnchorBox.top - parentMenuTop,
            left: rawAnchorBox.left,
            height: rawAnchorBox.height + 2 * parentMenuTop,
            width: rawAnchorBox.width,
        };
        
        const submenuBox = submenuContainer.raw.getBoundingClientRect();
        const { top, left } = this.__calculateSubmenuPosition(
            { width: submenuBox.width, height: submenuBox.height },
            anchorBox,
            DirectionX.Right,
        );

        this._submenuContainer.setLeft(left - submenuBox.left);
        this._submenuContainer.setTop(top - submenuBox.top);
    }

    private __calculateSubmenuPosition(submenu: IDimension, entry: IDomBox, expandDir: DirectionX): IPosition {
        let top = 0;
        let left = 0;

        const win = {
            width: window.innerWidth,
            height: window.innerHeight,
        };

        left = calcViewPositionAlongAxis(win.width, submenu.width, {
            direction: expandDir === DirectionX.Right ? AnchorAbstractPosition.Before : AnchorAbstractPosition.After, 
            offset: entry.left, 
            size: entry.width,
            mode: AnchorMode.Avoid,
        });

        if (left >= entry.left && left < entry.left + entry.width) {
			if (entry.left + 10 + submenu.width <= win.width) {
				left = entry.left + 10;
			}

			(<Mutable<number>>entry.top) += 10;
			(<Mutable<number>>entry.height) = 0;
		}

        top = calcViewPositionAlongAxis(win.height, submenu.height, { 
            direction: AnchorAbstractPosition.Before, 
            offset: entry.top, 
            size: 0,
            mode: AnchorMode.Avoid,
        });

		if (top + submenu.height === entry.top && top + entry.height + submenu.height <= win.height) {
			top += entry.height;
		}

        return { top, left };
    }

    private __submenuEventRegistration(): void {
        if (!this._submenuContainer || !this._submenu) {
            return;
        }

        // key-down
        this._submenuLifecycle.register(this._submenuContainer.onKeydown((e) => {
            const event = createStandardKeyboardEvent(e);

            // left-arrow
            if (event.key === KeyCode.LeftArrow) {
                DomEventHandler.stop(event, true);
            }
        }));

        // key-up
        this._submenuLifecycle.register(this._submenuContainer.onKeyup((e) => {
            const event = createStandardKeyboardEvent(e);
            
            // left-arrow
            if (event.key === KeyCode.LeftArrow) {
                DomEventHandler.stop(event, true);
                this.__closeCurrSubmenu();
                this.__focusParentMenu();
            }
        }));

        // on-did-close
        this._submenuLifecycle.register(this._submenu.onDidClose(() => {
            this.__closeCurrSubmenu();
        }));
    }

    private __focusParentMenu(): void {
        
        /**
         * When focusing the parent menu making sure there is no existing 
         * focused item.
         */
        if (!this._menu.anyFocused()) {
            this._menu.focus(-1);
        } 
        /**
         * If there is, refocus the one to make sure the item is actually 
         * focused in the dom tree but in just in memory.
         */
        else {
            const currFocus = this._menu.getCurrFocusIndex();
            this._menu.focus(currFocus);
        }
    }
}