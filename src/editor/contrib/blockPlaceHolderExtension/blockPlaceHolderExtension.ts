import "src/editor/contrib/blockPlaceHolderExtension/blockPlaceHolder.scss";
import { EditorExtension, IEditorExtension } from "src/editor/common/editorExtension";
import { ProseTools } from "src/editor/common/proseUtility";
import { EditorExtensionIDs } from "src/editor/contrib/builtInExtensionList";
import { IEditorWidget } from "src/editor/editorWidget";
import { ProseDecoration, ProseDecorationSet, ProseDecorationSource, ProseEditorState, ProseEditorView } from "src/editor/common/proseMirror";
import { I18nService, II18nService } from "src/platform/i18n/browser/i18nService";

interface IEditorBlockPlaceHolderExtension extends IEditorExtension {
    
    readonly id: EditorExtensionIDs.BlockPlaceHolder;
}

/**
 * @description A simple extension that renders a placeholder whenever the 
 * current cursor is on an empty block.
 */
export class EditorBlockPlaceHolderExtension extends EditorExtension implements IEditorBlockPlaceHolderExtension {

    // [fields]

    public override readonly id = EditorExtensionIDs.BlockPlaceHolder;

    constructor(
        editorWidget: IEditorWidget,
        @II18nService private readonly i18nService: I18nService,
    ) {
        super(editorWidget);
    }

    // [private methods]

    /**
     * @note Place-holder rendering.
     */
    protected override onDecoration(state: ProseEditorState): ProseDecorationSource | null {
        const { selection } = state;
        const isCursor = ProseTools.Cursor.isCursor(selection);
        if (!isCursor) {
            return null;
        }

        const isEmptyBlock = ProseTools.Cursor.isOnEmpty(selection);
        if (!isEmptyBlock) {
            return null;
        }
        
        const blockPos = selection.$from.before();
        const blockNode = state.doc.nodeAt(blockPos);
        if (!blockNode) {
            return null;
        }

        const deco = ProseDecoration.node(blockPos, blockPos + blockNode.nodeSize, {
            class: 'empty-block',
            ['placeholder-text']: this.i18nService.localize('emptyBlockPlaceHolder', "Start typing, or press '@' for AI, '/' for commands..."),
        });
        return ProseDecorationSet.create(state.doc, [deco]);
    }
}
