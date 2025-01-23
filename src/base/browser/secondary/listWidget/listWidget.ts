import { IListItemProvider } from "src/base/browser/secondary/listView/listItemProvider";
import { IListViewRenderer, PipelineRenderer } from "src/base/browser/secondary/listView/listRenderer";
import { IListViewOpts, IViewItemChangeEvent, ListView } from "src/base/browser/secondary/listView/listView";
import { IList } from "src/base/browser/secondary/listView/list";
import { IListDragAndDropProvider, IScrollOnEdgeOptions, ListWidgetDragAndDropController } from "src/base/browser/secondary/listWidget/listWidgetDragAndDrop";
import { ListWidgetKeyboardController } from "src/base/browser/secondary/listWidget/listWidgetKeyboardController";
import { ListWidgetMouseController } from "src/base/browser/secondary/listWidget/listWidgetMouseController";
import { ListTrait, ITraitChangeEvent } from "src/base/browser/secondary/listWidget/listWidgetTrait";
import { IIdentityProvider } from "src/base/browser/secondary/tree/asyncTree";
import { Disposable } from "src/base/common/dispose";
import { Event, Register } from "src/base/common/event";
import { createStandardKeyboardEvent, IStandardKeyboardEvent, KeyCode } from "src/base/common/keyboard";
import { memoize } from "src/base/common/memoization";
import { IRange } from "src/base/common/structures/range";
import { IScrollEvent } from "src/base/common/scrollable";
import { isNullable, isNumber, nullToUndefined } from "src/base/common/utilities/type";
import { panic } from "src/base/common/utilities/panic";
import { Arrays } from "src/base/common/utilities/array";
import { Numbers } from "src/base/common/utilities/number";

/**
 * A standard mouse event interface used in {@link IListWidget}. Clicking nothing 
 * returns undefined.
 */
export interface IListMouseEvent<T> {
    
    /** The original browser event. */
    browserEvent: MouseEvent;

    /** The rendering index of the clicked item. */
    renderIndex: number| undefined;

    /** The actual index of the clicked item. */
    actualIndex: number | undefined;

    /** The clicked item. */
    item: T | undefined;
}

/**
 * A standard touch event interface used in {@link ListWidget}. Touching nothing
 * returns undefined.
 */
export interface IListTouchEvent<T> {
    /** The original browser event. */
    browserEvent: TouchEvent;

    /** The rendering index of the touched item. */
    renderIndex: number| undefined;

    /** The actual index of the touched item. */
    actualIndex: number | undefined;

    /** The touched item. */
    item: T | undefined;
}

export interface IListDragEvent<T> {
    /** The original browser event {@link DragEvent}. */
    browserEvent: DragEvent;

    /** The actual index of the drag / dragover / drop item. */
    actualIndex: number | undefined;
    
    /** The drag / dragover / drop item. */
    item: T | undefined;
}

export interface IListContextmenuEvent<T> {
    /** The original browser UI event. */
    browserEvent: UIEvent;
    
    /** The rendering index of the target item. */
    renderIndex: number| undefined;

    /** The actual index of the target item. */
    actualIndex: number | undefined;

    /** The client data target of the event. */
	item: T | undefined;

    /** The browser position of the contextmenu event. */
	position: { x: number; y: number } | undefined;

    /** The browser target of the contextmenu if any. */
    target: HTMLElement | undefined;
}

/**
 * The interface for {@link ListWidget}.
 */
export interface IListWidget<T> extends IList<T>, Disposable {
    
    // [events / getter]
    
    /** Fires when the {@link IListWidget} is scrolling. */
    get onDidScroll(): Register<IScrollEvent>;
    
    /** 
     * Fires when the {@link IListWidget} itself is focused or blurred. 
     * True: focused
     * false: blurred
     */
    get onDidChangeFocus(): Register<boolean>;

    /** Fires when the focused items in the {@link IListWidget} is changed. */
    get onDidChangeItemFocus(): Register<ITraitChangeEvent>;

