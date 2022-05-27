import { IListViewRenderer, PipelineRenderer, RendererType } from "src/base/browser/secondary/listView/listRenderer";
import { IListViewOpts, IViewItem, IViewItemChangeEvent, ListError, ListView } from "src/base/browser/secondary/listView/listView";
import { DisposableManager, IDisposable } from "src/base/common/dispose";
import { addDisposableListener, DomUtility, EventType, isMouseRightClick } from "src/base/common/dom";
import { Emitter, Event, Register, SignalEmitter } from "src/base/common/event";
import { IScrollEvent } from "src/base/common/scrollable";
import { IListItemProvider } from "src/base/browser/secondary/listView/listItemProvider";
import { IListDragAndDropProvider, ListWidgetDragAndDropProvider } from "src/base/browser/secondary/listWidget/listWidgetDragAndDrop";
import { memoize } from "src/base/common/memoization";
import { hash } from "src/base/common/hash";
import { Array } from "src/base/common/array";
import { IS_MAC } from "src/base/node/os";

/**
 * The index changed in {@link __ListTrait}.
 */
export interface ITraitChangeEvent {

    /** The new indices with the corresponding trait. */
    indice: number[];
}

/**
 * @class A {@link __ListTrait} implements a set of methods for toggling one type 
 * of the characteristic of items in {@link ListWidget}, such as item selecting
 * and focusing.
 * 
 * @warn SHOULD NOT BE USED DIRECTLY.
 */
class __ListTrait<T> implements IDisposable {

    // [field]

    /** A trait is a string that represents an CSS class. */
    public trait: string;

    private _onDidChange = new Emitter<ITraitChangeEvent>();
    public onDidChange = this._onDidChange.registerListener;

    private indices: number[] = [];
    private _getElement!: (index: number) => HTMLElement | null;

    /** For fast querying */
    private indicesSet: Set<number> | undefined = undefined;

    // [constructor]

    constructor(trait: string) {
        this.trait = trait;
    }

    // [public method]

    /**
     * @note This function has to be set first.
     */
    set getElement(value: (index: number) => HTMLElement | null) {
        this._getElement = value;
    }

    /**
     * @description Sets the given items with the current trait.
     * @param indice The indice of the items.
     * @param fire If fires the onDidChange event.
     */
    public set(indice: number[], fire: boolean = true): void {
        
        const oldIndice = this.indices;
        this.indices = indice;
        this.indicesSet = undefined;

        const toUnrender = Array.complement(indice, oldIndice);
        const toRender = Array.complement(oldIndice, indice);

        for (const index of toUnrender) {
            const item = this._getElement(index);
            if (item) {
                item.classList.toggle(this.trait, false);
            }
        }

        for (const index of toRender) {
            const item = this._getElement(index);
            if (item) {
                item.classList.toggle(this.trait, true);
            }
        }
        
        if (fire) {
            this._onDidChange.fire({ indice });
        }
    }

    /**
     * @description Returns how many items has such trait.
     */
    public size(): number {
        return this.indices.length;
    }

    /**
     * @description Returns all the indices of items with the current trait.
     */
    public items(): number[] {
        return this.indices;
    }

    /**
     * @description Determines if the item with the given index has the current
     * trait.
     * @param index The index of the item.
     */
    public has(index: number): boolean {
        if (this.indicesSet === undefined) {
            this.indicesSet = new Set();
            this.indices.forEach(index => this.indicesSet!.add(index));
        }
        return this.indicesSet.has(index);
    }

    /**
     * @description All the listeners will be removed and indices will be reset.
     */
    public dispose(): void {
        this._onDidChange.dispose();
        this.indices = [];
    }

}


/**
 * @class A type of {@link IListViewRenderer} for rendering {@link __ListTrait}.
 */
class __ListTraitRenderer<T> implements IListViewRenderer<T, HTMLElement> {

    public readonly type: RendererType;

    private _trait: __ListTrait<T>;

