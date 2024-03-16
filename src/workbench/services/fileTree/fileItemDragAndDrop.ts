import { DragOverEffect, IDragOverResult, IListDragAndDropProvider } from "src/base/browser/secondary/listWidget/listWidgetDragAndDrop";
import { URI } from "src/base/common/files/uri";
import { FuzzyScore } from "src/base/common/fuzzy";
import { Scheduler, delayFor } from "src/base/common/utilities/async";
import { Mutable } from "src/base/common/utilities/type";
import { FileItem } from "src/workbench/services/fileTree/fileItem";
import { IFileTree } from "src/workbench/services/fileTree/fileTree";
import { IFileService } from "src/platform/files/common/fileService";
import { ILogService } from "src/base/common/logger";
import { Time } from "src/base/common/date";
import { Disposable, IDisposable, toDisposable } from "src/base/common/dispose";
import { INotificationService } from "src/workbench/services/notification/notificationService";
import { DomUtility } from "src/base/browser/basic/dom";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { FileSortType, IFileTreeSorter } from "src/workbench/services/fileTree/fileTreeSorter";
import { Reactivator } from "src/base/common/utilities/function";
import { IS_MAC } from "src/base/common/platform";
import { assert } from "src/base/common/utilities/panic";
import { WorkbenchConfiguration } from "src/workbench/services/workbench/configuration.register";
import { IFileTreeService } from "src/workbench/services/fileTree/treeService";
import { ICommandService } from "src/platform/command/common/commandService";
import { AllCommands } from "src/workbench/services/workbench/commandList";
import { IWorkbenchService } from "src/workbench/services/workbench/workbenchService";
import { WorkbenchContextKey } from "src/workbench/services/workbench/workbenchContextKeys";
import { ClipboardType, IClipboardService } from "src/platform/clipboard/common/clipboard";

/**
 * @class A type of {@link IListDragAndDropProvider} to support drag and drop
 * for {@link FileTree}.
 */
export class FileItemDragAndDropProvider extends Disposable implements IListDragAndDropProvider<FileItem> {

    // [field]

    /** make sure {@link bindWithTree} is called before access. */
    private readonly _tree!: IFileTree<FileItem, FuzzyScore>;

    private static readonly EXPAND_DELAY = Time.ms(500);
    private readonly _pendingExpand: Scheduler<{ item: FileItem, index: number; }>;

    /**
     * Storing the previous 'onDragOver' state for performance and logic 
     * handling purpose.
     */
    private readonly _prevDragOverState: { 
        event?: DragEvent,                           // previous event for later comparsion usage
        handledByInsertion: IInsertionResult | null, // is handled by row insertion previously
        isDroppable: boolean,                        // the previous droppability
    };

    /**
     * An executor specifically for hovering handle logic
     */
    private readonly _hoverController: Reactivator;
    
    /**
     * An executor for row insertion handle logic
     */
    private _insertionController?: RowInsertionController;
    private readonly _sorter: IFileTreeSorter<FileItem>;

    // [constructor]

    constructor(
        sorter: IFileTreeSorter<FileItem>,
        @ILogService private readonly logService: ILogService,
        @IFileService private readonly fileService: IFileService,
        @IFileTreeService private readonly fileTreeService: IFileTreeService,
        @INotificationService private readonly notificationService: INotificationService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @ICommandService private readonly commandService: ICommandService,
        @IWorkbenchService private readonly workbenchService: IWorkbenchService,
        @IClipboardService private readonly clipboardService: IClipboardService,
    ) {
        super();
        this._sorter = sorter;
        this._prevDragOverState = { event: undefined, handledByInsertion: null, isDroppable: true };
        this._pendingExpand = this.__register(
            new Scheduler(FileItemDragAndDropProvider.EXPAND_DELAY, async event => {
                const { item } = event[0]!;
                await this._tree.expand(item);
                
                /**
                 * @hack A brief pause to ensure the rendering triggered by the 
                 * `expand` operation has fully completed.
                 */
                await delayFor(Time.ms(10), () => this._tree.setHover(item, true));
            })
        );

        // controller initialization
        this._hoverController = new Reactivator();
        this.__initInsertionController();
    }