    /** Fires when the selected items in the {@link IListWidget} is changed. */
    get onDidChangeItemSelection(): Register<ITraitChangeEvent>;

    /** Fires when the hovered items in the {@link IListWidget} is changed. */
    get onDidChangeItemHover(): Register<ITraitChangeEvent>;

    /** Fires when the item in the {@link IListWidget} is clicked. */
    get onClick(): Register<IListMouseEvent<T>>;
    
    /** Fires when the item in the {@link IListWidget} is double clicked. */
    get onDoubleClick(): Register<IListMouseEvent<T>>;

    /** Fires when the item in the {@link IListWidget} is mouseovered. */
    get onMouseover(): Register<IListMouseEvent<T>>;

    /** Fires when the item in the {@link IListWidget} is mouseout. */
    get onMouseout(): Register<IListMouseEvent<T>>;
    
    /** Fires when the item in the {@link IListWidget} is mousedown. */
    get onMousedown(): Register<IListMouseEvent<T>>;
    
    /** Fires when the item in the {@link IListWidget} is mouseup. */
    get onMouseup(): Register<IListMouseEvent<T>>;

    /** Fires when the item in the {@link IListWidget} is mousemove. */
    get onMousemove(): Register<IListMouseEvent<T>>;

    /** 
     * An event sent when the state of contacts with a touch-sensitive surface 
     * changes. This surface can be a touch screen or trackpad.
     */
    get onTouchstart(): Register<IListTouchEvent<T>>;

    /** Fires when the {@link IListWidget} is keydown. */
    get onKeydown(): Register<IStandardKeyboardEvent>;

    /** Fires when the {@link IListWidget} is keyup. */
    get onKeyup(): Register<IStandardKeyboardEvent>;

    /** Fires when the {@link IListWidget} is keypress. */
    get onKeypress(): Register<IStandardKeyboardEvent>;

    /** 
     * Fires when the user attempts to open a context menu {@link IListWidget}. 
     * This event is typically triggered by:
     *      - clicking the right mouse button
     *      - pressing the context menu key
     *      - Shift F10
     */
    get onContextmenu(): Register<IListContextmenuEvent<T>>;

    // [item traits support]

    /**
     * @description Sets the item with the given index as the anchor.
     * @param index The provided index. If not provided, remove the current one.
     */
    setAnchor(index: number | null): void;

    /**
     * @description Sets the item with the given index as focused.
     * @param index The provided index. If not provided, remove the current one.
     */
    setFocus(index: number | null): void;

    /**
     * @description Sets the item with the given index as selected.
     * @param index The provided index. If empty provided, removes all the selections.
     */
    setSelections(index: number[]): void;

    /**
     * @description Sets the item with the given index as hovered.
     * @param index The provided index. If not provided, removes the current one.
     */
    setHover(index: number[]): void;

    /**
     * @description Returns all the indice of the selected items.
     */
    getSelections(): number[];

    /**
     * @description Returns the index of the anchor.
     * @note Anchor is where the user's selection start.
     */
    getAnchor(): number | null;

    /**
     * @description Returns the index of the focused item.
     * @note Focus is where the user's selection end.
     */
    getFocus(): number | null;

    /**
     * @description Returns all the indice of the hovered items.
     */
    getHover(): number[];

    /**
     * @description Returns all the selected items.
     */
    getSelectedItems(): T[];

    /**
     * @description Returns the anchor item.
     */
    getAnchorItem(): T | null;

    /**
     * @description Returns the focused item.
     */
    getFocusedItem(): T | null;

    /**
     * @description Returns all the hovered items.
     */
    getHoverItems(): T[];

    /**
     * @description Returns the height of the item in DOM.
     * @param index The index of the item.
     */
    getItemHeight(index: number): number;

    /**
     * @description Returns the DOM's position of the item with the given index
     * relatives to the viewport. If the item is not *entirely* visible in the 
     * viewport, -1 will be returned.
     * @param index The index of the item.
     */
    getItemRenderTop(index: number): number;