    constructor(trait: __ListTrait<T>) {
        this._trait = trait;
        this.type = hash(this._trait.trait);
    }

    public render(element: HTMLElement): HTMLElement {
        return element;
    }

    public update(item: T, index: number, data: HTMLElement, size?: number): void {
        if (this._trait.has(index)) {
            data.classList.toggle(this._trait.trait, true);
        } else {
            data.classList.toggle(this._trait.trait, false);
        }
    }

    public dispose(element: HTMLElement): void {
        // do nothing
    }

}

/**
 * @class An internal class that handles the mouse support of {@link IListWidget}.
 * It handles:
 *  - when to focus DOM
 *  - when to focus item
 *  - when to select item(s)
 */
class __ListWidgetMouseController<T> implements IDisposable {

    // [fields]

    private _disposables = new DisposableManager();
    private _view: IListWidget<T>;

    private _mouseSupport: boolean = true;
    private _multiSelectionSupport: boolean = true;

    // [constructor]

    constructor(
        view: IListWidget<T>,
        opts: IListWidgetOpts<T>
    ) {
        this._view = view;

        if (opts.mouseSupport !== undefined) {
            this._mouseSupport = opts.mouseSupport;
        }
        
        if (this._mouseSupport === false) {
            // does not support
            return;
        }

        if (opts.multiSelectionSupport !== undefined) {
            this._multiSelectionSupport = opts.multiSelectionSupport;
        }

        this._disposables.register(view.onMousedown(e => this.__onMouseDown(e)));
        this._disposables.register(view.onClick(e => this.__onMouseClick(e)));
    }

    // [public methods]

    public dispose(): void {
        this._disposables.dispose();
    }

    // [private helper methods]

    /**
     * @description Focuses the event target element.
     */
    private __onMouseDown(e: IListMouseEvent<T>): void {
        // prevent double focus
        if (document.activeElement !== e.browserEvent.target) {
			this._view.setDomFocus();
		}
    }

    /**
     * @description Handles item focus and selection logic.
     */
    private __onMouseClick(e: IListMouseEvent<T>): void {
        console.log('[controller] event: ', e);

        if (this._mouseSupport === false) {
            return;
        }

        const focusedIdx = e.actualIndex;
        
        // clicking nowhere, we reset all the traits
        if (focusedIdx === undefined) {
            console.log('[controller] setting no focus and selections');
            this._view.setFocus(null);
            this._view.setSelections([]);
            return;
        }

        // check if selecting in range
        if (this.__selectingInRangeEvent(e)) {
            console.log('[constroller] selection in range');
            this.__multiSelectionInRange(e);
            return;
        } else if (this.__selectingInSingleEvent(e)) {
            console.log('[constroller] selection in single');
            this._mutliSelectionInSingle(e);
            return;
        }

        console.log('[controller] setting single focus and selection');

        // no multi-selection, set focus only
        this._view.setFocus(focusedIdx);
        if (isMouseRightClick(e.browserEvent) === false) {
            this._view.setSelections([focusedIdx]);
        }
    }

    /**
     * @description Determines if the event is selecting in range. In other words,
     * pressing SHIFT.
     */
    private __selectingInRangeEvent(e: IListMouseEvent<T>): boolean {
        if (this._multiSelectionSupport === false) {
            return false;
        }
        return e.browserEvent.shiftKey;
    }

    /**
     * @description Determines if the event is selecting in single. In other words,
     * pressing CTRL in Windows or META in Macintosh.
     */
    private __selectingInSingleEvent(e: IListMouseEvent<T>): boolean {
        if (this._multiSelectionSupport === false) {
            return false;
        }
        return IS_MAC ? e.browserEvent.metaKey : e.browserEvent.ctrlKey;
    }

