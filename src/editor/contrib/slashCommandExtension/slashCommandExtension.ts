import "src/editor/contrib/slashCommandExtension/slashCommand.scss";
import { AnchorPrimaryAxisAlignment, AnchorVerticalPosition } from "src/base/browser/basic/contextMenu/contextMenu";
import { IMenuAction, SimpleMenuAction } from "src/base/browser/basic/menu/menuItem";
import { IPosition } from "src/base/common/utilities/size";
import { EditorExtension, IEditorExtension } from "src/editor/common/editorExtension";
import { ProseTools } from "src/editor/common/proseUtility";
import { EditorExtensionIDs } from "src/editor/contrib/builtInExtensionList";
import { IEditorWidget } from "src/editor/editorWidget";
import { IOnTextInputEvent } from "src/editor/view/proseEventBroadcaster";
import { IContextMenuService } from "src/workbench/services/contextMenu/contextMenuService";

interface IEditorSlashCommandExtension extends IEditorExtension {
    
    readonly id: EditorExtensionIDs.SlashCommand;
}

export class EditorSlashCommandExtension extends EditorExtension implements IEditorSlashCommandExtension {

    // [fields]

    public override readonly id = EditorExtensionIDs.SlashCommand;

    constructor(
        editorWidget: IEditorWidget,
        @IContextMenuService private readonly contextMenuService: IContextMenuService,
    ) {
        super(editorWidget);

        // slash-command rendering
        this.__register(this.onTextInput(e => this.__tryShowSlashCommand(e)));
    }

    // [private methods]

    private __tryShowSlashCommand(e: IOnTextInputEvent): void {
        const { text, view } = e;
        const { selection } = view.state;

        const isCursor = ProseTools.Cursor.isCursor(selection);
        if (!isCursor) {
            return;
        }

        const isEmptyBlock = ProseTools.Cursor.isOnEmpty(selection);
        const isSlash = text === '/';
        if (!isEmptyBlock || !isSlash) {
            return;
        }

        const position = view.coordsAtPos(selection.$from.pos);
        this.__showSlashCommand(position);
    }

    private __showSlashCommand(position?: IPosition): void {
        if (!position) {
            return;
        }
        const x = position.left;
        const y = position.top + 30; // add a bit offset to the bottom

        const parentElement = this._editorWidget.view.editor.container;
        this.contextMenuService.showContextMenuCustom({
            getActions: () => this.__obtainSlashCommandContent(),
            getContext: () => undefined,
            getAnchor: () => ({ x, y }),
            getExtraContextMenuClassName: () => 'editor-slash-command',
            primaryAlignment: AnchorPrimaryAxisAlignment.Vertical,
            verticalPosition: AnchorVerticalPosition.Below,

            onDestroy: (cause) => {
                const onlyPreventBlur = cause === 'blur';
                return onlyPreventBlur;
            },
        }, parentElement);
    }

    private __obtainSlashCommandContent(): IMenuAction[] {
        const nodes = this._editorWidget.model.getRegisteredDocumentNodes();

        // TODO: rename and reorder based on priority
        return nodes.map(name => new SimpleMenuAction({
            enabled: true,
            id: name,
            callback: () => {
                console.log('invoked');
            },
        }));
    }
}
