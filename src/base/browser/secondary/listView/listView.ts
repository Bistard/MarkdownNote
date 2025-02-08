import "src/base/browser/secondary/listView/listView.scss";
import { IListViewRow, ListViewCache } from "src/base/browser/secondary/listView/listCache";
import { IListViewRenderer, ListItemRenderer, PipelineRenderer, RendererType } from "src/base/browser/secondary/listView/listRenderer";
import { ScrollableWidget } from "src/base/browser/secondary/scrollableWidget/scrollableWidget";
import { IScrollableWidgetExtensionOpts, ScrollbarType } from "src/base/browser/secondary/scrollableWidget/scrollableWidgetOptions";
import { Disposable, IDisposable } from "src/base/common/dispose";
import { DomEmitter, DomUtility, EventType } from "src/base/browser/basic/dom";
import { Emitter, Register } from "src/base/common/event";
import { IRange, ISpliceable, Range, RangeTable } from "src/base/common/structures/range";
import { IScrollEvent, Scrollable } from "src/base/common/scrollable";
import { IListItemProvider } from "src/base/browser/secondary/listView/listItemProvider";
import { memoize } from "src/base/common/memoization";
import { FocusTracker } from "src/base/browser/basic/focusTracker";
import { IList } from "src/base/browser/secondary/listView/list";
import { assert, check, panic } from "src/base/common/utilities/panic";
import { ILog, LogLevel } from "src/base/common/logger";
import { Iterable } from "src/base/common/utilities/iterable";
import { RequestAnimateController } from "src/base/browser/basic/animation";

/**
 * The constructor options for {@link ListView}.
 */
export interface IListViewOpts extends Omit<IScrollableWidgetExtensionOpts, 'scrollbarType'> {
    
    /**
     * When constructing the view, decide whether to layout the view immediately.
     * `layout` meaning to update the size of the view and causes rerendering.
     * 
     * Sometimes the provided HTMLElement container is NOT in the DOM tree yet, 
     * so it cannot decide how big the view should be. If this is the case, set
     * this to false or just do not provide, then call `layout()` manually when
     * you ensures the container is in DOM tree.
     * 
     * @default false
     */
    readonly layout?: boolean;

    /**
     * If turns on the transform optimization.
     * @see https://www.afasterweb.com/2017/07/27/optimizing-repaints/
     * @default false
     */
    readonly transformOptimization?: boolean;
    
    /**
     * The width of thee scrollbar.
     * @default 10
     */
    readonly scrollbarSize?: number;

    /**
     * Indicates whether to enable the scroll edge gradient indicator.
     * 
     * When enabled, a gradient effect is displayed at the top and/or bottom 
     * edges of the list view to indicate that additional content is available 
     * for scrolling. The gradient disappears when the view is scrolled to the 
     * respective edge.
     * 
     * @default true
     */
    readonly scrollEdgeGradientIndicator?: boolean;

    /**
     * If provided, log messages will be reported.
     */
    readonly log?: ILog;
}

/**
 * The inner data structure wraps each item in {@link ListView}.
 */
export interface IViewItem<T> {
    
    /**
     * The actual client data.
     */
    readonly data: T;

    /**
     * The type of this item for rendering.
     */    
    readonly type: RendererType;

    /**
     * The height (in pixels) of this item.
     */
    readonly size: number;

    /**
     * The rendering metadata. 
     * `null` means this item is currently not rendered.
     */
    row: IListViewRow | null;
    dragStart?: IDisposable;
}

export interface IViewItemChangeEvent<T> {
    readonly item: IViewItem<T>;
    readonly index: number;
}

/**
 * The interface for {@link ListView}.
 */
export interface IListView<T> extends IList<T>, IDisposable {

    // [events / getter]

    /** Fires when the splice operation is invoked. */
    get onDidSplice(): Register<void>;

    /** Fires before the {@link IListView} is scrolling. */
    get onWillScroll(): Register<IScrollEvent>;

    /** Fires after the {@link IListView} is scrolling. */
    get onDidScroll(): Register<IScrollEvent>;
    
