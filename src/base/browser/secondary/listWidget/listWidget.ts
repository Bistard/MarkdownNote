import { IListViewRenderer, PipelineRenderer } from "src/base/browser/secondary/listView/listRenderer";
import { IListViewOpts, IViewItemChangeEvent, ListError, ListView } from "src/base/browser/secondary/listView/listView";
import { IListTraitEvent, ListTrait, ListTraitRenderer } from "src/base/browser/secondary/listWidget/listTrait";
import { DisposableManager, IDisposable } from "src/base/common/dispose";
import { addDisposableListener, EventType } from "src/base/common/dom";
import { Event, Register, SignalEmitter } from "src/base/common/event";
import { IScrollEvent } from "src/base/common/scrollable";
import { IListItemProvider } from "../listView/listItemProvider";


/**
 * A standard mouse event interface used in {@link ListWidget}.
 */
export interface IListMouseEvent<T> {
    /** The original brower event {@link MouseEvent}. */
    browserEvent: MouseEvent,

    /** The index of the clicked item. */
    index: number,

    /** The clicked item. */
    item: T,

    /** The position (top) relatives to the viewport. */
    top: number;
}

export interface IListDragEvent<T> {
    /** The original brower event {@link DragEvent}. */
    browserEvent: DragEvent;

    /** The index of the drag / dragover / drop item. */
    index: number;
    
    /** The drag / dragover / drop item. */
    item: T;
}

/**
 * The consturtor options for {@link ListWidget}.
 */
export interface IListWidgetOpts extends IListViewOpts {
    dragAndDropSupport: boolean
}

/**
 * The interface for {@link ListWidget}.
 */
export interface IListWidget<T> extends IDisposable {
    
    // [events / getter]
    
    length: number;
    onDidScroll: Register<IScrollEvent>;
    onDidChangeFocus: Register<boolean>;
    onDidChangeItemFocus: Register<IListTraitEvent>;
    onDidChangeItemSelection: Register<IListTraitEvent>;
    onClick: Register<IListMouseEvent<T>>;
    onDoubleclick: Register<IListMouseEvent<T>>;
    onMouseover: Register<IListMouseEvent<T>>;
    onMouseout: Register<IListMouseEvent<T>>;
    onMousedown: Register<IListMouseEvent<T>>;
    onMouseup: Register<IListMouseEvent<T>>;
    onMousemove: Register<IListMouseEvent<T>>;

    // [methods]

    splice(index: number, deleteCount: number, items: T[]): T[];

    // [item traits support]

    toggleFocus(index: number): void;

    toggleSelection(index: number): void;
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

    private selected: ListTrait;
    private focused: ListTrait;

    // [constructor]

    constructor(
        container: HTMLElement,
        renderers: IListViewRenderer<any>[],
        itemProvider: IListItemProvider<T>, 
        opts: IListWidgetOpts
    ) {
        this.disposables = new DisposableManager();

        // initializes all the item traits
        this.selected = new ListTrait('selected');
        this.focused = new ListTrait('focused');

        // integrates all the renderers
        const baseRenderers = [new ListTraitRenderer(this.selected), new ListTraitRenderer(this.focused)];
        renderers = renderers.map(renderer => new PipelineRenderer(renderer.type, [...baseRenderers, renderer]));
        
        // construct list view
        this.view = new ListView(container, renderers, itemProvider, opts);

        if (opts.dragAndDropSupport) {
            this.__enableDragAndDropSupport();
        }

        this.disposables.register(this.view);
    }

    // [getter / setter]

    get length(): number { return this.view.length; }

    get onDidScroll(): Register<IScrollEvent> { return this.view.onDidScroll; }
    get onDidChangeFocus(): Register<boolean> { return this.disposables.register(new SignalEmitter<boolean, boolean>([Event.map(this.view.onDidFocus, () => true), Event.map(this.view.onDidBlur, () => false)], (e: boolean) => e)).registerListener; }
    get onDidChangeItemFocus(): Register<IListTraitEvent> { return this.focused.onDidChange; }
    get onDidChangeItemSelection(): Register<IListTraitEvent> { return this.selected.onDidChange; }