    // [public methods]

    public getDragData(item: FileItem): string | null {
        return URI.toString(item.uri);
    }

    public getDragTag(items: FileItem[]): string {
        if (items.length === 1) {
            return items[0]!.name;
        }
        return String(`Total ${items.length} selections`);
    }

    public onDragStart(event: DragEvent): void {
        
    }

    public onDragEnter(event: DragEvent, currentDragItems: FileItem[], targetOver?: FileItem, targetIndex?: number): void {
        this._hoverController.reactivate();
    }

    public onDragLeave(event: DragEvent, currentDragItems: FileItem[], targetOver?: FileItem, targetIndex?: number): void {

        /**
         * Since the leaving target is not the tree. That means the user is 
         * dragging from outside.
         */
        if (event.target !== this._tree.DOMElement) {
            return;
        }

        if (!targetOver || targetIndex === undefined) {
            this._pendingExpand.cancel(true);
            return;
        }
    }

    public onDragOver(event: DragEvent, currentDragItems: FileItem[], targetOver?: FileItem | undefined, targetIndex?: number | undefined): IDragOverResult {

        // good perf
        const prevResult = this.__isDragOverUnchanged(event);
        if (prevResult !== undefined) {
            return { allowDrop: prevResult };
        }
        
        const droppable = this.__isDroppable(event, currentDragItems, targetOver) as Mutable<IDragOverResult>;
        this._prevDragOverState.isDroppable = droppable.allowDrop;

        // derender every single time
        this._insertionController?.derender();
        this.__derenderDropOnRootEffect();

        /**
         * Row insertion need to be checked on every single 'onDragOver'.
         */
        const insertionResult = this._insertionController?.attemptInsert(event, targetIndex);
        if (insertionResult) {
            this._prevDragOverState.handledByInsertion = insertionResult;

            /**
             * Clean the possible hovering effect which remained by the previous
             * 'onDragOver'. Avoid having 'row insertion' and 'hover' effect at
             * the same time.
             */
            this._pendingExpand.cancel(true);
            if (this._tree.getHover().length > 0) {
                this._tree.setHover(null);
            }

            droppable.allowDrop = true;
            return droppable;
        }

        if (!droppable.allowDrop) {
            return { allowDrop: false };
        }

        /**
         * Reactivates the hover handler if drag over is no longer handled by 
         * row insertion, ensuring hover effects can be applied again based on 
         * the new context.
         * 
         * Especially after a transition from a row insertion operation back to 
         * a standard drag over state where the item is not being inserted 
         * between rows.
         */
        if (this._prevDragOverState.handledByInsertion) {
            this._hoverController.reactivate();
        }
        this._prevDragOverState.handledByInsertion = null;

        // special case: drop on root
        const dropOnRoot = this.__isDropOnRoot(targetOver);
        if (dropOnRoot) {
            return droppable;
        }

        // Since not dropping on the root, it is not allow to drop on no targets.
        if (!targetOver || targetIndex === undefined) {
            this._prevDragOverState.isDroppable = false;
            return { allowDrop: false };
        }

        /**
         * Hovering check do not need to be checked on every single 'onDragOver'. 
         * Only needed after every `onDragEnter`.
         */
        this._hoverController.execute(() => {

            // the target is not collapsible (file)
            if (!this._tree.isCollapsible(targetOver)) {
                this._pendingExpand.cancel(true);
    
                if (targetOver.parent && !targetOver.parent.isRoot()) {
                    this._tree.setHover(targetOver.parent, true);
                }
    
                return;
            }
    
            // the target is collapsed thus it requies a delay of expanding
            if (this._tree.isCollapsed(targetOver)) {
                this._tree.setHover(targetOver, false);
                this._pendingExpand.schedule({ item: targetOver, index: targetIndex }, true);
                return;
            }
    
            // the target is already expanded
            this._pendingExpand.cancel(true);
            this._tree.setHover(targetOver, true);
        });

        return droppable;
    }