    /** Fires when the {@link IListView} itself is focused. */
    get onDidFocus(): Register<FocusEvent>;

    /** Fires when the {@link IListView} itself is blurred. */
    get onDidBlur(): Register<FocusEvent>;

    /** Fires when the item in the {@link IListView} is clicked. */
    get onClick(): Register<MouseEvent>;

    /** Fires when the item in the {@link IListView} is double clicked. */
    get onDoubleClick(): Register<MouseEvent>;

    /** Fires when the item in the {@link IListView} is mouseover. */
    get onMouseover(): Register<MouseEvent>;
    
    /** Fires when the item in the {@link IListView} is mouseout. */
    get onMouseout(): Register<MouseEvent>;
    
    /** Fires when the item in the {@link IListView} is mousedown. */
    get onMousedown(): Register<MouseEvent>;
    
    /** Fires when the item in the {@link IListView} is mouseup. */
    get onMouseup(): Register<MouseEvent>;
    
    /** Fires when the item in the {@link IListView} is mousemove. */
    get onMousemove(): Register<MouseEvent>;

    /** 
     * An event sent when the state of contacts with a touch-sensitive surface 
     * changes. This surface can be a touch screen or track-pad.
     */
    get onTouchstart(): Register<TouchEvent>;

    /** Fires when the {@link IListView} is keydown. */
    get onKeydown(): Register<KeyboardEvent>;

    /** Fires when the {@link IListView} is keyup. */
    get onKeyup(): Register<KeyboardEvent>;

    /** Fires when the {@link IListView} is keypress. */
    get onKeypress(): Register<KeyboardEvent>;

    /** 
     * Fires when the user attempts to open a context menu {@link IListView}. 
     * This event is typically triggered by clicking the right mouse button, or 
     * by pressing the context menu key.
     */
    get onContextmenu(): Register<MouseEvent>;

    // [public methods]

    /**
     * @description Renders all the items in the DOM tree.
     * @param prevRenderRange The render range in the previous render frame.
     * @param renderTop The top of scrolling area.
     * @param renderHeight The height of viewport.
     */
    render(prevRenderRange: IRange, renderTop: number, renderHeight: number, updateItemsInDOM: boolean): void;

    /**
     * @description Updates the position (top) and attributes of an item in the 
     * DOM tree by the index.
     * @param index The index of the item.
     */
    updateItemInDOM(index: number): void;

    /**
     * @description Inserts an item in the DOM tree by the index. If 
     * `insertBefore` provided, we insert the new HTMLElement before it.
     * 
     * @param index The index of the item.
     * @param insertBefore The HTMLElement to be insert before.
     * @param row Provided row.
     */
    insertItemInDOM(index: number, insertBefore: HTMLElement | null, row?: IListViewRow): void;

    /**
     * @description Removes an item from the DOM tree by the index.
     * @param index The index of the item.
     */
    removeItemInDOM(index: number): void;

    // [Item Related Methods]

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
     * @description Returns the item's DOM position (top) given the index 
     * relatives to the scrollable size.
     * @param index The index of the item.
     */
    positionAt(index: number): number;

    /**
     * @description Returns the item's index given the DOM position.
     * @param position The DOM's position (top) relatives to the scrollable size.
     */
    indexAt(position: number): number;

    /**
     * @description Returns the item's index given the visible DOM position.
     * @param visiblePosition The DOM's position (top) relatives to the viewport.
     */
    indexAtVisible(visiblePosition: number): number;

    /**
	 * @description Returns the index of the item which has an index after the 
     * item with the given position.
	 * @param position The DOM's position (top) relatives to the scrollable size.
	 */
    indexAfter(position: number): number;

    /**
     * @description Returns the index of the item which has an index after the
     * item with the given visible DOM position.
     * @param visiblePosition The DOM's position (top) relatives to the viewport.
     */
    indexAfterVisible(visiblePosition: number): number;