    get onClick(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onClick, (e: MouseEvent) => this.__toListMouseEvent(e)); }    
    get onDoubleclick(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onDoubleclick, (e: MouseEvent) => this.__toListMouseEvent(e));  }    
    get onMouseover(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMouseover, (e: MouseEvent) => this.__toListMouseEvent(e)); }    
    get onMouseout(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMouseout, (e: MouseEvent) => this.__toListMouseEvent(e)); }    
    get onMousedown(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMousedown, (e: MouseEvent) => this.__toListMouseEvent(e)); }    
    get onMouseup(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMouseup, (e: MouseEvent) => this.__toListMouseEvent(e)); }    
    get onMousemove(): Register<IListMouseEvent<T>> { return Event.map<MouseEvent, IListMouseEvent<T>>(this.view.onMousemove, (e: MouseEvent) => this.__toListMouseEvent(e)); }
    
    // [methods]

    public dispose(): void {
        this.disposables.dispose();
    }

    public splice(index: number, deleteCount: number, items: T[] = []): T[] {
        if (index < 0 || index > this.view.length) {
            throw new ListError(`splice invalid start index: ${index}`);
        }

        if (deleteCount < 0) {
            throw new ListError(`splice invalid deleteCount: ${deleteCount}`);
        }

        if (deleteCount === 0 && items.length === 0) {
            return [];
        }

        return this.view.splice(index, deleteCount, items);
    }

    // [item traits support]

    public toggleFocus(index: number): void {
        this.__indexValidity(index);

        const element = this.view.getElement(index);
        
        // unfocused the current item
        if (this.focused.size() === 1) {
            const currIndex = this.focused.items()[0]!;

            if (currIndex === index) return;

            const currElement = this.view.getElement(currIndex);
            this.focused.unset(currIndex, currElement, false); // prevent fire twice
        }
        // focus the new item
        this.focused.set(index, element);
    }

    public toggleSelection(index: number): void {
        this.__indexValidity(index);

        const element = this.view.getElement(index);

        if (this.selected.has(index) === true) {
            this.selected.unset(index, element, false); // prevent fire twice
            return;
        }

        this.selected.set(index, element);
    }

    // [private helper methods]

    /**
     * @description A simple helper to test index validity in {@link ListView}.
     * @param index The given index of the item.
     */
    private __indexValidity(index: number): void {
        if (index < 0 || index >= this.view.length) {
            throw new ListError(`invalid index: ${index}`);
        }
    }

    /**
     * @description A mapper function to convert the brower event to our 
     * standard list mouse event.
     * @param e The original mouse event.
     * @returns A new standard {@link IListMouseEvent}.
     */
    private __toListMouseEvent(e: MouseEvent): IListMouseEvent<T> {
        const index = this.view.renderIndexAt(e.clientY);
        const item = this.view.getItem(index);
        const viewportTop = this.view.getItemRenderTop(index);
        return {
            browserEvent: e,
            index: index,
            item: item,
            top: viewportTop
        };
    }

    /**
     * @description Enables the drag and drop (dnd) support in {@link ListView}.
     */
    private __enableDragAndDropSupport(): void {

        this.disposables.register(addDisposableListener(this.view.DOMelement, EventType.dragover, e => this.__onDragOver(this.__getDragEvent(e))));
        this.disposables.register(addDisposableListener(this.view.DOMelement, EventType.drop, e => this.__onDrop(this.__getDragEvent(e))));
        this.disposables.register(addDisposableListener(this.view.DOMelement, EventType.dragleave, e => this.__onDragleave(this.__getDragEvent(e))));
        this.disposables.register(addDisposableListener(this.view.DOMelement, EventType.dragend, e => this.__onDragend(this.__getDragEvent(e))));

        this.view.onInsertItemInDOM((viewItem: IViewItemChangeEvent<T>) => {
            const item = viewItem.item;
            item.draggable?.dispose();
            item.row!.dom.draggable = true;
            item.draggable = addDisposableListener(item.row!.dom, EventType.dragstart, (e: DragEvent) => {
                console.log(e);
            });
        });

        this.view.onRemoveItemInDOM((viewItem: IViewItemChangeEvent<T>) => {
            viewItem.item.draggable?.dispose();
        });

    }

    /**
     * @description Transforms a {@link DragEvent} into {@link IListDragEvent}.
     * @param event 
     */
    private __getDragEvent(event: DragEvent): IListDragEvent<T> {
        const index = this.view.renderIndexAt(event.clientY);
        const item = this.view.getItem(index);
        return {
            browserEvent: event,
            index: index, 
            item: item
        }
    }

    // TODO:
    private __onDragOver(event: IListDragEvent<T>): void {
        console.log('dragover, ', event);
    }

    // TODO:
    private __onDrop(event: IListDragEvent<T>): void {
        console.log('drop, ', event);
    }

    // TODO:
    private __onDragleave(event: IListDragEvent<T>): void {
        console.log('dragleave, ', event);
    }

    // TODO:
    private __onDragend(event: IListDragEvent<T>): void {
        console.log('dragend, ', event);
    }

}