    public async onDragDrop(event: DragEvent, currentDragItems: FileItem[], targetOver?: FileItem | undefined, targetIndex?: number | undefined): Promise<void> {
        const confirmDragAndDrop = this.configurationService.get<boolean>(WorkbenchConfiguration.ExplorerConfirmDragAndDrop, true);

        /**
         * 'row insertion' drop handling logic
         */
        if (this._prevDragOverState.handledByInsertion) {
            if (confirmDragAndDrop) {
                await this.__confirmDragAndDrop();
            }
            
            await this.__performDropInsertion(event, currentDragItems, targetOver, targetIndex);
            return;
        }

        /**
         * 'general hovering' drop handling logic
         */
        
        if (!targetOver) {
            targetOver = this.fileTreeService.rootItem!;
        }

        if (targetOver.isFile()) {
            targetOver = assert(targetOver.parent);
        }

        // expand folder immediately when drops
        this._pendingExpand.cancel(true);
        if (!targetOver.isRoot() && this._tree.isCollapsible(targetOver)) {
            await this._tree.expand(targetOver);
        }

        if (confirmDragAndDrop) {
            await this.__confirmDragAndDrop();
        }

        const operation = __isCopyOperation(event) 
            ? this.__performDropCopy
            : this.__performDropMove;
        await operation.call(this, currentDragItems, targetOver, targetIndex);
    }

    public onDragEnd(event: DragEvent): void {
        this._pendingExpand.cancel(true);
        
        this._dragOnRootDisposable.dispose();
        this._hoverController.deactivate();
        this._insertionController?.derender();
    }

    public override dispose(): void {
        super.dispose();
        this._insertionController?.dispose();
    }

    // [public helper methods]

    public bindWithTree(tree: IFileTree<FileItem, FuzzyScore>): void {
        (<Mutable<typeof tree>>this._tree) = tree;
        this._insertionController?.bindWithTree(tree);
    }

    // [private helper methods]

    private __initInsertionController(): void {
        
        // only enable insertion indicator during custom sortering
        const setIndicatorBy = (order: FileSortType) => {
            if (order === FileSortType.Custom) {
                this._insertionController ??= new RowInsertionController();
            } else {
                this._insertionController?.dispose();
                this._insertionController = undefined;
            }
        };

        // init
        const sortOrder = this.configurationService.get<FileSortType>(WorkbenchConfiguration.ExplorerFileSortType);
        setIndicatorBy(sortOrder);

        // configuration self update
        this.configurationService.onDidConfigurationChange(e => {
            if (!e.match(WorkbenchConfiguration.ExplorerFileSortType)) {
                return;
            }
            const newSortOrder = this.configurationService.get<FileSortType>(WorkbenchConfiguration.ExplorerFileSortType);
            setIndicatorBy(newSortOrder);
        });
    }

    /**
     * @description Checks if the dragover event's position remains unchanged. 
     * Returns the previous droppability status if unchanged; otherwise, returns 
     * `undefined` to signal a position change.
     */
    private __isDragOverUnchanged(event: DragEvent): boolean | undefined {
        const prevEvent = this._prevDragOverState.event;
        if (!prevEvent) {
            return undefined;
        }
        
        // those variables are key to identify whether the event is unchanged.
        if (prevEvent.x === event.clientX &&
            prevEvent.y === event.clientY && 
            prevEvent.ctrlKey === prevEvent.ctrlKey &&
            prevEvent.altKey === prevEvent.altKey
        ) {
            return this._prevDragOverState.isDroppable;
        }
        
        // changed
        this._prevDragOverState.event = event;
        return undefined;
    }