    /**
     * @description Returns the rendering index of the item given the visible 
     * DOM position.
     * @param visiblePosition The DOM's position (top) relatives to the viewport.
     * 
     * @note If the position is invalid, undefined is returned.
     */
    renderIndexAtVisible(visiblePosition: number): number | undefined;

    /**
     * @description Returns the actual index from the event target which may be
     * triggered by clicking or anything other events. The method will try to get
     * the DOM attribute from the target.
     * @param target The {@link EventTarget}.
     * 
     * @note If the target is not found, undefined is returned.
     */
    indexFromEventTarget(target: EventTarget | null): number | undefined;
}

/**
 * @class A virtual vertical scrolling engine that only renders the items within
 * its viewport. It can hold a large amount of items and still has a great 
 * performance. Built on top of {@link ScrollableWidget}.
 * 
 * Provided renderers are responsible for rendering each item with corresponding 
 * type.
 * 
 * The performance mainly affects by how the renderers work.
 * 
 * Functionalities:
 *  - Vertical scrolling
 *  - performant template-based rendering
 *  - mouse support
 */
export class ListView<T> extends Disposable implements ISpliceable<T>, IListView<T> {

    // [fields]

    /** The whole element of the view, including the scrollbar and all the items. */
    private readonly _element: HTMLElement;
    private readonly _focusTracker: FocusTracker;

    /** The element contains all the items. */
    private readonly _listContainer: HTMLElement;

    private readonly _scrollable: Scrollable;
    private readonly _scrollableWidget: ScrollableWidget;
    /** Invoked when every scroll happens */
    private readonly _scrollAnimate: RequestAnimateController<{}>;

    /**
     * position: `top` pixels of each row
     * index: the index of the row
     */
    private _rangeTable: RangeTable;

    private readonly _renderers: Map<RendererType, IListViewRenderer<T, any>>;
    private readonly _itemProvider: IListItemProvider<T>;
    
    private _items: IViewItem<T>[];
    private readonly _cache: ListViewCache;

    /** The `top` pixels relatives to the scrollable view that was previously rendered. */
    private _prevRenderTop: number;
    /** The `height` of the list view that was previously rendered. */
    private _prevRenderHeight: number;

    /** The range represents the visible items. */
    private _visibleRange: IRange;

    /** If the list view is during the `splice()` operation. */
    private _splicing: boolean;
    private readonly log?: ILog;

    // [events]

    private readonly _onDidSplice = this.__register(new Emitter<void>());
    public readonly onDidSplice = this._onDidSplice.registerListener;

    private readonly _onInsertItemInDOM = this.__register(new Emitter<IViewItemChangeEvent<T>>());
    public readonly onInsertItemInDOM = this._onInsertItemInDOM.registerListener;

    private readonly _onUpdateItemInDOM = this.__register(new Emitter<IViewItemChangeEvent<T>>());
    public readonly onUpdateItemInDOM = this._onUpdateItemInDOM.registerListener;

    private readonly _onRemoveItemInDOM = this.__register(new Emitter<IViewItemChangeEvent<T>>());
    public readonly onRemoveItemInDOM = this._onRemoveItemInDOM.registerListener;

    // [getter / setter]

    get onWillScroll(): Register<IScrollEvent> { return this._scrollableWidget.onWillScroll; }
    get onDidScroll(): Register<IScrollEvent> { return this._scrollableWidget.onDidScroll; }
    
    get onDidFocus(): Register<FocusEvent> { return this._focusTracker.onDidFocus; }
    get onDidBlur(): Register<FocusEvent> { return this._focusTracker.onDidBlur; }
    
