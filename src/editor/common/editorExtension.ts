import type { IEditorWidget } from "src/editor/editorWidget";
import type { IProseEventBroadcaster } from "src/editor/view/proseEventBroadcaster";
import type { EditorSchema } from "src/editor/model/schema";
import { Disposable } from "src/base/common/dispose";
import { ProseDecorationSource, ProseEditorState, ProseEditorView, ProseExtension, ProseTransaction } from "src/editor/common/proseMirror";
import { err, ok, Result } from "src/base/common/result";
import { nullable } from "src/base/common/utilities/type";

/**
 * An interface only for {@link EditorExtension}.
 */
export interface IEditorExtension extends Omit<IProseEventBroadcaster, 'onBeforeRender' | 'onRender' | 'onDidRender' | 'onDidSelectionChange' | 'onDidContentChange'> {
    
    // [fields]

    /**
     * Every extension should has a unique identifier binding to itself.
     */
    readonly id: string;

    // [methods]

    getViewExtension(): ProseExtension;
    getEditorState(): Result<ProseEditorState, Error>;
    getEditorSchema(): Result<EditorSchema, Error>;

    setMeta(tr: ProseTransaction, value: any): void;
    getMeta<T>(tr: ProseTransaction): T | undefined;
}

/**
 * // TODO
 */
export abstract class EditorExtension extends Disposable implements IEditorExtension {
    
    // [fields]

    public abstract readonly id: string;

    protected readonly _editorWidget: IEditorWidget;
    protected readonly _viewExtension: ProseExtension;
    
    /**
     * Will be defined when the editor is initialized for the first time.
     */
    private _viewState?: ProseEditorState;

    // [view event]

    get onDidBlur() { return this._editorWidget.onDidFocus; }
    get onDidFocus() { return this._editorWidget.onDidFocus; }

    get onBeforeRender() { return this._editorWidget.onBeforeRender; }
    get onRender() { return this._editorWidget.onRender; }
    get onDidRender() { return this._editorWidget.onDidRender; }
    get onDidSelectionChange() { return this._editorWidget.onDidSelectionChange; }
    get onDidContentChange() { return this._editorWidget.onDidContentChange; }
    
    get onClick() { return this._editorWidget.onClick; }
    get onDidClick() { return this._editorWidget.onDidClick; }
    get onDoubleClick() { return this._editorWidget.onDoubleClick; }
    get onDidDoubleClick() { return this._editorWidget.onDidDoubleClick; }
    get onTripleClick() { return this._editorWidget.onTripleClick; }
    get onDidTripleClick() { return this._editorWidget.onDidTripleClick; }

    get onKeydown() { return this._editorWidget.onKeydown; }
    get onKeypress() { return this._editorWidget.onKeypress; }
    get onTextInput() { return this._editorWidget.onTextInput; }
    
    get onMouseOver() { return this._editorWidget.onMouseOver; }
    get onMouseOut() { return this._editorWidget.onMouseOut; }
    get onMouseEnter() { return this._editorWidget.onMouseEnter; }
    get onMouseLeave() { return this._editorWidget.onMouseLeave; }
    get onMouseDown() { return this._editorWidget.onMouseDown; }
    get onMouseUp() { return this._editorWidget.onMouseUp; }
    get onMouseMove() { return this._editorWidget.onMouseMove; }
    
    get onPaste() { return this._editorWidget.onPaste; }
    get onDrop() { return this._editorWidget.onDrop; }
    get onDropOverlay() { return this._editorWidget.onDropOverlay; }
    get onDrag() { return this._editorWidget.onDrag; }
    get onDragStart() { return this._editorWidget.onDragStart; }
    get onDragEnd() { return this._editorWidget.onDragEnd; }
    get onDragOver() { return this._editorWidget.onDragOver; }
    get onDragEnter() { return this._editorWidget.onDragEnter; }
    get onDragLeave() { return this._editorWidget.onDragLeave; }
    
    get onWheel() { return this._editorWidget.onWheel; }

    // [constructor]