    private __isDroppable(event: DragEvent, currentDragItems: FileItem[], targetOver?: FileItem): IDragOverResult {

        // dropping on no targets, meanning we are dropping at the parent.
        if (!targetOver) {
            targetOver = assert(this.fileTreeService.rootItem);
        }

        /**
         * Since we are dropping to a file, it can be treated as essentially 
         * dropping at its parent directory.
         */
        if (targetOver.isFile()) {
            return this.__isDroppable(event, currentDragItems, targetOver.parent ?? undefined);
        }

        // copy operation is always allowed
        if (__isCopyOperation(event)) {
            return { allowDrop: true, effect: DragOverEffect.Copy };
        }

        /**
         * Either following case cannot perform drop operation if ONE of the 
         * selecting item is:
         *  - dropping to itself.
         *  - dropping to its direct parent.
         *  - dropping to its child folder.
         */
        const anyCannotDrop = currentDragItems.some(dragItem => {
            const destination = URI.join(targetOver.uri, dragItem.name);
            return dragItem === targetOver
                || URI.equals(dragItem.uri, destination)
                || URI.isParentOf(targetOver.uri, dragItem.uri)
            ;
        });

        return { allowDrop: !anyCannotDrop, effect: DragOverEffect.Move };
    }

    /**
     * @description Special handling: drop entire tree animation
     */
    private _dragOnRootDisposable: IDisposable = Disposable.NONE;
    
    private __derenderDropOnRootEffect(): void {
        this._dragOnRootDisposable.dispose();
    }
    
    private __isDropOnRoot(targetOver?: FileItem): boolean {
        this.__derenderDropOnRootEffect();

        const dropAtEmpty = !targetOver;
        const dropAtRootDirectChild = targetOver && targetOver.parent?.isRoot();
        const ensureTargetIsNotDir = targetOver && !this._tree.isCollapsible(targetOver);

        if (dropAtEmpty || (dropAtRootDirectChild && ensureTargetIsNotDir)) {
            this._tree.DOMElement.classList.add('on-drop-target');
            this._dragOnRootDisposable = toDisposable(() => {
                this._tree.DOMElement.classList.remove('on-drop-target');
            });
            return true;
        }

        return false;   
    }

    private async __confirmDragAndDrop(): Promise<void> {
        // TODO
    }

    private async __performDropInsertion(event: DragEvent, currentDragItems: FileItem[], targetOver?: FileItem, targetIndex?: number): Promise<void> {
        assert(this._sorter.sortType === FileSortType.Custom);
        const insertionResult = assert(this._prevDragOverState.handledByInsertion);
        
        // If no specific target is given, insert at the end within the root item.
        if (!targetOver) {
            targetOver = this.fileTreeService.rootItem!;
            await this.__performDropMove(currentDragItems, targetOver, targetIndex);
            return;
        }

        /**
         * Determine the appropriate insertion point for the currently dragging
         * items based on the current insertion:
         *      - If inserting above the 'targetOver', move to a position that 
         *          above it.
         *      - If inserting below the 'targetOver', the moving destination is
         *        simly 'targetOver'.
         */
        const targetAbove = (() => {
            if (insertionResult.near === 'bottom') {
                return targetOver;
            } else {
                const aboveItemIdx = this._tree.getItemIndex(targetOver) - 1;
                return (aboveItemIdx === -1) ? targetOver : this._tree.getItem(aboveItemIdx);
            }
        })();
        let resolvedIdx = this.fileTreeService.getItemIndex(targetAbove) + 1;

        /** 
         * `resolvedDir` determines the target directory for pasting:
         *   1. If `targetAbove` is a directory and expanded, `resolvedDir` 
         *      is set to `targetAbove`, making it as the parent for pasted 
         *      items.
         * 
         *   2. If `targetAbove` is a directory but collapsed, or if 
         *      `targetAbove` is not a directory, `resolvedDir` is set to 
         *      the parent of `targetAbove`.
         */
        const isExpanedDir = targetAbove.isDirectory() && !this.fileTreeService.isCollapsed(targetAbove);
        const resolvedDir = isExpanedDir
            ? targetAbove
            : assert(targetAbove.parent);
        
        // inserting at the first children
        if (isExpanedDir) {
            resolvedIdx = 0;
        }

        // tell the program we are doing insertion

        this.workbenchService.updateContext(WorkbenchContextKey.fileTreeOnInsertKey, true);
        this.fileTreeService.simulateSelectionCutOrCopy(__isCutOperation(event));
        
        await this.clipboardService.write(ClipboardType.Arbitrary, currentDragItems, 'dndInsertionItems');
        await this.commandService.executeCommand(AllCommands.filePaste, resolvedDir, resolvedIdx, currentDragItems.map(item => item.uri));

        // make sure the insert finishes no matter what
        this.workbenchService.updateContext(WorkbenchContextKey.fileTreeOnInsertKey, false);
    }