    /**
     * @description Respect to the current focused item, try to focus the first 
     * item forward by a given step `next` that matches the filter function.
     * @param next The step number. @default 1
     * @param fullLoop Do a full search on all the items. @default false
     * @param match The match function. If not provided, the next sibling will 
     * be matched.
     * @returns The index of the newly focused item. -1 if not found.
     */
    focusNext(next: number, fullLoop: boolean, match?: (item: T) => boolean): number;

    /**
     * @description Respect to the current focused item, try to focus the first 
     * item backward by a given step `prev` that matches the filter function.
     * @param prev The step number. @default 1
     * @param fullLoop Do a full search on all the items. @default false
     * @param match The match function. If not provided, the next sibling will 
     * be matched.
     * @returns The index of the newly focused item. -1 if not found.
     */
    focusPrev(prev: number, fullLoop: boolean, match?: (item: T) => boolean): number;
}

/**
 * The constructor options for {@link ListWidget}.
 */
export interface IListWidgetOpts<T> extends IListViewOpts {
    
    /** 
     * If allows mouse support. 
     * @default true
     */
    readonly mouseSupport?: boolean;

    /**
     * If allows multiple selection support.
     * @default true
     */
    readonly multiSelectionSupport?: boolean;

    /**
     * If allows keyboard support.
     * @default true
     */
    readonly keyboardSupport?: boolean;

    /**
     * If allows to auto-scroll when hovering on edges.
     * @default enabled
     */
    readonly scrollOnEdgeSupport?: IScrollOnEdgeOptions;

    /**
     * A provider that has ability to provide Drag and Drop Support (dnd).
     */
    readonly dragAndDropProvider?: IListDragAndDropProvider<T>;

    /**
     * Provides functionality to determine the uniqueness of each 
     * client-provided data.
     */
    readonly identityProvider?: IIdentityProvider<T>;
}

/**
 * @class A {@link ListWidget} is built on top of {@link ListView}, with more
 * friendly user interaction features.
 * 
 * The widget presets a list of behaviors on mouse / keyboard support. Such as
 * pressing SHIFT will able to multi-select in range, pressing escape key will
 * lose the current focus item and so on...
 * 
*  @note You may override the corresponding protected methods to customize the
 * behaviors.
 * 
 * Additional Functionalities:
 *  - mouse support (focus / selection, hover)
 *  - keyboard support (enter / up / down / page-up / page-down / escape)
 *  - drag and drop support
 */
export class ListWidget<T> extends Disposable implements IListWidget<T> {

    // [fields]

    private readonly view: ListView<T>;

    /** User's selection. */
    private readonly selected: ListTrait<T>;
    /** Where the user's selection start. */
    private readonly anchor: ListTrait<T>;
    /** Where the user's selection end. */
    private readonly focused: ListTrait<T>;
    /** Where the user's hover. */
    private readonly hovered: ListTrait<T>;

    private readonly identityProvider?: IIdentityProvider<T>;

    // [constructor]

    constructor(
        container: HTMLElement,
        renderers: IListViewRenderer<any, any>[],
        itemProvider: IListItemProvider<T>, 
        opts: IListWidgetOpts<T> = {}
    ) {
        super();
        
        // initializes all the item traits
        this.selected = this.__register(new ListTrait('selected'));
        this.anchor   = this.__register(new ListTrait('anchor'));
        this.focused  = this.__register(new ListTrait('focused'));
        this.hovered  = this.__register(new ListTrait('hovered'));
        this.identityProvider = opts.identityProvider;

        // integrates all the renderers (since `anchor` is invisible, no renderer needed)
        const baseRenderers = [this.selected.renderer, this.focused.renderer, this.hovered.renderer];
        renderers = renderers.map(renderer => new PipelineRenderer(renderer.type, [...baseRenderers, renderer]));
        
        // construct the list view
        this.view = this.__register(new ListView(container, renderers, itemProvider, opts));

        // mouse support integration (defaults on)
        if (opts.mouseSupport || opts.mouseSupport === undefined) {
            const mouseController = this.__createMouseController(opts);
            this.__register(mouseController);
        }
        
        // keyboard support integration
        if (opts.keyboardSupport || opts.mouseSupport === undefined) {
            const keyboardController = this.__createKeyboardController(opts);
            this.__register(keyboardController);
        }
        
        // drag and drop integration
        if (opts.dragAndDropProvider) {
            const dndController = this.__createDndController(opts);
            this.__register(dndController);
        }
    }

