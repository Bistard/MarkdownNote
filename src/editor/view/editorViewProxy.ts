import { IProseEventBroadcaster, ProseEventBroadcaster } from "src/editor/view/proseEventBroadcaster";
import { ProseEditorView, ProseEditorState, ProseNode, ProseExtension, ProseSchema } from "src/editor/common/proseMirror";
import { ViewContext } from "src/editor/view/editorView";
import { fillMapFromArray } from "src/base/common/structures/map";
import { ProseTools } from "src/editor/common/proseUtility";
import { printNaryTreeLike } from "src/base/common/utilities/string";

export interface IEditorViewProxy extends IProseEventBroadcaster {

    /**
     * Returns a reference to the prosemirror view.
     */
    readonly internalView: ProseEditorView;

    /**
     * @description Renders the editor based on the given prosemirror document 
     * node.
     */
    render(newState: ProseEditorState): void;

    /**
     * @description If the content of the window is directly editable.
     * @note The content may still be modified programmatically.
     */
    isEditable(): boolean;

    /**
     * @description Focus the window.
     */
    focus(): void;

    /**
     * @description Is the window focused.
     */
    isFocused(): boolean;
    
    /**
     * @description Removes the editor from the DOM and destroys all the 
     * resources relate to editor. 
     */
    destroy(): void;

    /**
     * @description If the window is destroyed. 
     */
    isDestroyed(): boolean;

    /**
     * @internal Debug purpose.
     */
    printDocumentTree(): void;
}

export class EditorViewProxy extends ProseEventBroadcaster implements IEditorViewProxy {

    // [fields]

    protected readonly _ctx: ViewContext;
    
    /**
     * Mapping from ID to view extensions.
     */
    protected readonly _extensionMap: Map<string, ProseExtension>;

    // [constructor]

    constructor(
        domEventElement: HTMLElement,
        context: ViewContext,
        extensions: { id: string, extension: ProseExtension }[],
        view: ProseEditorView,
    ) {
        super(domEventElement, view);
        this._ctx = context;
        this._extensionMap = new Map();

        fillMapFromArray(extensions, this._extensionMap, extensionInfo => {
            const { id, extension } = extensionInfo;
            return [id, extension];
        });
    }

    // [getter]

    get internalView(): ProseEditorView {
        return this._view;
    }

    // [public methods]

    public render(newState: ProseEditorState): void {
        this._view.updateState(newState);
    }

    public isEditable(): boolean {
        return this._view.editable;
    }

    public focus(): void {
        this._view.focus();
    }

    public isFocused(): boolean {
        return this._view.hasFocus();
    }

    public destroy(): void {
        this.dispose();
    }

    public isDestroyed(): boolean {
        return this.isDisposed();
    }

    public override dispose(): void {
        super.dispose();
        if (!this._view.isDestroyed) {
            this._view.destroy();
        }
    }

    public printDocumentTree(): void {
        printNaryTreeLike(
            this._view.state.doc, 
            node => node.type.name,
            node => node.childCount > 0,
            node => [...ProseTools.Node.iterateChild(node)].map(item => item.node)
        );
    }

    // [protected helper methods]

    protected __getCurrentViewExtensions(): ProseExtension[] {
        return Array.from(this._extensionMap.values());
    }

    protected static __createNewViewStateFrom(schema: ProseSchema, extensions: ProseExtension[], document: ProseNode | null): ProseEditorState {
        return ProseEditorState.create({
            schema: schema,
            doc: document ?? undefined,
            plugins: extensions,
        });
    }
}