    @memoize get onClick(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.click)).registerListener; }
    @memoize get onDoubleClick(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.doubleClick)).registerListener; }
    @memoize get onMouseover(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.mouseover)).registerListener; }
    @memoize get onMouseout(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.mouseout)).registerListener; }
    @memoize get onMousedown(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.mousedown)).registerListener; }
    @memoize get onMouseup(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.mouseup)).registerListener; }
    @memoize get onMousemove(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.mousemove)).registerListener; }
    @memoize get onTouchstart(): Register<TouchEvent> { return this.__register(new DomEmitter(this._element, EventType.touchstart)).registerListener; }

    @memoize get onKeydown(): Register<KeyboardEvent> { return this.__register(new DomEmitter(this._element, EventType.keydown)).registerListener; }
    @memoize get onKeyup(): Register<KeyboardEvent> { return this.__register(new DomEmitter(this._element, EventType.keyup)).registerListener; }
    @memoize get onKeypress(): Register<KeyboardEvent> { return this.__register(new DomEmitter(this._element, EventType.keypress)).registerListener; }
    @memoize get onContextmenu(): Register<MouseEvent> { return this.__register(new DomEmitter(this._element, EventType.contextmenu)).registerListener; }

    get DOMElement(): HTMLElement { return this._element; }
    get listElement(): HTMLElement { return this._listContainer; }
    get contentSize(): number { return this._scrollable.getScrollSize(); }

    // [constructor]

    constructor(
        container: HTMLElement, 
        renderers: IListViewRenderer<any, any>[], 
        itemProvider: IListItemProvider<T>,
        private readonly options: IListViewOpts,
    ) {
        super();
        this.log = options.log;
        this.log?.(LogLevel.DEBUG, 'ListView', 'ListView Constructing...');

        this._element = document.createElement('div');
        this._element.className = 'list-view';
        this._focusTracker = new FocusTracker(this._element, true);

        this._items = [];
        this._rangeTable = new RangeTable();
        this._prevRenderTop = 0;
        this._prevRenderHeight = 0;
        this._splicing = false;
        this._visibleRange = Range.EMPTY;

        this._listContainer = document.createElement('div');
        this._listContainer.className = 'list-view-container';
        if (options.transformOptimization) {
            this._listContainer.style.transform = 'translate3d(0px, 0px, 0px)';
        }
        
        this._scrollable = this.__register(new Scrollable(options.scrollbarSize ?? 10, 0, 0, 0));
        this._scrollableWidget = new ScrollableWidget(
            this._scrollable, {
                ...options,
                scrollbarType: ScrollbarType.vertical,
            },
        );

        this._scrollAnimate = this.__register(new RequestAnimateController(() => {
            this._scrollable.setScrollSize(this._rangeTable.size());
        }));
        
        // scroll rendering
        this.__register(this._scrollableWidget.onDidScroll((e: IScrollEvent) => {

            /**
             * splice() will trigger scrollSize changes, thus it will also 
             * trigger onDidScroll which cause excessive rendering.
             */
            if (this._splicing) {
                return;
            }

            const prevRenderRange = this.__getRenderRange(this._prevRenderTop, this._prevRenderHeight);
            this.render(prevRenderRange, e.scrollPosition, e.viewportSize, false);

            if (options.scrollEdgeGradientIndicator ?? true) {
                this.__updateScrollableGradientIndicator(e);
            }
        }));

        // integrates all the renderers
        renderers = renderers.map(renderer => new PipelineRenderer(renderer.type, [new ListItemRenderer(), renderer]));

        this._renderers = new Map();
        for (const renderer of renderers) {
            this._renderers.set(renderer.type, renderer);
            this.log?.(LogLevel.TRACE, 'ListView', `Renderer registered: ${renderer.type}`);
        }

        this._itemProvider = itemProvider;

        this._cache = this.__register(new ListViewCache(this._renderers));

        // DOM rendering
        this._element.appendChild(this._listContainer);
        this._scrollableWidget.render(this._element);
        container.appendChild(this._element);

        // optional rendering
        if (options.layout) {
            this.layout();
        }

        // disposable registration
        this.__register(this._scrollable);
        this.__register(this._scrollableWidget);
        this.__register(this._cache);
        this.__register(this._focusTracker);

        this.log?.(LogLevel.DEBUG, 'ListView', 'ListView Constructed.');
    }

    // [methods]

    public override dispose(): void {
        
        // try to dispose all the internal data from each renderer.
        for (const item of this._items) {
            if (item.row) {
                const renderer = this._renderers.get(item.type);
                if (renderer) {
                    renderer.disposeData?.(item.data, -1, item.row.metadata, undefined);
                    renderer.dispose(item.row.metadata);
                }
            }
            item.dragStart?.dispose();
        }
        this._items = [];

        // remove list view from the DOM tree.
        this._element.parentNode?.removeChild(this._element);

        super.dispose();
    }

    public layout(height?: number): void {
        height = height ?? DomUtility.Attrs.getContentHeight(this._element);
        this._scrollable.setViewportSize(height);
        
        if (this.options.scrollEdgeGradientIndicator ?? true) {
            this.__updateScrollableGradientIndicator(this._scrollable.getScrollEvent());
        }
    }

    public render(prevRenderRange: IRange, renderTop: number, renderHeight: number, updateItemsInDOM: boolean): void {
        const renderRange = this.__getRenderRange(renderTop, renderHeight);
        this._visibleRange = renderRange;

        // same range, do nothing.
        if (Range.exact(prevRenderRange, renderRange)) {
            return;
        }
        
        this.log?.(LogLevel.TRACE, 'ListView', `rendering... (prevRenderRange: [${prevRenderRange.start}, ${prevRenderRange.end}], newRenderRange: [${renderRange.start}, ${renderRange.end}])`);

        const insert = Range.relativeComplement(prevRenderRange, renderRange);
        const remove = Range.relativeComplement(renderRange, prevRenderRange);
        
        // update items
        if (updateItemsInDOM) {
            const update = Range.intersection(prevRenderRange, renderRange);
            for (let i = update.start; i < update.end; i++) {
                this.updateItemInDOM(i);
            }
        }
    
        /**
         * Try to get the next element in the given range, so we can insert our 
         * new elements before it one by one.
         */
        const insertBefore = this.__getNextElement(insert);

        // insert items
        for (const range of insert) {
            for (let i = range.start; i < range.end; i++) {
                this.insertItemInDOM(i, insertBefore);
            }
        }

        // remove items
        for (const range of remove) {
            for (let i = range.start; i < range.end; i++) {
                this.removeItemInDOM(i);
            }
        }

        this._listContainer.style.top = `${-renderTop}px`;
        this._prevRenderTop = renderTop;
        this._prevRenderHeight = renderHeight;
    }

    public rerender(): void {
        
        /**
         * @note Since each item does not support dynamic height for now, 
         * rerender will do nothing.
         */

        // TODO

        return;
    }
    
    public viewSize(onlyVisible: boolean = false): number {
        if (onlyVisible) {
            return this._visibleRange.end - this._visibleRange.start;
        }
        return this._items.length; 
    }

    public splice(index: number, deleteCount: number, items: T[] = []): void {
        check(this._splicing === false, '[ListView] cannot splice recursively.');
        
        this.log?.(LogLevel.TRACE, 'ListView', `Splicing... (index: ${index}, deleteCount: ${deleteCount}, insertCount: ${items.length})`);
        this._splicing = true;

        try {
            this.__splice(index, deleteCount, items);
            this._onDidSplice.fire();
        } 
        catch (err) {
            panic(err);
        } 
        finally {
            this._splicing = false;
        }
    }

    public reveal(index: number, relativePositionPercentage?: number): void {
        if (index < 0 && index >= this.viewSize()) {
            return;
        }

        const viewportHeight = this.getViewportSize();

        const itemPosition = this.positionAt(index);
        const itemHeight = this.getItemHeight(index);

        if (relativePositionPercentage !== undefined && 
            (relativePositionPercentage < 0 || relativePositionPercentage > 1)
        ) {
            const visiblePart = itemHeight - viewportHeight;
            const position = visiblePart * relativePositionPercentage + itemPosition;
            this.setScrollPosition(position);
        } 
        
        // adjust the item position depends from the revealing side.
        else {
            const scrollPosition = this.getScrollPosition();
            const scrollBottomPosition = scrollPosition + viewportHeight;
            const itemBottomPosition = itemPosition + itemHeight;
            if (itemPosition === scrollPosition || itemBottomPosition === scrollBottomPosition) {
                // item is at the exact top of the visible part OR the exact bottom of the visible part
            } else if (itemPosition < scrollPosition) {
                // item is `above` the visible part
                this.setScrollPosition(itemPosition);
            } else if (itemBottomPosition > scrollBottomPosition) {
                // item is `below` the visible part
                this.setScrollPosition(itemBottomPosition - viewportHeight);
            }
        }
    }
    
    public updateItemInDOM(index: number): void {
        const item = assert(this._items[index]);

        const dom = assert(item.row).dom;
        dom.style.top = this.positionAt(index) + 'px';
        dom.setAttribute('index', `${index}`);

        this._onUpdateItemInDOM.fire({ item: item, index: index });
    }

    public insertItemInDOM(index: number, insertBefore: HTMLElement | null, row?: IListViewRow): void {
        const item = assert(this._items[index]);
        
        if (!item.row) {
            item.row = row ?? this._cache.get(item.type);
        }

        this.updateItemInDOM(index);

        const renderer = this._renderers.get(item.type);
        if (renderer === undefined) {
            panic(`no renderer provided for the given type: ${item.type}`);
        }

        renderer.update(item.data, index, item.row.metadata, item.size);

        if (insertBefore) {
            this._listContainer.insertBefore(item.row.dom, insertBefore);
        } else {
            this._listContainer.appendChild(item.row.dom);
        }

        this._onInsertItemInDOM.fire({ item: item, index: index });
    }

    public removeItemInDOM(index: number): void {
        const item = assert(this._items[index]);

        if (item.row) {
            const renderer = this._renderers.get(item.type);

            // dispose internal data inside the renderer if needed
            renderer?.disposeData?.(item.data, index, item.row.metadata, item.size);
    
            this._cache.release(item.row);
            item.row = null;
        }

        this._onRemoveItemInDOM.fire({ item: item, index: index });
    }

    public setDomFocus(): void {
        /**
         * A boolean value indicating whether or not the browser should scroll 
         * the document to bring the newly-focused element into view.
         */
        this._element.focus({ preventScroll: true });
    }

    public setViewportSize(size: number): void {
        this._scrollable.setViewportSize(size);
    }

    public setScrollPosition(position: number): void {
        this._scrollable.setScrollPosition(position);
    }

    public getViewportSize(): number {
        return this._scrollable.getViewportSize();
    }

    public getScrollPosition(): number {
        return this._scrollable.getScrollPosition();
    }

    public getVisibleRange(): IRange {
        return this._visibleRange;
    }

    public getItem(index: number): T {
        if (index < 0 || index >= this._items.length) {
            panic(`invalid get item index: ${index}`);
        }
        return this._items[index]!.data;
    }

    public getItemIndex(item: T): number {
        return this._items.findIndex(eachItem => eachItem.data === item);
    }

    public getHTMLElement(index: number): HTMLElement | null {
        if (index < 0 || index >= this._items.length) {
            panic(`invalid get item index: ${index}`);
        }
        if (this._items[index]!.row) {
            return this._items[index]!.row!.dom;
        }
        return null;
    }

    public isItemVisible(index: number): boolean {
        return !!this.getHTMLElement(index);
    }
    
    public getItemHeight(index: number): number {
        const item = this.getItem(index);
        return this._itemProvider.getSize(item);
    }

    public getItemRenderTop(index: number): number {
        // FIX
        const itemTop = this.positionAt(index);
        const itemHeight = this.getItemHeight(index);
        
        const scrollTop = this._scrollable.getScrollPosition();
        const viewHeight = this._scrollable.getViewportSize();

        if (itemTop < scrollTop || itemTop + itemHeight > scrollTop + viewHeight) {
            return -1;
        }

        const rest = itemTop - scrollTop;
        return rest;
    }

    public getRenderIndex(actualIndex: number): number {
        const {start, end} = this.__getRenderRange(this._prevRenderTop, this._prevRenderHeight);
        if (actualIndex >= start && actualIndex < end) {
            return actualIndex - start;
        }
        return -1;
    }

    public positionAt(index: number): number {
        return this._rangeTable.positionAt(index);
    }

    public indexAt(position: number): number {
        return this._rangeTable.indexAt(position);
    }

    public indexAtVisible(visiblePosition: number): number {
        return this._rangeTable.indexAt(this._prevRenderTop + visiblePosition);
    }

    public indexAfter(position: number): number {
        return this._rangeTable.indexAfter(position);
    }

    public indexAfterVisible(visiblePosition: number): number {
        return this._rangeTable.indexAfter(this._prevRenderTop + visiblePosition);
    }

    public renderIndexAtVisible(visiblePosition: number): number | undefined {
        const topIndex = this._rangeTable.indexAt(this._scrollable.getScrollPosition());
        if (topIndex === -1) {
            return undefined;
        }

        const currIndex = this._rangeTable.indexAt(this._scrollable.getScrollPosition() + visiblePosition);
        if (currIndex === -1) {
            return undefined;
        }

        return currIndex - topIndex;
    }

    public indexFromEventTarget(target: EventTarget | null): number | undefined {
        if (target === null) {
            return undefined;
        }

        /**
         * Since the event target which triggered by an event might be the child
         * element of the actual row list, so we will trace back to the parent
         * until we find one.
         */
        let element = target as HTMLElement | null;

        while (element instanceof HTMLElement && // making sure when tracing up
               element !== this._listContainer && // will not be out of range.
               this._element.contains(element)
        ) {
            const stringIndex = element.getAttribute('index');
            if (stringIndex) {
                const index =  Number(stringIndex);
                if (isNaN(index) === false) {
                    return index;
                }
            }

            element = element.parentElement;
        }

        return undefined;
    }

    // [private helper methods]

    /**
     * @description Try to get the next element in the given range list.
     * @param ranges The range list.
     * @returns The next element in the range or null if the range already 
     * reaches the end.
     * 
     * @example Suppose the range table has range [0-100], the given range is 
     * [0-50], the 50th HTMLElement will be returned. Null will be returned if 
     * the given range is something like [x-100].
     */
    private __getNextElement(ranges: IRange[]): HTMLElement | null {
        if (ranges.length === 0) {
            return null;
        }

        const maxRange = Iterable.maxBy(ranges, range => range.end);
        if (!maxRange) {
            return null;
        }

        const nextItem = this._items[maxRange.end];

        if (!nextItem || !nextItem.row) {
            return null;
        }

        return nextItem.row.dom;
    }

    /**
     * @description Returns a range for rendering.
     * 
     * @note If render-top and render-height are not provided, returns a render 
     * range under the current scrollable status.
     * 
     * @returns A range for rendering.
     */
    private __getRenderRange(renderTop?: number, renderHeight?: number): IRange {
        const top = renderTop ?? this._scrollable.getScrollPosition();
        const height = renderHeight ?? this._scrollable.getViewportSize();
        return {
            start: this._rangeTable.indexAt(top),
            end: this._rangeTable.indexAfter(top + height - 1)
        };
    }

    /**
     * @description The auxiliary method for this.splice(). The actual splicing
     * process via this method.
     */
    private __splice(index: number, deleteCount: number, items: T[] = []): T[] {
        
        // find the range that about to be deleted
        const prevRenderRange = this.__getRenderRange(this._prevRenderTop, this._prevRenderHeight);
        const expectDeleteRange = { start: index, end: index + deleteCount };
        const actualDeleteRange = Range.intersection(prevRenderRange, expectDeleteRange);

        /**
         * We use a cache to store all the `row`s that are about to be removed.
         * When we do the insertion, we try to reuse these `row`s to improve 
         * efficiency.
         */
        const deleteCache = new Map<RendererType, IListViewRow[]>();
        for (let i = actualDeleteRange.start; i < actualDeleteRange.end; i++) {
            const item = assert(this._items[i]);

            if (!item.row) {
                continue;
            }

            let rowCache = deleteCache.get(item.type);
            if (rowCache === undefined) {
                rowCache = [];
                deleteCache.set(item.type, rowCache);
            }

            const renderer = this._renderers.get(item.type);
            if (renderer) {
                renderer.dispose(item.row.metadata);
            }

            rowCache.push(item.row);
            item.row = null;
        }

        // the rest range right after the deleted range
        const prevRestRange = { start: index + deleteCount, end: this._items.length };
        // in the rest range, find the rendered part
        const prevRestRenderedRange = Range.intersection(prevRestRange, prevRenderRange);
        // in the rest range, find the un-rendered part
        const prevRestUnrenderedRange = Range.relativeComplement(prevRenderRange, prevRestRange);

        // [delete and insert the items]

        // stores all the inserting items.
        const toInsert = items.map<IViewItem<T>>(item => ({
            data: item,
            type: this._itemProvider.getType(item),
            size: this._itemProvider.getSize(item),
            row: null,
        }));

        // actual deletion

        let waitToDelete: IViewItem<T>[];
        if (index === 0 && deleteCount >= this._items.length) {
            // special case: deletes all the items
            this._rangeTable = new RangeTable();
            this._rangeTable.splice(0, 0, toInsert);
            waitToDelete = this._items;
            this._items = toInsert;
        } else {
            // general case: deletes partial items
            this._rangeTable.splice(index, deleteCount, toInsert);
            waitToDelete = this._items.splice(index, deleteCount, ...toInsert);
        }
        
        // the index offset for the original items that after the newly inserted items
        const offset = items.length - deleteCount;

        // recalculate the render range (since we have modified the range table)
        const renderRange = this.__getRenderRange(this._prevRenderTop, this._prevRenderHeight);
        this._visibleRange = renderRange;

        // find the rest items that are still required rendering, we update them in DOM
        const restRenderedRange = Range.shift(prevRestRenderedRange, offset);
        const updateRange = Range.intersection(renderRange, restRenderedRange);
        for (let i = updateRange.start; i < updateRange.end; i++) {
            this.updateItemInDOM(i);
        }

        // find the rest items that does not require rendering anymore, we remove them from DOM
        const remove = Range.relativeComplement(renderRange, restRenderedRange);
        for (const range of remove) {
            for (let i = range.start; i < range.end; i++) {
                this.removeItemInDOM(i);
            }
        }

        /**
         * find the rest items that was not rendered, inserting new items in DOM 
         * if deleting more items than inserting new items, that is, `offset < 0`.
         * When inserting a new item into the DOM, we try to reuse a row cache 
         * from the previous deleted DOM elements.
         */
        const restUnrenderedRange = prevRestUnrenderedRange.map(range => Range.shift(range, offset));
        const elementsRange = { start: index, end: index + items.length };
		const insertRanges = [elementsRange, ...restUnrenderedRange].map(range => Range.intersection(renderRange, range));
        const beforeElement = this.__getNextElement(insertRanges);

        // insert the item into the DOM if needed.
        for (const range of insertRanges) {
			for (let i = range.start; i < range.end; i++) {
				const item = this._items[i]!;
				const rows = deleteCache.get(item.type);
				const row = rows?.pop();
				this.insertItemInDOM(i, beforeElement, row);
			}
		}

        // now we release all the deleted rows into caches.
		for (const rows of deleteCache.values()) {
			for (const row of rows) {
				this._cache.release(row);
			}
		}

        this._listContainer.style.height = `${this._rangeTable.size()}px`;
        this._scrollAnimate.request({});
        
        return waitToDelete.map(item => item.data);
    }

    private __updateScrollableGradientIndicator(e: IScrollEvent): void {
        const atTop = (e.scrollPosition === 0);
        const atBottom = (e.scrollPosition + e.viewportSize === e.scrollSize);
        this.DOMElement.style.setProperty('--nota-file-tree-gradient-top', atTop ? 'none' : 'block');
        this.DOMElement.style.setProperty('--nota-file-tree-gradient-bottom', atBottom ? 'none' : 'block');
    }
}