    // [getter / setter]

    get DOMElement(): HTMLElement { return this.view.DOMElement; }
    get listElement(): HTMLElement { return this.view.listElement; }
    get contentSize(): number { return this.view.contentSize; }
    
    get onDidScroll(): Register<IScrollEvent> { return this.view.onDidScroll; }
    get onDidChangeItemFocus(): Register<ITraitChangeEvent> { return this.focused.onDidChange; }
    get onDidChangeItemSelection(): Register<ITraitChangeEvent> { return this.selected.onDidChange; }
    get onDidChangeItemHover(): Register<ITraitChangeEvent> { return this.hovered.onDidChange; }
    get onInsertItemInDOM(): Register<IViewItemChangeEvent<T>> { return this.view.onInsertItemInDOM; }
    get onUpdateItemInDOM(): Register<IViewItemChangeEvent<T>> { return this.view.onUpdateItemInDOM; }
    get onRemoveItemInDOM(): Register<IViewItemChangeEvent<T>> { return this.view.onRemoveItemInDOM; }
    get onDidChangeFocus(): Register<boolean> { return Event.any([Event.map(this.view.onDidFocus, () => true), Event.map(this.view.onDidBlur, () => false)]); }
    
    get onClick(): Register<IListMouseEvent<T>> { return Event.map(this.view.onClick, e => this.__toListMouseEvent(e)); }
    get onDoubleClick(): Register<IListMouseEvent<T>> { return Event.map(this.view.onDoubleClick, e => this.__toListMouseEvent(e));  }
    get onMouseover(): Register<IListMouseEvent<T>> { return Event.map(this.view.onMouseover, e => this.__toListMouseEvent(e)); }
    get onMouseout(): Register<IListMouseEvent<T>> { return Event.map(this.view.onMouseout, e => this.__toListMouseEvent(e)); }
    get onMousedown(): Register<IListMouseEvent<T>> { return Event.map(this.view.onMousedown, e => this.__toListMouseEvent(e)); }
    get onMouseup(): Register<IListMouseEvent<T>> { return Event.map(this.view.onMouseup, e => this.__toListMouseEvent(e)); }
    get onMousemove(): Register<IListMouseEvent<T>> { return Event.map(this.view.onMousemove, e => this.__toListMouseEvent(e)); }
    get onTouchstart(): Register<IListTouchEvent<T>> { return Event.map(this.view.onTouchstart, e => this.__toListTouchEvent(e)); }

    get onKeydown(): Register<IStandardKeyboardEvent> { return Event.map(this.view.onKeydown, e => createStandardKeyboardEvent(e)); }
    get onKeyup(): Register<IStandardKeyboardEvent> { return Event.map(this.view.onKeyup, e => createStandardKeyboardEvent(e)); }
    get onKeypress(): Register<IStandardKeyboardEvent> { return Event.map(this.view.onKeypress, e => createStandardKeyboardEvent(e)); }
    @memoize 
    get onContextmenu(): Register<IListContextmenuEvent<T>> { return this.__createContextmenuRegister(); }

    // [methods]

    public layout(height?: number): void {
        this.view.layout(height);
    }

    public rerender(): void {
        this.view.rerender();
    }