    /**
     * @description Applies multi-selection when selecting in range.
     */
    private __multiSelectionInRange(e: IListMouseEvent<T>): void {
        const focusedIdx = e.actualIndex!;
        let currFocusedIdx = this._view.getFocus();

        // if no focus yet, we focus on the current.
        if (currFocusedIdx === null) {
            currFocusedIdx = focusedIdx;
        }
        
        // calculates the selection range
        const selectionRange = Array.range(Math.min(focusedIdx, currFocusedIdx), Math.max(focusedIdx, currFocusedIdx) + 1);
        
        // determine new selection
        const currSelection = this._view.getSelections();
        const newSelection = Array.complement(currSelection, selectionRange);

        this._view.setSelections(newSelection);
        this._view.setFocus(focusedIdx);
    }

    /**
     * @description Applies multi-selection when selecting in single.
     */
    private _mutliSelectionInSingle(e: IListMouseEvent<T>): void {
        console.log("select in single");
        const focusedIdx = e.actualIndex!;

        const currSelection = this._view.getSelections();
        const newSelection = Array.remove(currSelection, focusedIdx);

        this._view.setFocus(focusedIdx);

        if (newSelection.length === currSelection.length) {
            // we are not removing any of the current selections
            this._view.setSelections([...newSelection, focusedIdx]);
        } else {
            // we removed one of the selections
            this._view.setSelections(newSelection);
        }
    }

}

/**
 * A standard mouse event interface used in {@link IListWidget}. Clicking nothing 
 * returns undefined.
 */
export interface IListMouseEvent<T> {
    
    /** The original brower event. */
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
    /** The original brower even. */
    browserEvent: TouchEvent;

    /** The rendering index of the clicked item. */
    renderIndex: number| undefined;

    /** The actual index of the clicked item. */
    actualIndex: number | undefined;

    /** The clicked item. */
    item: T | undefined;
}

export interface IListDragEvent<T> {
    /** The original brower event {@link DragEvent}. */
    browserEvent: DragEvent;

    /** The actual index of the drag / dragover / drop item. */
    actualIndex: number;
    
    /** The drag / dragover / drop item. */
    item: T;
}

/**
 * The consturtor options for {@link ListWidget}.
 */
export interface IListWidgetOpts<T> extends Omit<IListViewOpts<T>, 'dragAndDropProvider'> {
    
    /**
     * A provider that has ability to provide Drag and Drop Support (dnd).
     */
    readonly dragAndDropProvider?: IListDragAndDropProvider<T>;

    /** 
     * If allows on mouse support. 
     * @default true
     */
    readonly mouseSupport?: boolean;

    /**
     * If allows mutiple selection support.
     * @default true
     */
    readonly multiSelectionSupport?: boolean;

}

/**
 * The interface for {@link ListWidget}.
 */
export interface IListWidget<T> extends IDisposable {
    
    // [events / getter]
    
    /**
     * The container of the whole view.
     */
    DOMElement: HTMLElement;

    /**
     * The length (height) of the whole view in pixels.
     */
    length: number;

    /**
     * Fires when the {@link IListWidget} is scrolling.
     */
    get onDidScroll(): Register<IScrollEvent>;
    
    /**
     * Fires when the {@link IListWidget} itself is blured or focused.
     */
    get onDidChangeFocus(): Register<boolean>;

    /**
     * Fires when the focused items in the {@link IListWidget} is changed.
     */
    get onDidChangeItemFocus(): Register<ITraitChangeEvent>;

    /**
     * Fires when the selected items in the {@link IListWidget} is changed.
     */
    get onDidChangeItemSelection(): Register<ITraitChangeEvent>;

    /**
     * Fires when the item in the {@link IListWidget} is clicked.
     */
    get onClick(): Register<IListMouseEvent<T>>;
    
    /**
     * Fires when the item in the {@link IListWidget} is double clicked.
     */
    get onDoubleclick(): Register<IListMouseEvent<T>>;

    /**
     * Fires when the item in the {@link IListWidget} is mouseovered.
     */
    get onMouseover(): Register<IListMouseEvent<T>>;