    constructor(
        editorWidget: IEditorWidget,
    ) {
        super();
        this._editorWidget = editorWidget;
        this._viewExtension = new ProseExtension<void>({
            state: {
                // This function will be called once the extension is created by {@link EditorState.create({ plugin: [myPlugin] })}.
                init: (config, state) => {
                    this._viewState = state;
                    this.onViewStateInit?.(state);
                },
                // This function is invoked whenever a transaction in editor.
                apply: (tr, value, oldState, newState) => {
                    this._viewState = newState;
                    this.onStateTransaction?.(tr, oldState, newState);
                },
            },
            // Will be called when the state is associated with an {@link ProseEditorView}.
            view: (view) => {
                this.onViewInit?.(view);

                return {
                    // Called when the view is destroyed
                    destroy: () => {
                        this._viewState = undefined;
                        this.onViewDestroy?.(view);
                    },
                    // Called whenever the view's state is updated.
                    update: (view, prevState) => {
                        this._viewState = view.state;
                        this.onViewUpdate?.(view, prevState);
                    },
                };
            },
            props: {
                decorations: (state) => {
                    return this.onDecoration?.(state);
                }
            }
        });
    }

    // [abstract methods]

    /**
     * @description This function will be called once when an editor state is 
     * created by {@link EditorState.create()}.
     */
    protected onViewStateInit?(state: ProseEditorState): void;
    
    /**
     * @description This function is invoked whenever a transaction in editor 
     * occurs, allowing the plugin to update its internal state.
     * @param transaction The transaction object representing the changes made.
     * @param oldState The editor state before the transaction was applied.
     * @param newState The editor state after the transaction has been applied.
     */
    protected onStateTransaction?(transaction: ProseTransaction, oldState: ProseEditorState, newState: ProseEditorState): void;

    /**
     * @description This function triggers when the extension is bounded with
     * the {@link ProseEditorView}.
     * 
     * @note If the view gets destroyed, the reference of the view passed into
     * this function will be no longer valid.
     */
    protected onViewInit?(view: ProseEditorView): void;
    
    /**
     * @description This function triggers when the view's state is updated.
     */
    protected onViewUpdate?(view: ProseEditorView, prevState: ProseEditorState): void;

    /**
     * @description This function triggers when the {@link ProseEditorView} is
     * destroyed.
     */
    protected onViewDestroy?(view: ProseEditorView): void;

    /**
     * Called on every editor state update (e.g., after each transaction or
     * whenever the view's state is re-evaluated) to retrieve decorations for
     * this extension. ProseMirror will invoke `props.decorations(state)` on
     * each update, and in turn, call this method if defined.
     *
     * @remarks
     * 1. Initial Render: This is also invoked when the editor is first
     *    rendered or re-initialized, so you can provide initial decorations.
     * 2. Subsequent Updates: Each time the user edits the document or a
     *    plugin changes the state (causing a transaction), ProseMirror checks
     *    for updated decorations. Thus, `onDecoration` may be called frequently.
     * 3. Performance Consideration: Since this can be called on every
     *    transaction, ensure that any decoration-building logic is optimized
     *    or incremental if possible.
     *
     * @returns A {@link ProseDecorationSource} (DecorationSet) or `null` (if no
     * decoration needs to be applied).
     */
    protected onDecoration?(state: ProseEditorState): ProseDecorationSource | nullable;

    // [public methods]

    public getViewExtension(): ProseExtension {
        return this._viewExtension;
    }

    public getEditorState(): Result<ProseEditorState, Error> {
        return this._viewState ? ok(this._viewState) : err(new Error(`The editor extension (${this.id}) is not initialized.`));
    }
    
    public getEditorSchema(): Result<EditorSchema, Error> {
        return this._viewState ? ok(<EditorSchema>this._viewState.schema) : err(new Error(`The editor extension (${this.id}) is not initialized.`));
    }

    public setMeta(tr: ProseTransaction, value: any): void {
        tr.setMeta(this._viewExtension, value);
    }

    public getMeta<T>(tr: ProseTransaction): T | undefined {
        return tr.getMeta(this._viewExtension);
    }
}