    public splice(index: number, deleteCount: number, items: T[] = []): void {
        if (deleteCount === 0 && items.length === 0) {
            return;
        }
        
        if (index < 0 || index > this.viewSize()) {
            panic(`splice invalid start index: ${index}`);
        }

        if (deleteCount < 0) {
            panic(`splice invalid deleteCount: ${deleteCount}`);
        }

        // traits react to splice
        this.__traitSplice(index, deleteCount, items);

        // actual view rendering
        this.view.splice(index, deleteCount, items);
    }

    public reveal(index: number, relativePositionPercentage?: number): void {
        this.view.reveal(index, relativePositionPercentage);
    }

    public setDomFocus(): void {
        this.view.setDomFocus();
    }

    public setViewportSize(size: number): void {
        this.view.setViewportSize(size);
    }

    public setScrollPosition(position: number): void {
        this.view.setScrollPosition(position);
    }

    public getViewportSize(): number {
        return this.view.getViewportSize();
    }

    public getScrollPosition(): number {
        return this.view.getScrollPosition();
    }

    public getVisibleRange(): IRange {
        return this.view.getVisibleRange();
    }

    public getItem(index: number): T {
        return this.view.getItem(index);
    }

    public getItemIndex(item: T): number {
        return this.view.getItemIndex(item);
    }

    public isItemVisible(index: number): boolean {
        return this.view.isItemVisible(index);
    }

    // [item traits support]

    public setAnchor(index: number | null): void {
        this.anchor.set((index !== null) ? [index] : []);
    }

    public setFocus(index: number | null): void {
        this.focused.set((index !== null) ? [index] : []);
    }

    public setSelections(indice: number[]): void {
        this.selected.set(indice);
    }

    public setHover(indice: number[]): void {
        this.hovered.set(indice);
    }

    public getSelections(): number[] {
        return this.selected.items();
    }
    
    public getAnchor(): number | null {
        const indice = this.anchor.items();
        return indice.length ? indice[0]! : null;
    }

    public getFocus(): number | null {
        const indice = this.focused.items();
        return indice.length ? indice[0]! : null;
    }

    public getHover(): number[] {
        return this.hovered.items();
    }

    public getSelectedItems(): T[] {
        const indice = this.selected.items();
        return indice.map(index => this.view.getItem(index));
    }

    public getAnchorItem(): T | null {
        const indice = this.anchor.items();
        return indice.length ? this.view.getItem(indice[0]!) : null;
    }

    public getFocusedItem(): T | null {
        const indice = this.focused.items();
        return indice.length ? this.view.getItem(indice[0]!) : null;
    }

    public getHoverItems(): T[] {
        const indice = this.hovered.items();
        return indice.map(index => this.view.getItem(index));
    }

    public getItemHeight(index: number): number {
        return this.view.getItemHeight(index);
    }

    public getItemRenderTop(index: number): number {
        return this.view.getItemRenderTop(index);
    }

    public focusNext(next: number = 1, fullLoop: boolean = false, match?: (item: T) => boolean): number {
        if (this.viewSize() === 0) {
            return -1;
        }

        const currFocused = this.focused.items();
        const indexFound = this.__findNextWithFilter(currFocused.length ? (currFocused[0]! + next) : 0, fullLoop, match);
        
        // founded
        if (indexFound !== -1) {
            this.focused.set([indexFound]);
        }

        return indexFound;
    }

    public focusPrev(prev: number = 1, fullLoop: boolean = false, match?: (item: T) => boolean): number {
        if (this.viewSize() === 0) {
            return -1;
        }

        const currFocused = this.focused.items();
        const indexFound = this.__findPrevWithFilter(currFocused.length ? (currFocused[0]! - prev) : 0, fullLoop, match);
        
        // founded
        if (indexFound !== -1) {
            this.focused.set([indexFound]);
        }

        return indexFound;
    }

    public viewSize(onlyVisible: boolean = false): number { 
        return this.view.viewSize(onlyVisible);
    }

    public getRenderIndex(actualIndex: number): number {
        return this.view.getRenderIndex(actualIndex);
    }

