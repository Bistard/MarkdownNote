import { Constructor } from "src/base/common/utilities/type";
import { EditorExtension } from "src/editor/common/editorExtension";
import { EditorCommandExtension } from "src/editor/contrib/commandExtension/commandExtension";
import { EditorAutoSaveExtension } from "src/editor/contrib/autoSaveExtension";
import { EditorInputRuleExtension } from "src/editor/contrib/inputRuleExtension/inputRuleExtension";
import { EditorDragAndDropExtension } from "src/editor/contrib/dragAndDropExtension/dragAndDropExtension";
import { EditorBlockHandleExtension } from "src/editor/contrib/blockHandleExtension/blockHandleExtension";
import { EditorBlockPlaceHolderExtension } from "src/editor/contrib/blockPlaceHolderExtension/blockPlaceHolderExtension";
import { EditorSlashCommandExtension } from "src/editor/contrib/slashCommandExtension/slashCommandExtension";
// import { EditorHistoryExtension } from "src/editor/contrib/historyExtension/historyExtension";

export const enum EditorExtensionIDs {
    Command   = 'editor-command-extension',
    AutoSave  = 'editor-autosave-extension',
    InputRule = 'editor-inputRule-extension',
    History   = 'editor-history-extension',
    DragAndDrop = 'editor-drag-and-drop-extension',
    BlockHandle = 'editor-block-handle-extension',
    BlockPlaceHolder = 'editor-block-place-holder-extension',
    SlashCommand = 'editor-slash-command-extension',
}

/**
 * @description These extensions are meant to be built-in features of the editor.
 */
export function getBuiltInExtension(): { id: string, ctor: Constructor<EditorExtension> }[] {
    return [
        { id: EditorExtensionIDs.InputRule, ctor: EditorInputRuleExtension },
        { id: EditorExtensionIDs.AutoSave, ctor: EditorAutoSaveExtension },
        { id: EditorExtensionIDs.Command, ctor: EditorCommandExtension },
        { id: EditorExtensionIDs.DragAndDrop, ctor: EditorDragAndDropExtension },
        { id: EditorExtensionIDs.BlockHandle, ctor: EditorBlockHandleExtension },
        { id: EditorExtensionIDs.BlockPlaceHolder, ctor: EditorBlockPlaceHolderExtension },
        { id: EditorExtensionIDs.SlashCommand, ctor: EditorSlashCommandExtension },
        // { id: EditorExtensionIDs.History, ctor: EditorHistoryExtension }, // TODO: unfinished (shit mountain)
    ];
}