import "src/workbench/services/fileTree/media.scss";
import { IListItemProvider } from "src/base/browser/secondary/listView/listItemProvider";
import { AsyncTree, AsyncTreeWidget, IAsyncTree, IAsyncTreeOptions, IAsyncTreeWidgetOpts } from "src/base/browser/secondary/tree/asyncTree";
import { MultiTreeKeyboardController } from "src/base/browser/secondary/tree/multiTree";
import { ITreeMouseEvent, ITreeNode } from "src/base/browser/secondary/tree/tree";
import { ITreeListRenderer } from "src/base/browser/secondary/tree/treeListRenderer";
import { Emitter, Register } from "src/base/common/event";
import { IStandardKeyboardEvent } from "src/base/common/keyboard";
import { FileItem } from "src/workbench/services/fileTree/fileItem";
import { LogLevel } from "src/base/common/logger";
import { Dictionary, isTruthy } from "src/base/common/utilities/type";
import { HoverBox } from "src/base/browser/basic/hoverBox/hoverBox";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { DirectionX } from "src/base/browser/basic/dom";
import { ILayoutService } from "src/workbench/services/layout/layoutService";
import { UnbufferedScheduler } from "src/base/common/utilities/async";
import { Time } from "src/base/common/date";

export interface IFileTreeOpenEvent<T extends FileItem> {
    readonly item: T;
}

/** 
 * Option for constructing a {@link FileTree}. 
 */
export interface IFileTreeOptions<T extends FileItem, TFilter> extends IAsyncTreeOptions<T, TFilter> { }

/** 
 * Option for constructing a {@link FileTreeWidget}. 
 */
export interface IFileTreeWidgetOpts<T extends FileItem, TFilter> extends IAsyncTreeWidgetOpts<T, TFilter> {
    readonly asyncTree: IFileTree<T, TFilter>;
}

/**
 * @internal
 */
export class FileTreeKeyboardController<T extends FileItem, TFilter> extends MultiTreeKeyboardController<T, TFilter> {

    // [field]

    declare protected readonly _view: FileTreeWidget<T, TFilter>;
    declare protected readonly _tree: FileTree<T, TFilter>;

    // [constructor]

    constructor(
        view: FileTreeWidget<T, TFilter>,
        tree: IFileTree<T, TFilter>,
    ) {
        super(view, tree);
    }

    // [protected override methods]

    protected override __onEnter(e: IStandardKeyboardEvent): void {
        super.__onEnter(e);

        const anchor = this._tree.getAnchor();
        if (!anchor) {
            return;
        }

        if (anchor.isDirectory()) {
            return;
        }

        this._tree.select(anchor);
    }
}

/**
 * @class Used to override and add additional controller behaviors.
 */
export class FileTreeWidget<T extends FileItem, TFilter> extends AsyncTreeWidget<T, TFilter> {

    protected override __createKeyboardController(opts: IFileTreeWidgetOpts<T, TFilter>): FileTreeKeyboardController<T, TFilter> {
        return new FileTreeKeyboardController(this, opts.asyncTree);
    }
}

/**
 * An interface only for {@link FileTree}.
 */
export interface IFileTree<T extends FileItem, TFilter> extends IAsyncTree<T, TFilter> {

    /**
     * Fires when a file/dir in the explorer tree is about to be opened.
     */
    readonly onSelect: Register<IFileTreeOpenEvent<T>>;

    /**
     * @description Programmatically select an item. 
     *      - If the item is visible, the item will be focused and selected.
     *      - If the item is invisible, the item will be revealed first.
     * @note Will reveal to the item if not visible (not rendered).
     */
    select(item: T): void;
}

export class FileTree<T extends FileItem, TFilter> extends AsyncTree<T, TFilter> implements IFileTree<T, TFilter> {

    // [event]

    private readonly _onSelect = this.__register(new Emitter<IFileTreeOpenEvent<T>>());
    public readonly onSelect = this._onSelect.registerListener;