    /**
     * Fires when the item in the {@link IListWidget} is mousedouted.
     */
    get onMouseout(): Register<IListMouseEvent<T>>;
    
    /**
     * Fires when the item in the {@link IListWidget} is mousedowned.
     */
    get onMousedown(): Register<IListMouseEvent<T>>;
    
    /**
     * Fires when the item in the {@link IListWidget} is mouseuped.
     */
    get onMouseup(): Register<IListMouseEvent<T>>;

    /**
     * Fires when the item in the {@link IListWidget} is mousemoved.
     */
    get onMousemove(): Register<IListMouseEvent<T>>;

    /** 
     * An event sent when the state of contacts with a touch-sensitive surface 
     * changes. This surface can be a touch screen or trackpad.
     */
    get onTouchstart(): Register<IListTouchEvent<T>>;

    // [methods]

    /**
     * @description Given the height, re-layouts the height of the whole view.
     * @param height The given height.
     * 
     * @note If no values are provided, it will sets to the height of the 
     * corresponding DOM element of the view.
     */
    layout(height?: number): void;

    /**
     * @description Rerenders the whole view.
     */
    rerender(): void;

    /**
     * @description Deletes an amount of elements in the {@link IListWidget} at 
     * the given index, if necessary, inserts the provided items after the given 
     * index.
     * @param index The given index.
     * @param deleteCount The amount of items to be deleted.
     * @param items The items to be inserted.
     */
    splice(index: number, deleteCount: number, items: T[]): void;

    /**
     * @description Sets the current view as focused in DOM tree.
     */
    setDomFocus(): void;

    // [item traits support]

    /**
     * @description Sets the item with the given index as focused.
     * @param index The provided index. If not provided, remove the current one.
     */
    setFocus(index: number | null): void;

    /**
     * @description Sets the item with the given index as selected.
     * @param index The provided index.
     */
    setSelections(index: number[]): void;

    /**
     * @description Returns all the indice of the selected items.
     */
    getSelections(): number[];

    /**
     * @description Returns the index of the focused item.
     */
    getFocus(): number | null;

    /**
     * @description Returns all the selected items.
     */
    getSelectedItems(): T[];

    /**
     * @description Returns the focused item.
     */
    getFocusedItem(): T | null;
}

/**
 * @class A {@link ListWidget} is built on top of {@link ListView}, with extra 
 * features.
 * 
 * Extra Functionalities:
 *  - focus support
 *  - selection support
 *  - drag and drop support
 */
export class ListWidget<T> implements IListWidget<T> {

    // [fields]

    private disposables: DisposableManager;
    private view: ListView<T>;

    private selected: __ListTrait<T>;
    private focused: __ListTrait<T>;

    private mouseController: __ListWidgetMouseController<T>;

    // [constructor]

    constructor(
        container: HTMLElement,
        renderers: IListViewRenderer<any, any>[],
        itemProvider: IListItemProvider<T>, 
        opts: IListWidgetOpts<T> = {}
    ) {
        this.disposables = new DisposableManager();

        // initializes all the item traits
        this.selected = new __ListTrait<T>('selected');
        this.focused = new __ListTrait<T>('focused');

        // integrates all the renderers
        const baseRenderers = [new __ListTraitRenderer(this.selected), new __ListTraitRenderer(this.focused)];
        renderers = renderers.map(renderer => new PipelineRenderer(renderer.type, [...baseRenderers, renderer]));
        
        const listViewOpts: IListViewOpts<T> = {
            ...opts,
            dragAndDropProvider: opts.dragAndDropProvider ? new ListWidgetDragAndDropProvider(this, opts.dragAndDropProvider) : undefined,
        };

        // construct list view
        this.view = new ListView(container, renderers, itemProvider, listViewOpts);

        this.selected.getElement = item => this.view.getElement(item);
        this.focused.getElement = item => this.view.getElement(item);

        this.selected.onDidChange(e => {
            console.log('selection: ', e.indice);
        });

        this.focused.onDidChange(e => {
            console.log('focused: ', e.indice);
        });

        // mouse support integration
        this.mouseController = new __ListWidgetMouseController(this, opts);

        if (opts.dragAndDropProvider) {
            this.__enableDragAndDropSupport();
        }

        this.disposables.register(this.view);
        this.disposables.register(this.selected);
        this.disposables.register(this.focused);
    }