    private async __performDropCopy(currentDragItems: FileItem[], targetOver: FileItem, targetIndex?: number): Promise<void> {

        // simulate drop action (copy) as copy, so that we can able to paste.
        this.fileTreeService.simulateSelectionCutOrCopy(false);
        await this.commandService.executeCommand(AllCommands.filePaste, targetOver, targetIndex ?? 0, currentDragItems.map(item => item.uri));
    }
    
    private async __performDropMove(currentDragItems: FileItem[], targetOver: FileItem, targetIndex?: number): Promise<void> {
        
        // simulate drop action (move) as cut, so that we can able to paste.
        this.fileTreeService.simulateSelectionCutOrCopy(true);
        await this.commandService.executeCommand(AllCommands.filePaste, targetOver, targetIndex ?? 0, currentDragItems.map(item => item.uri));
    }
}

function __isCopyOperation(event: DragEvent): boolean {
    return (event.ctrlKey && !IS_MAC) || (event.altKey && IS_MAC);
}

function __isCutOperation(event: DragEvent): boolean {
    return !__isCopyOperation(event);
}

interface IInsertionResult {
    
    /**
     * Is the insertion near the top or bottom of the target.
     */
    readonly near: 'top' | 'bottom';

    /** 
     * Where should the insertion be rendered. 
     */
    readonly renderTop: number;
}

/**
 * @internal
 * @class Specifically for handling row insertion handling logic.
 */
class RowInsertionController extends Disposable {

    // [fields]

    private readonly _tree!: IFileTree<FileItem, FuzzyScore>;
    
    /** The dom element for row insertion displaying */
    private _rowDisposable: IDisposable;
        
    // [constructor]

    constructor() {
        super();
        this._rowDisposable = Disposable.NONE;
    }

    public bindWithTree(tree: IFileTree<FileItem, FuzzyScore>): void {
        (<Mutable<typeof tree>>this._tree) = tree;
    }

    public override dispose(): void {
        super.dispose();
        this._rowDisposable.dispose();
    }

    // [public methods]

    public derender(): void {
        this.__derender();
    }
    
    /**
     * @description Returns a result type indicates the attemptation successed,
     * otherwise return false.
     */
    public attemptInsert(event: DragEvent, targetIndex: number | undefined): IInsertionResult | false {
        this.__derender();

        const result = this.__isInsertionApplicable(event, targetIndex);
        if (result) {
            this.__renderInsertionAt(result);
            return result;
        }

        return false;
    }

    // [private helper methods]

    private __derender(): void {
        this._rowDisposable.dispose();
    }

    private __isInsertionApplicable(event: DragEvent, targetIndex: number | undefined): IInsertionResult | undefined {
        if (targetIndex === undefined) {
            return undefined;
        }

        const index = targetIndex;

        const currentItemTop = this._tree.getItemRenderTop(index);        
        const currentItemBottom = currentItemTop + this._tree.getItemHeight(index);

        const mouseY = event.clientY - DomUtility.Attrs.getViewportTop(this._tree.DOMElement);
        
        const thershold = 10;
        const isNearTop = Math.abs(mouseY - currentItemTop) <= thershold;
        const isNearBot = Math.abs(mouseY - currentItemBottom) <= thershold;

        if (!isNearTop && !isNearBot) {
            return undefined;
        }

        const renderTop = isNearTop ? currentItemTop : currentItemBottom;
        return {
            near: isNearTop ? 'top' : 'bottom',
            renderTop: renderTop - 2,
        };
    }

    private __renderInsertionAt(result: IInsertionResult | undefined): void {
        if (!result) {
            return;
        }
        
        // rendering
        const insertionElement = document.createElement('div');
        insertionElement.className = 'row-insertion';
        insertionElement.style.top = `${result.renderTop}px`;
        this._tree.DOMElement.appendChild(insertionElement);

        this._rowDisposable = toDisposable(() => {
            insertionElement.remove();
        });
    }
}