    public getHTMLElement(index: number): HTMLElement | null {
        return this.view.getHTMLElement(index);
    }

    // [protected override methods]

    /**
     * @description Creates an instance of a {@link IListWidgetMouseController}.
     * May override the behaviors by the inheritance to customize the mouse 
     * behavior.
     */
    protected __createMouseController(opts: IListWidgetOpts<T>): ListWidgetMouseController<T> {
        return new ListWidgetMouseController(this, opts);
    }

    /**
     * @description Creates an instance of a {@link ListWidgetKeyboardController}.
     * May override the behaviors by the inheritance to customize the keyboard
     * behavior.
     */
    protected __createKeyboardController(opts: IListWidgetOpts<T>): ListWidgetKeyboardController<T> {
        return new ListWidgetKeyboardController(this);
    }

    /**
     * @description Creates an instance of a {@link ListWidgetDragAndDropController}.
     * May override the behaviors by the inheritance to customize the darg and
     * drop behavior.
     */
    protected __createDndController(opts: IListWidgetOpts<T>): ListWidgetDragAndDropController<T> {
        return new ListWidgetDragAndDropController(this, opts.dragAndDropProvider!, e => this.__toListDragEvent(e), opts.scrollOnEdgeSupport);
    }

    // [private helper methods]

    /**
     * @description Updates trait indice after each splice.
     */
    private __traitSplice(index: number, deleteCount: number, items: readonly T[]): void {
        
        for (const trait of [this.anchor, this.focused, this.selected, this.hovered]) {
            
            /**
             * An array of boolean with the same length of {@link items}. Each
             * boolean indicates if the newly item was already having this trait.  
             * If true, means the item is about to re-insert.
             */
            const reinserted: boolean[] = [];
            
            /**
             * Assume all the inserted items are new (thus they have no existed 
             * traits).
             */
            if (!this.identityProvider) {
                for (const _ of items) {
                    reinserted.push(false);
                }
            } 
            /**
             * Use identity provider to determine if the inserted items are
             * re-inserted.
             */
            else {
                const prevIDs: string[] = [];
                for (const currTraitIdx of trait.items()) {
                    const id = this.identityProvider.getID(this.getItem(currTraitIdx));
                    prevIDs.push(id);
                }
                
                for (const newTraitItem of items) {
                    const id = this.identityProvider.getID(newTraitItem);
                    const ifExisted = Arrays.exist(prevIDs, id);
                    reinserted.push(ifExisted);
                }
            }

            // trait update
            trait.renderer.splice(index, deleteCount, reinserted.length);
            trait.splice(index, deleteCount, reinserted);
        }
    }

    /**
     * @description A mapper function to convert the {@link MouseEvent} to our 
     * standard {@link IListMouseEvent}.
     */
    private __toListMouseEvent(e: MouseEvent): IListMouseEvent<T> {
        return this.__toEvent(e);
    }

    /**
     * @description A mapper function to convert the {@link TouchEvent} to our 
     * standard {@link IListTouchEvent}.
     */
    private __toListTouchEvent(e: TouchEvent): IListTouchEvent<T> {
        return this.__toEvent(e);
    }

    private __toContextmenuEvent(e: MouseEvent): IListContextmenuEvent<T> {
        const event = this.__toEvent(e);
        return {
            ...event,
            position: { x: e.pageX + 1, y: e.pageY },
            target: isNumber(event.actualIndex) ? nullToUndefined(this.view.getHTMLElement(event.actualIndex)) : undefined,
        };
    }