    // [getter / setter]

    get DOMElement(): HTMLElement { return this.view.DOMElement; }
    get length(): number { return this.view.length; }

    get onDidScroll(): Register<IScrollEvent> { return this.view.onDidScroll; }
    @memoize get onDidChangeFocus(): Register<boolean> { return this.disposables.register(new SignalEmitter<boolean, boolean>([Event.map(this.view.onDidFocus, () => true), Event.map(this.view.onDidBlur, () => false)], (e: boolean) => e)).registerListener; }
    get onDidChangeItemFocus(): Register<ITraitChangeEvent> { return this.focused.onDidChange; }
    get onDidChangeItemSelection(): Register<ITraitChangeEvent> { return this.selected.onDidChange; }

    get onClick(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onClick, (e: MouseEvent) => this.__toListMouseEvent(e)); }
    get onDoubleclick(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onDoubleclick, (e: MouseEvent) => this.__toListMouseEvent(e));  }
    get onMouseover(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMouseover, (e: MouseEvent) => this.__toListMouseEvent(e)); }
    get onMouseout(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMouseout, (e: MouseEvent) => this.__toListMouseEvent(e)); }
    get onMousedown(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMousedown, (e: MouseEvent) => this.__toListMouseEvent(e)); }
    get onMouseup(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMouseup, (e: MouseEvent) => this.__toListMouseEvent(e)); }
    get onMousemove(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMousemove, (e: MouseEvent) => this.__toListMouseEvent(e)); }
    get onTouchstart(): Register<IListTouchEvent<T>> { return Event.map<TouchEvent, IListTouchEvent<T>>(this.view.onTouchstart, (e: TouchEvent) => this.__toListTouchEvent(e)); }

    // [methods]

    public dispose(): void {
        this.disposables.dispose();
    }

    public layout(height?: number): void {
        this.view.layout(height);
    }

    public rerender(): void {
        this.view.rerender();
    }

    public splice(index: number, deleteCount: number, items: T[] = []): void {
        if (index < 0 || index > this.view.length) {
            throw new ListError(`splice invalid start index: ${index}`);
        }

        if (deleteCount < 0) {
            throw new ListError(`splice invalid deleteCount: ${deleteCount}`);
        }

        if (deleteCount === 0 && items.length === 0) {
            return;
        }

        this.view.splice(index, deleteCount, items);
    }

    public setDomFocus(): void {
        this.view.setDomFocus();
    }

    // [item traits support]

    public setFocus(index: number | null): void {
        this.focused.set((index !== null) ? [index] : []);
    }

    public setSelections(indice: number[]): void {
        if (indice.length === 0) {
            return;
        }
        this.selected.set(indice);
    }

    public getFocus(): number | null {
        const indice = this.focused.items();
        return indice.length ? indice[0]! : null;
    }

    public getSelections(): number[] {
        return this.selected.items();
    }

    public getSelectedItems(): T[] {
        const indice = this.selected.items();
        return indice.map(index => this.view.getItem(index));
    }

    public getFocusedItem(): T | null {
        const indice = this.focused.items();
        return indice.length ? this.view.getItem(indice[0]!) : null;
    }

    // [private helper methods]

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

    // [Drag and Drop Support]

    /**
     * @description Enables the drag and drop (dnd) support in {@link ListView}.
     */
    private __enableDragAndDropSupport(): void {

        console.log('enable dnd');

        // only adding 4 listeners to the whole view
        this.disposables.register(addDisposableListener(this.view.DOMElement, EventType.dragover, e => this.__onDragOver(this.__toListDragEvent(e))));
        this.disposables.register(addDisposableListener(this.view.DOMElement, EventType.drop, e => this.__onDrop(this.__toListDragEvent(e))));
        this.disposables.register(addDisposableListener(this.view.DOMElement, EventType.dragleave, e => this.__onDragLeave(this.__toListDragEvent(e))));
        this.disposables.register(addDisposableListener(this.view.DOMElement, EventType.dragend, e => this.__onDragEnd(this.__toListDragEvent(e))));

        // dragstart listener
        this.view.onInsertItemInDOM((viewItem: IViewItemChangeEvent<T>) => this.__initItemWithDragStart(viewItem.item, viewItem.index));
        this.view.onRemoveItemInDOM((viewItem: IViewItemChangeEvent<T>) => {
            viewItem.item.dragStart?.dispose();
        });

    }

    /**
     * @description Transforms a {@link DragEvent} into {@link IListDragEvent}.
     * @param event The provided original drag event.
     * @returns The transformed event.
     */
    private __toListDragEvent(event: DragEvent): IListDragEvent<T> {

        const actualIndex = this.view.indexFromEventTarget(event.target)!; // will not be undefined
        const item = this.view.getItem(actualIndex);
        return {
            browserEvent: event,
            actualIndex: actualIndex, 
            item: item
        };
    }

    /**
     * @description Initializes the dragstart event listener of the given list 
     * item.
     * @param item The given item.
     * @param index The index of the item in the list view.
     */
    private __initItemWithDragStart(item: IViewItem<T>, index: number): void {
        
        // avoid weird stuff happens
        if (item.dragStart) {
            item.dragStart.dispose();
        }

        // get the drag data
        const dnd = this.view.getDragAndDropProvider();
        const userData = dnd.getDragData(item.data);

        // make the HTMLElement actually draggable
        item.row!.dom.draggable = !!userData;

        // add event listener
        if (userData) {
            item.dragStart = addDisposableListener(item.row!.dom, EventType.dragstart, (e: DragEvent) => this.__onDragStart(item.data, userData, e));
        }
    }

    /**
     * @description Invokes when the event {@link EventType.dragstart} happens.
     * @param data The corresponding data of the dragging item.
     * @param userData The user-defined data.
     * @param event The {@link DragEvent}.
     */
    private __onDragStart(data: T, userData: string, event: DragEvent): void {
        
        if (event.dataTransfer === null) {
            return;
        }

        const dnd = this.view.getDragAndDropProvider();

        const allItems = dnd.getDragItems(data);

        event.dataTransfer.effectAllowed = 'copyMove';
		event.dataTransfer.setData('text/plain', userData);
        
        // TODO...

        if (dnd.onDragStart) {
            dnd.onDragStart();
        }
    }

    /**
     * @description When dnd support is on, invokes when dragging something over
     * the whole {@link IListWidget}.
     * @param event The dragging event.
     */
    private __onDragOver(event: IListDragEvent<T>): void {
        
        // // https://stackoverflow.com/questions/21339924/drop-event-not-firing-in-chrome
        event.browserEvent.preventDefault();

        console.log(event.actualIndex);

    }

    /**
     * @description When dnd support is on, invokes when drops something over
     * the whole {@link IListWidget}.
     * @param event The dragging event.
     */
    private __onDrop(event: IListDragEvent<T>): void {
        console.log('drop, ', event.actualIndex);
    }

    /**
     * @description When dnd support is on, invokes when dragging something leave
     * the whole {@link IListWidget}.
     * @param event The dragging event.
     */
    private __onDragLeave(event: IListDragEvent<T>): void {
        console.log('dragleave, ', event.actualIndex);
    }

    /**
     * @description When dnd support is on, invokes when the dragging ends inside 
     * the whole {@link IListWidget}.
     * @param event The dragging event.
     */
    private __onDragEnd(event: IListDragEvent<T>): void {
        console.log('dragend, ', event.actualIndex);
    }

}
