import { IListWidget } from "src/base/browser/secondary/listWidget/listWidget";

/**
 * An interface that provides drag and drop support (dnd).
 */
export interface IListDragAndDropProvider<T> {

    /**
     * @description Returns the user-defined data from the given item.
     * @param item The given item.
     * @returns Returns in a string format or null if it does not support drag.
     */
    getDragData(item: T): string | null;

    /**
     * @description Returns the tag of the dragging items for displaying purpose.
     * @param items The dragging items.
     * @returns A string-form of tag.
     */
    getDragTag(items: T[]): string;

    /**
     * @description Invokes when {@link EventType.dragstart} starts.
     */
    onDragStart?(event: DragEvent): void;

    /**
     * @description Invokes when {@link EventType.dragover} happens. It should 
     * returns a boolean indicates if allowed to drop the current selected items
     * on the target.
     * @param event The current drag event.
     * @param currentDragItems The current dragging items.
     * @param targetOver The list target of the current drag event.
     * @param targetIndex The index of the list target of the current drag event.
     */
    onDragOver?(event: DragEvent, currentDragItems: T[], targetOver?: T, targetIndex?: number): boolean;
}

/**
 * A special interface for {@link IListWidget} usage.
 */
export interface IListWidgetDragAndDropProvider<T> extends IListDragAndDropProvider<T> {
    
    /**
     * @description Returns all the currently dragging items.
     * @param currItem The current mouse dragging (holding) item.
     */
    getDragItems(currItem: T): T[];
}

/**
 * @class A wrapper class for {@link IListWidget}.
 * @wran DO NOT USE DIRECTLY.
 */
export class ListWidgetDragAndDropProvider<T> implements IListWidgetDragAndDropProvider<T> {

    private view: IListWidget<T>;
    private dnd: IListDragAndDropProvider<T>;

    constructor(view: IListWidget<T>, dnd: IListDragAndDropProvider<T>) {
        this.view = view;
        this.dnd = dnd;
    }

    public getDragItems(currItem: T): T[] {
        const selected = this.view.getSelectedItems();
        if (selected.length > 0) {
            return selected;
        }
        return [currItem];
    }

    public getDragData(item: T): string | null {
        return this.dnd.getDragData(item);
    }

    public getDragTag(items: T[]): string {
        return this.dnd.getDragTag(items);
    }

    public onDragStart(event: DragEvent): void {
        if (this.dnd.onDragStart) {
            this.dnd.onDragStart(event);
        }
    }

    public onDragOver(event: DragEvent, currentDragItems: T[], targetOver?: T, targetIndex?: number): boolean {
        if (this.dnd.onDragOver) {
            return this.dnd.onDragOver(event, currentDragItems, targetOver, targetIndex);
        }
        return false;
    }
}