    // [field]

    private readonly _hoverItem: UnbufferedScheduler<T | undefined>;

    // [constructor]

    constructor(
        container: HTMLElement,
        rootData: T,
        opts: IFileTreeOptions<T, TFilter>,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @ILayoutService private readonly layoutService: ILayoutService,
    ) {
        opts.log?.(LogLevel.DEBUG, 'FileTree', 'FileTree constructing with options:', null, __logFileTreeOptions(opts));
        super(container, rootData, opts);
        this.DOMElement.classList.add('file-tree');
        this._hoverItem = this.__register(new UnbufferedScheduler(Time.sec(0.5), data => this.__onItemHover(data)));
        this.__registerListeners();
    }

    // [public methods]

    public select(item: T): void {
        if (!this.isItemVisible(item)) {
            this.reveal(item);
        }

        this.setFocus(item);
        this.setSelections([item]);

        this._onSelect.fire({ item: item });
    }

    // [protected override method]

    protected override __createTreeWidget(container: HTMLElement, renderers: ITreeListRenderer<T, TFilter, any>[], itemProvider: IListItemProvider<ITreeNode<T, TFilter>>, opts: IFileTreeWidgetOpts<T, TFilter>): FileTreeWidget<T, TFilter> {
        return new FileTreeWidget<T, TFilter>(container, renderers, itemProvider, opts);
    }

    // [private helper method]

    private __registerListeners(): void {
        
        // trigger clicking
        this.__register(this.onClick(e => this.__onClick(e)));

        // blur effect for selections
        this.__register(this.onDidChangeFocus(isFocused => {
            this.DOMElement.classList.toggle('blurred', !isFocused);
        }));

        // hover item delay
        this.__register(this.onDidChangeItemHover(e => {
            this._hoverItem.schedule(e.data[0]);
        }));
    }

    private __onClick(event: ITreeMouseEvent<T>): void {
        // clicking no where
        if (event.data === null) {
            return;
        }

        if (event.browserEvent.shiftKey || event.browserEvent.ctrlKey) {
            return;
        }

        if (event.data.isDirectory()) {
            return;
        }

        this._onSelect.fire({ item: event.data });
    }

    private __onItemHover(data?: T): void {
        if (!data) {
            return;
        }

        const target = this.getHTMLElement(this.getItemIndex(data));
        if (!target) {
            return;
        }

        const hoverBox = this.instantiationService.createInstance(
            HoverBox, 
            { 
                target: target, 
                text: data.basename, 
                position: { hoverPosition: DirectionX.Right }
            }
        );

        const element = document.createElement('div');
        this.layoutService.parentContainer.appendChild(element);
        hoverBox.render(element);
    }
}

/**
 * @description Only select partial options for logging purpose.
 */
function __logFileTreeOptions(opts: IFileTreeOptions<any, any>): Dictionary<string, any> {
    return {
        scrollSensibility: opts.scrollSensibility,
        fastScrollSensibility: opts.fastScrollSensibility,
        reverseMouseWheelDirection: opts.reverseMouseWheelDirection,
        touchSupport: opts.touchSupport,
        
        layout: opts.layout,
        transformOptimization: opts.transformOptimization,
        scrollbarSize: opts.scrollbarSize,
        
        mouseSupport: opts.mouseSupport,
        multiSelectionSupport: opts.multiSelectionSupport,
        keyboardSupport: opts.keyboardSupport,
        scrollOnEdgeSupport: opts.scrollOnEdgeSupport,
        dragAndDropSupport: isTruthy(opts.dnd),
        identitySupport:isTruthy(opts.identityProvider),

        collapsedByDefault: opts.collapsedByDefault,
        createTreeWidgetExternal: isTruthy(opts.createTreeWidgetExternal),
        forcePrimitiveType: opts.forcePrimitiveType,
        renderers: `[${opts.renderers.map(renderer => renderer.type).join(', ')}]`,
    };
}