    private __createContextmenuRegister(): Register<IListContextmenuEvent<T>> {
        
        // only used to detect if pressing down context menu key
        this.__register(this.onKeydown(e => {
            e.browserEvent.preventDefault();
            e.browserEvent.stopPropagation();
        }));

        // mouse right click
        const onMouse = Event.map<MouseEvent, IListContextmenuEvent<T>>(this.view.onContextmenu, e => this.__toContextmenuEvent(e));

        // contextmenu key OR shift + F10
        const onKeyRaw = Event.filter(this.onKeyup, e => e.key === KeyCode.ContextMenu || (e.shift && e.key === KeyCode.F10));
        const onKey = Event.map(onKeyRaw, e => { 
            e.browserEvent.preventDefault();
            e.browserEvent.stopPropagation(); 

            const selections = this.getSelections();
            const actualIndex = selections.length ? selections[0] : undefined;
        
            let renderIndex: number | undefined;
            let item: T | undefined;
            let target: HTMLElement = this.view.DOMElement;
            if (actualIndex !== undefined) {
                renderIndex = this.view.getRenderIndex(actualIndex);
                item = this.view.getItem(actualIndex);
                target = this.view.getHTMLElement(actualIndex) ?? target;
            }

            return <IListContextmenuEvent<T>>{
                browserEvent: e.browserEvent,
                actualIndex: actualIndex,
                renderIndex: renderIndex,
                item: item,
                position: undefined,
                target: target,
            };
        });

        return Event.any([onMouse, onKey]);
    }

    /**
     * @description Transforms a {@link DragEvent} into {@link IListDragEvent}.
     * @param event The provided original drag event.
     * @returns The transformed event.
     */
    private __toListDragEvent(event: DragEvent): IListDragEvent<T> {
        const actualIndex = this.view.indexFromEventTarget(event.target);
        const itemCount   = this.view.viewSize();

        // valid item index
        if (!isNullable(actualIndex) && Numbers.isValidIndex(actualIndex, itemCount)) {
            const item = this.view.getItem(actualIndex);
            return {
                browserEvent: event,
                actualIndex: actualIndex, 
                item: item
            };
        }

        // we are not on any items
        return {
            browserEvent: event,
            actualIndex: undefined,
            item: undefined,
        };
    }

    /**
     * @description Universal standard event generation.
     */
    private __toEvent<E extends UIEvent>(e: E): { browserEvent: E, renderIndex: number | undefined, actualIndex: number | undefined, item: T | undefined } {
        const actualIndex = this.view.indexFromEventTarget(e.target);
        
        let renderIndex: number | undefined;
        let item: T | undefined;
        if (actualIndex !== undefined) {
            renderIndex = this.view.getRenderIndex(actualIndex);
            item = this.view.getItem(actualIndex);
        }

        return {
            browserEvent: e,
            renderIndex: renderIndex,
            actualIndex: actualIndex,
            item: item,
        };
    }

    /**
     * @description Try to find the first item forward starting from the given 
     * index that matches the match function.
     * @param index The start index.
     * @param fullLoop If loop all the items.
     * @param match The match function that matches the result. If not provided,
     * the next sibling will be returned.
     * @returns If not found, -1 returned.
     */
    private __findNextWithFilter(index: number, fullLoop: boolean, match?: (item: T) => boolean): number {
        const itemCount = this.viewSize();
        
        for (let i = index; i < itemCount; i++) {
            
            if (index === itemCount && fullLoop === false) {
                return -1;
            }

            index = index % itemCount;

            const matched = !match || match(this.view.getItem(index));
            if (matched) {
                return index;
            }

            index++;
        }

        return -1;
    }

    /**
     * @description Try to find the first item backward starting from the given 
     * index that matches the match function.
     * @param index The start index.
     * @param fullLoop If loop all the items.
     * @param match The match function that matches the result. If not provided,
     * the next sibling will be returned.
     * @returns If not found, -1 returned.
     */
    private __findPrevWithFilter(index: number, fullLoop: boolean, match?: (item: T) => boolean): number {
        const itemCount = this.viewSize();
        
        for (let i = index; i < itemCount; i++) {
            
            if (index < 0 && fullLoop === false) {
                return -1;
            }

            index = (itemCount + (index % itemCount)) % itemCount;

            const matched = !match || match(this.view.getItem(index));
            if (matched) {
                return index;
            }

            index--;
        }

        return -1;
    }
}