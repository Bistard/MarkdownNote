import type { IEditorCommandExtension } from "src/editor/contrib/commandExtension/commandExtension";
import type { IEditorWidget } from "src/editor/editorWidget";
import { ReplaceAroundStep, canJoin, canSplit, liftTarget, replaceStep } from "prosemirror-transform";
import { ILogService } from "src/base/common/logger";
import { MarkEnum, TokenEnum } from "src/editor/common/markdown";
import { ProseEditorState, ProseTransaction, ProseAllSelection, ProseTextSelection, ProseNodeSelection, ProseEditorView, ProseReplaceStep, ProseSlice, ProseFragment, ProseNode, ProseSelection, ProseContentMatch, ProseMarkType, ProseAttrs, ProseSelectionRange, ProseNodeType, ProseResolvedPos, ProseCursor } from "src/editor/common/proseMirror";
import { ProseTools } from "src/editor/common/proseUtility";
import { EditorSchema } from "src/editor/model/schema";
import { Command, ICommandSchema, buildChainCommand } from "src/platform/command/common/command";
import { ICommandService } from "src/platform/command/common/commandService";
import { CreateContextKeyExpr } from "src/platform/context/common/contextKeyExpr";
import { IServiceProvider } from "src/platform/instantiation/common/instantiation";
import { EditorContextKeys } from "src/editor/common/editorContextKeys";
import { IS_MAC } from "src/base/common/platform";
import { redo, undo } from "prosemirror-history";
import { INotificationService } from "src/workbench/services/notification/notification";

/**
 * [FILE OUTLINE]
 * 
 * {@link registerBasicEditorCommands}
 * {@link EditorCommandBase}
 * {@link EditorCommands}
 */

const whenEditorReadonly = CreateContextKeyExpr.And(EditorContextKeys.editorFocusedContext, EditorContextKeys.isEditorReadonly);
const whenEditorWritable = CreateContextKeyExpr.And(EditorContextKeys.editorFocusedContext, EditorContextKeys.isEditorWritable);

/**
 * @description A set of default editor command configurations.
 */
export function registerBasicEditorCommands(extension: IEditorCommandExtension, logService: ILogService): void {
    __registerToggleMarkCommands(extension, logService);
    __registerHeadingCommands(extension, logService);
    __registerOtherCommands(extension);
}

function getPlatformShortcut(ctrl: string, meta: string): string {
    return IS_MAC ? meta : ctrl;
}

/**
 * @description Register Toggle Mark Commands.
 * @note These commands need to be constructed after the editor and schema 
 * are initialized.
 */
function __registerToggleMarkCommands(extension: IEditorCommandExtension, logService: ILogService): void {
    const schema = extension.getEditorSchema().unwrap();
    const toggleMarkConfigs: [string, string, string][] = [
        [MarkEnum.Strong,   'Ctrl+B', 'Meta+B'],
        [MarkEnum.Em,       'Ctrl+I', 'Meta+I'],
        [MarkEnum.Codespan, 'Ctrl+`', 'Meta+`'],
    ];
    for (const [markID, ctrl, meta] of toggleMarkConfigs) {
        const toggleCmdID = `editor-toggle-mark-${markID}`;
        const markType = schema.getMarkType(markID);
        
        if (!markType) {
            logService.warn(extension.id, `Cannot register the editor command (${toggleCmdID}) because the mark type does not exists in the editor schema.`);
            continue;
        }

        extension.registerCommand(
            EditorCommands.createToggleMarkCommand(
                { id: toggleCmdID, when: whenEditorWritable },
                markType, 
                null, // attrs
                {
                    removeWhenPresent: true,
                    enterInlineAtoms: true,
                }
            ), 
            [getPlatformShortcut(ctrl, meta)]
        );
    }
}

/**
 * @description Register Toggle Heading Commands. Ctrl+(1-6) will toggle the 
 * block into Heading block node.
 * @note These commands need to be constructed after the editor and schema 
 * are initialized.
 */
function __registerHeadingCommands(extension: IEditorCommandExtension, logService: ILogService): void {
    const schema = extension.getEditorSchema().unwrap();
    const headingCmdID = 'editor-toggle-heading';
    
    const nodeType = schema.getNodeType(TokenEnum.Heading);
    if (!nodeType) {
        logService.warn(extension.id, `Cannot register the editor command (${headingCmdID}) because the token type does not exists in the editor schema.`);
        return;
    }

    for (let level = 1; level <= 6; level++) {
        const cmdID = `${headingCmdID}-${level}`;
        extension.registerCommand(
            EditorCommands.createSetBlockCommand(
                { id: cmdID, when: whenEditorWritable },
                nodeType,
                { level: level }
            ),
            [getPlatformShortcut(`Ctrl+${level}`, `Meta+${level}`)]
        );
    }
}

function __registerOtherCommands(extension: IEditorCommandExtension): void {
    extension.registerCommand(__buildEditorCommand(
            { 
                id: 'editor-esc', 
                when: whenEditorReadonly,
            }, 
            [
                EditorCommands.Unselect
            ],
        ), 
        ['Escape']
    );

    extension.registerCommand(__buildEditorCommand(
            { 
                id: 'editor-enter', 
                when: whenEditorWritable,
            }, 
            [
                EditorCommands.InsertNewLineInCodeBlock,
                EditorCommands.InsertEmptyParagraphAdjacentToBlock,
                EditorCommands.LiftEmptyTextBlock,
                EditorCommands.SplitBlockAtSelection,
            ],
        ), 
        ['Enter']
    );
        
    extension.registerCommand(__buildEditorCommand(
            { 
                id: 'editor-backspace', 
                when: whenEditorWritable,
            }, 
            [
                EditorCommands.DeleteSelection,
                EditorCommands.JoinBackward,
                EditorCommands.SelectNodeBackward,
            ],
        ), 
        ['Backspace']
    );

    extension.registerCommand(__buildEditorCommand(
            {
                id: 'editor-delete',
                when: whenEditorWritable,
            },
            [
                EditorCommands.DeleteSelection,
                EditorCommands.joinForward,
                EditorCommands.SelectNodeForward,
            ]
        ), 
        ['Delete', getPlatformShortcut('Ctrl+Delete', 'Meta+Delete')]
    );

    extension.registerCommand(__buildEditorCommand(
            {
                id: 'editor-select-all',
                when: whenEditorReadonly,
            },
            [
                EditorCommands.SelectAll
            ]
        ), 
        [getPlatformShortcut('Ctrl+A', 'Meta+A')]
    );
    
    // @fix Doesn't work with CM, guess bcz CM is focused but PM is not.
    extension.registerCommand(__buildEditorCommand(
            {
                id: 'editor-exit-code-block',
                when: whenEditorReadonly,
            },
            [
                EditorCommands.ExitCodeBlock
            ]
        ), 
        [getPlatformShortcut('Ctrl+Enter', 'Meta+Enter')]
    );

    extension.registerCommand(__buildEditorCommand(
            {
                id: 'editor-insert-hard-break',
                when: whenEditorWritable,
            },
            [
                EditorCommands.ExitCodeBlock,
                EditorCommands.InsertHardBreak,
            ]
        ),
        ['Shift+Enter', getPlatformShortcut('Ctrl+Enter', 'Meta+Enter')]
    );
    
    extension.registerCommand(__buildEditorCommand(
            {
                id: 'editor-save',
                when: whenEditorWritable,
            },
            [
                EditorCommands.FileSave,
            ]
        ),
        [getPlatformShortcut('Ctrl+S', 'Meta+S')]
    );
    
    extension.registerCommand(__buildEditorCommand(
            {
                id: 'editor-undo',
                when: whenEditorWritable,
            },
            [
                EditorCommands.FileUndo,
            ]
        ),
        [getPlatformShortcut('Ctrl+Z', 'Meta+Z')]
    );
    
    extension.registerCommand(__buildEditorCommand(
            {
                id: 'editor-redo',
                when: whenEditorWritable,
            },
            [
                EditorCommands.FileRedo,
            ]
        ),
        [getPlatformShortcut('Ctrl+Shift+Z', 'Meta+Shift+Z')]
    );
}

function __buildEditorCommand(schema: ICommandSchema, ctors: (typeof Command<any>)[]): Command {
    if (ctors.length === 1) {
        const command = ctors[0]!;
        return new command(schema);
    }
    return buildChainCommand(schema, ctors);
}

/**
 * @class A base class for every command in the {@link EditorCommandsBasic}.
 */
export abstract class EditorCommandBase extends Command {
    public abstract override run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean | Promise<boolean>;
}

/**
 * @description Contains a list of commands specific for editor. Every basic 
 * command is responsible for a very specific editor job. Usually these commands 
 * are only used when you know what you are doing. 
 */
export namespace EditorCommands {

    export class Unselect extends EditorCommandBase {
        
        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            const { $to } = state.selection;
            const tr = state.tr.setSelection(ProseTextSelection.create(state.doc, $to.pos));
            dispatch?.(tr);
            view?.dom.blur();
            return true;
        }
    }

    export class SelectAll extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void): boolean {
            if (!dispatch) {
                return false;
            }
            const { selection } = state;

            // case 0: If already fully selected, do nothing.
            if (ProseTools.Selection.isFullSelection(state)) {
                return true;
            }

            // case 1: empty selection, only select that parent block first.
            if (ProseTools.Cursor.isCursor(selection)) {
                this.__selectParent(state, selection, dispatch);
                return true;
            }

            // case 2: partial selection, within the same parent, select that block.
            const { $from, $to } = state.selection;
            const inSameBlock = $from.sameParent($to);
            if (inSameBlock) {
                this.__selectParent(state, selection, dispatch);
                return true;
            }

            // case 3: complex selection, select everything as normal.
            const allSelect = new ProseAllSelection(state.doc);
            const tr = state.tr.setSelection(allSelect);
            dispatch(tr);
            return true;
        }

        private __selectParent(state: ProseEditorState, selection: ProseSelection, dispatch: (tr: ProseTransaction) => void): void {
            const currBlockPos = selection.$from.start() - 1;
            const shouldAllSelect = currBlockPos < 0;
            
            const newSelection = shouldAllSelect
                ? new ProseAllSelection(state.doc)
                : ProseNodeSelection.create(state.doc, currBlockPos);
            const tr = state.tr.setSelection(newSelection);
            
            // only scroll when partial selection
            if (shouldAllSelect === false) {
                tr.scrollIntoView();
            }
            
            dispatch(tr);
        }
    }

    /**
     * @description Inserts a newline character in a code block at the current 
     * selection in the editor, but only under specific selection conditions.
     * 
     * @note The command checks if the current selection (cursor position) is 
     * within a node that is marked as a 'code' node (e.g. {@link CodeBlock}). 
     * If the selection meets this criteria, the function replaces the selection 
     * with a newline character.
     */
    export class InsertNewLineInCodeBlock extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void): boolean {
            const { $head, $anchor } = state.selection;
            if (!$head.parent.type.spec.code || !$head.sameParent($anchor)) {
                return false;
            }

            const tr = state.tr.insertText("\n").scrollIntoView();
            dispatch?.(tr);

            return true;
        }
    }

    /**
     * @description Inserts an empty paragraph either before or after a block 
     * node in the editor, depending on the position of the block node. The 
     * function adds a paragraph before the block node if it is the first child 
     * of its parent, otherwise, it adds a paragraph after the block node.
     */
    export class InsertEmptyParagraphAdjacentToBlock extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void): boolean {
            const { $from, $to } = state.selection;

            // Check if the selection is not suitable for paragraph insertion.
            if (state.selection instanceof ProseAllSelection || $from.parent.inlineContent || $to.parent.inlineContent) {
                return false;
            }

            // Determine the default block type at the current position.
            const defaultBlockType = ProseTools.Node.getNextValidDefaultNodeTypeAt($to.parent, $to.indexAfter());

            // Check if the determined block type is valid and is a textblock.
            if (!defaultBlockType || !defaultBlockType.isTextblock) {
                return false;
            }

            if (!dispatch) {
                return true;
            }

            // Calculate the position to insert the new paragraph.
            const insertionPosition = (!$from.parentOffset && $to.index() < $to.parent.childCount) ? $from.pos : $to.pos;

            // Create and dispatch the transaction to insert the new paragraph.
            const transaction = state.tr.insert(insertionPosition, defaultBlockType.createAndFill()!);
            const newSelection = ProseTextSelection.create(transaction.doc, insertionPosition + 1);
            transaction.setSelection(newSelection).scrollIntoView();
            dispatch?.(transaction);

            return true;
        }
    }

    /**
     * @description Lifts an empty text block in the editor. This function 
     * checks if the cursor is positioned in an empty text block. If the block 
     * can be "lifted" (meaning moved out of its current context, like out of a 
     * list or a quote), the function performs this action.
     */
    export class LiftEmptyTextBlock extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void): boolean {
            if (!(state.selection instanceof ProseTextSelection)) {
                return false;
            }

            const { $cursor: cursor } = state.selection;
            if (!cursor || cursor.parent.content.size) {
                return false;
            }

            /**
             * Attempt to lift the block if the cursor is deeper than one level 
             * and not at the end of its parent.
             */
            if (cursor.depth > 1 && cursor.after() !== cursor.end(-1)) {
                const before = cursor.before();
                if (canSplit(state.doc, before)) {
                    const newTr = state.tr.split(before).scrollIntoView();
                    dispatch?.(newTr);
                    return true;
                }
            }

            // Calculate the range and target for lifting the block
            const blockRange = cursor.blockRange();
            const target = blockRange && liftTarget(blockRange);
            if (target === null) {
                return false;
            }

            const newTr = state.tr.lift(blockRange!, target).scrollIntoView();
            dispatch?.(newTr);

            return true;
        }
    }

    /**
     * @description Splits a block in the editor at the current selection. If 
     * the selection is within a block, the function divides the block into two 
     * at that point.
     */
    export class SplitBlockAtSelection extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void): boolean {
            const { $from, $to } = state.selection;

            if (state.selection instanceof ProseNodeSelection && state.selection.node.isBlock) {
                if (!$from.parentOffset || !canSplit(state.doc, $from.pos)) {
                    return false;
                }

                const newTr = state.tr.split($from.pos).scrollIntoView();
                dispatch?.(newTr);
                return true;
            }

            if (!$from.parent.isBlock) {
                return false;
            }

            if (dispatch) {
                const isAtEnd = $to.parentOffset === $to.parent.content.size;
                const tr = state.tr;

                // First, delete the selection.
                if (state.selection instanceof ProseTextSelection || state.selection instanceof ProseAllSelection) {
                    tr.deleteSelection();
                }

                /**
                 * A match that represents the rules for what content is valid 
                 * after the selection (from).
                 */
                const match = $from.node(-1).contentMatchAt($from.indexAfter(-1));
                const defaultType = $from.depth === 0 ? null : ProseTools.Node.getNextValidDefaultNodeType(match);
                let types = isAtEnd && defaultType ? [{ type: defaultType }] : undefined;
                let ifCanSplitAtPosition = canSplit(tr.doc, tr.mapping.map($from.pos), 1, types);

                if (!types &&
                    !ifCanSplitAtPosition &&
                    canSplit(tr.doc, tr.mapping.map($from.pos), 1, defaultType ? [{ type: defaultType }] : undefined)
                ) {
                    if (defaultType) {
                        types = [{ type: defaultType }];
                    }
                    ifCanSplitAtPosition = true;
                }

                if (ifCanSplitAtPosition) {
                    tr.split(tr.mapping.map($from.pos), 1, types);

                    // Additional logic for handling specific cases
                    if (!isAtEnd && !$from.parentOffset && $from.parent.type !== defaultType) {
                        const first = tr.mapping.map($from.before()), $first = tr.doc.resolve(first);
                        if (defaultType && $from.node(-1).canReplaceWith($first.index(), $first.index() + 1, defaultType)) {
                            tr.setNodeMarkup(tr.mapping.map($from.before()), defaultType);
                        }
                    }
                }

                dispatch?.(tr.scrollIntoView());
            }

            return true;
        }
    }

    /**
     * @description Delete the current selection.
     */
    export class DeleteSelection extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void): boolean {
            if (state.selection.empty) {
                return false;
            }

            const newTr = state.tr.deleteSelection().scrollIntoView();
            dispatch?.(newTr);
            return true;
        }
    }

    /**
     * @description If the selection is empty and at the start of a textblock, 
     * try to reduce the distance between that block and the one before it—if
     * there's a block directly before it that can be joined, join them. If not, 
     * try to move the selected block closer to the next one in the document 
     * structure by lifting it out of its parent or moving it into a parent of 
     * the previous block. Will use the view for accurate (bidi-aware) start-of
     * -textblock detection if given.
     */
    export class JoinBackward extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            const $cursor = __atBlockStart(state, view);
            if (!$cursor) {
                return false;
            }

            const $cut = __findCutBefore($cursor);

            // If there is no node before this, try to lift.
            if (!$cut) {
                const range = $cursor.blockRange();
                const target = range && liftTarget(range);
                if (target === null) {
                    return false;
                }

                const newTr = state.tr.lift(range!, target).scrollIntoView();
                dispatch?.(newTr);

                return true;
            }

            const before = $cut.nodeBefore!;

            // Apply the joining algorithm
            if (__deleteBarrier(state, $cut, dispatch, -1)) {
                return true;
            }

            /**
             * If the node below has no content and the node above is 
             * selectable, delete the node below and select the one above.
             */
            if ($cursor.parent.content.size === 0 &&
                (__textblockAt(before, "end") || ProseNodeSelection.isSelectable(before))
            ) {
                for (let depth = $cursor.depth; ; depth--) {
                    const delStep = <ProseReplaceStep>replaceStep(state.doc, $cursor.before(depth), $cursor.after(depth), ProseSlice.empty);
                    if (delStep && delStep.slice.size < delStep.to - delStep.from) {
                        if (dispatch) {
                            const tr = state.tr.step(delStep);
                            tr.setSelection(__textblockAt(before, "end")
                                ? ProseSelection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos, -1)), -1)!
                                : ProseNodeSelection.create(tr.doc, $cut.pos - before.nodeSize));
                            dispatch(tr.scrollIntoView());
                        }
                        return true;
                    }
                    if (depth === 1 || $cursor.getParentNodeAt(depth - 1)!.childCount > 1) {
                        break;
                    }
                }
            }

            // If the node before is an atom, delete it.
            if (before.isAtom && $cut.depth === $cursor.depth - 1) {
                const newTr = state.tr.delete($cut.pos - before.nodeSize, $cut.pos);
                dispatch?.(newTr.scrollIntoView());
                return true;
            }

            return false;
        }
    }

    /**
     * @description If the selection is empty and the cursor is at the end 
     * of a textblock, try to reduce or remove the boundary between that 
     * block and the one after it, either by joining them or by moving the 
     * other block closer to this one in the tree structure. Will use the 
     * view for accurate start-of-textblock detection if given.
     */
    export class joinForward extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            const $cursor = __atBlockEnd(state, view);
            if (!$cursor) {
                return false;
            }

            const $cut = __findCutAfter($cursor);
            
            // If there is no node after this, there's nothing to do
            if (!$cut) {
                return false;
            }

            const after = $cut.nodeAfter!;
            // Try the joining algorithm
            if (__deleteBarrier(state, $cut, dispatch, 1)) {
                return true;
            }

            // If the node above has no content and the node below is
            // selectable, delete the node above and select the one below.
            if ($cursor.parent.content.size === 0 &&
                (__textblockAt(after, "start") || ProseNodeSelection.isSelectable(after))) {
                const delStep = replaceStep(state.doc, $cursor.before(), $cursor.after(), ProseSlice.empty) as ProseReplaceStep;
                if (delStep && delStep.slice.size < delStep.to - delStep.from) {
                
                    if (dispatch) {
                        const tr = state.tr.step(delStep);
                        tr.setSelection(__textblockAt(after, "start") 
                                        ? ProseSelection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos)), 1)!
                                        : ProseNodeSelection.create(tr.doc, tr.mapping.map($cut.pos)));
                        dispatch(tr.scrollIntoView());
                    }
                    
                    return true;
                }
            }

            // If the next node is an atom, delete it
            if (after.isAtom && $cut.depth === $cursor.depth - 1) {
                if (dispatch) {
                    dispatch(state.tr.delete($cut.pos, $cut.pos + after.nodeSize).scrollIntoView());
                }
                return true;
            }

            return false;
        }
    }

    /**
     * @description When the selection is empty and at the start of a 
     * textblock, select the node before that textblock, if possible. This is 
     * intended to be bound to keys like backspace, after[`joinBackward`](#commands.joinBackward) 
     * or other deleting commands, as a fall-back behavior when the schema 
     * doesn't allow deletion at the selected point.
     */
    export class SelectNodeBackward extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            const $head = state.selection.$head;
            const ifEmpty = state.selection.empty;
            
            let $cut: ProseResolvedPos | null = $head;
            if (!ifEmpty) {
                return false;
            }

            if ($head.parent.isTextblock) {
                if (view ? !view.endOfTextblock("backward", state) : $head.parentOffset > 0) {
                    return false;
                }
                $cut = __findCutBefore($head);
            }

            const node = $cut && $cut.nodeBefore;
            if (!node || !ProseNodeSelection.isSelectable(node)) {
                return false;
            }

            const newSelection = ProseNodeSelection.create(state.doc, $cut!.pos - node.nodeSize);
            const newTr = state.tr.setSelection(newSelection);
            dispatch?.(newTr.scrollIntoView());

            return true;
        }
    }

    /**
     * When the selection is empty and at the end of a textblock, select
     * the node coming after that textblock, if possible. This is intended
     * to be bound to keys like delete, after
     * [`joinForward`](#commands.joinForward) and similar deleting
     * commands, to provide a fall-back behavior when the schema doesn't
     * allow deletion at the selected point.
     */
    export class SelectNodeForward extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            const { empty } = state.selection;
            if (!empty) {
                return false;
            }

            const $head = state.selection.$head;
            let $cut: ProseResolvedPos | null = $head;

            if ($head.parent.isTextblock) {
                if (view ? !view.endOfTextblock("forward", state) : $head.parentOffset < $head.parent.content.size) {
                    return false;
                }
                $cut = __findCutAfter($head);
            }

            const node = $cut && $cut.nodeAfter;
            if (!node || !ProseNodeSelection.isSelectable(node)) {
                return false;
            }
            
            const newSelection = ProseNodeSelection.create(state.doc, $cut!.pos);
            const newTr = state.tr.setSelection(newSelection);
            dispatch?.(newTr.scrollIntoView());
            
            return true;
        }
    }

    /**
     * @description A command that allows users to exit from a code block by 
     * creating a new default block (usually a paragraph) immediately after 
     * the code block and moving the cursor to that new block. 
     *
     * The command performs the following steps:
     * 1. It checks if the selection is entirely within a code block. This is 
     *    determined by verifying if the parent node of the current selection 
     *    has a `code` property in its spec, and ensuring the selection is not 
     *    spanning across multiple nodes.
     * 2. If the selection is inside a code block, it looks for the appropriate 
     *    default block type (e.g., paragraph) to insert after the code block, 
     *    ensuring the document structure allows for the new block to be placed 
     *    after the code block.
     * 3. If a valid block type is found and the document allows for the 
     *    insertion, it creates the new block at the position right after the 
     *    code block and moves the cursor into it.
     */
    export class ExitCodeBlock extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            const { $head, $anchor } = state.selection;
            const isInCodeBlock = $head.parent.type.spec.code;
            const isSelectionCollapsed = $head.sameParent($anchor);

            // Ensure the selection is entirely within a single code block
            if (!isInCodeBlock || !isSelectionCollapsed) {
                return false;
            }

            const parentNode = $head.node(-1);
            const nextNodeIndex = $head.indexAfter(-1);
            const blockType = __defaultBlockAt(parentNode.contentMatchAt(nextNodeIndex));

            // Check if the document structure allows inserting a new block after the code block
            if (!blockType || !parentNode.canReplaceWith(nextNodeIndex, nextNodeIndex, blockType)) {
                return false;
            }

            // Proceed with creating the new block and updating the selection
            if (dispatch) {
                const insertPosition = $head.after();
                const newBlock = blockType.createAndFill();
                const tr = state.tr.replaceWith(insertPosition, insertPosition, newBlock!);

                // Move the selection to the new block
                tr.setSelection(ProseSelection.near(tr.doc.resolve(insertPosition), 1));
                dispatch(tr.scrollIntoView());
            }

            return true;
        }
    }

    /**
     * @description A command that toggles the specified mark on the current 
     * selection or the stored marks. If the mark exists in the current 
     * selection, it is removed; otherwise, it is added. The behavior can be 
     * customized with additional options.
     * 
     * The command performs the following steps:
     * 1. It checks if the selection is empty or if the mark can be applied to the 
     *    current selection range.
     * 2. If the selection is valid and the mark can be applied, it either adds or 
     *    removes the mark based on the current state and options.
     * 3. If the selection is empty, the command will apply or remove the mark 
     *    from the stored marks instead of modifying a range of the document.
     */
    export function createToggleMarkCommand<TType extends ProseMarkType>(
        schema: ICommandSchema, 
        markType: TType, 
        attrs: ProseAttrs | null = null, 
        options?: {
            /**
             * @default true
             * Controls whether, when part of the selected range has the 
             * mark already and part doesn't, the mark is removed (`true`) 
             * or added (`false`).
             */
            removeWhenPresent?: boolean;
            /**
             * @default true
             * When set to false, this will prevent the command from acting 
             * on the content of inline nodes marked as [atoms](#model.NodeSpec.atom) 
             * that are completely covered by a selection range.
             * 
             * In ProseMirror, an atom is a type of node that is considered 
             * indivisible (like an image or an emoji) and cannot be split 
             * or modified internally by typical editing operations. When a 
             * node is marked as an atom, it means that even if you select 
             * part of the content that covers this node, the node should 
             * not be edited or split up.
             */
            enterInlineAtoms?: boolean;
        }
    ): Command {
        const removeWhenPresent = options?.removeWhenPresent ?? true;
        const enterAtoms = options?.enterInlineAtoms ?? true;

        return new class extends EditorCommandBase {
            public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
                const { empty, $cursor } = state.selection as ProseTextSelection;
                let ranges = state.selection.ranges;

                // Check if selection is valid and if mark can be applied
                if ((empty && !$cursor) || !__markApplies(state.doc, ranges, markType, enterAtoms)) {
                    return false;
                }

                if (!dispatch) {
                    return true;
                }

                // Handle the case where there is a cursor but no selection range
                if ($cursor) {
                    /**
                     * If the cursor is positioned within a word, this allows 
                     * the entire word to be toggled with the specified mark.
                     */
                    const wordBound = ProseTools.Text.getWordBound(state.selection.$from);
                    if (wordBound) {
                        const { from, to } = wordBound;
                        const tr = state.tr;

                        const markExists = state.doc.rangeHasMark(from, to, markType);

                        if (markExists) {
                            // If the mark exists, remove it from the entire word
                            tr.removeMark(from, to, markType);
                        } else {
                            // Otherwise, apply the mark to the entire word
                            tr.addMark(from, to, markType.create(attrs));
                        }

                        dispatch(tr.scrollIntoView());
                    }

                    // not positioned within a word (within spaces)
                    else if (markType.isInSet(state.storedMarks || $cursor.marks())) {
                        dispatch(state.tr.removeStoredMark(markType));
                    } else {
                        dispatch(state.tr.addStoredMark(markType.create(attrs)));
                    }
                } 

                // have selection ranges
                else {
                    let shouldAddMark = !removeWhenPresent;
                    const tr = state.tr;

                    if (!enterAtoms) {
                        ranges = __removeInlineAtoms(ranges);
                    }

                    // Determine if the mark should be added or removed
                    if (removeWhenPresent) {
                        shouldAddMark = !ranges.some(range => 
                            state.doc.rangeHasMark(range.$from.pos, range.$to.pos, markType)
                        );
                    }

                    // Apply or remove the mark from the selected ranges
                    ranges.forEach(({ $from, $to }) => {
                        if (!shouldAddMark) {
                            tr.removeMark($from.pos, $to.pos, markType);
                        } else {
                            let from = $from.pos, to = $to.pos;
                            const startText = $from.nodeAfter, endText = $to.nodeBefore;

                            // Adjust for whitespace at the start and end of the range
                            const spaceStart = startText && startText.isText ? /^\s*/.exec(startText.text!)![0].length : 0;
                            const spaceEnd = endText && endText.isText ? /\s*$/.exec(endText.text!)![0].length : 0;
                            
                            if (from + spaceStart < to) {
                                from += spaceStart;
                                to -= spaceEnd;
                            }

                            tr.addMark(from, to, markType.create(attrs));
                        }
                    });

                    dispatch(tr.scrollIntoView());
                }

                return true;
            }
        }(schema);
    }

    /**
     * @description A command that set the specified block type on the current 
     * selection. 
     * 
     * The command performs the following steps:
     * 1. It checks if the selection contains a block that can be replaced with the target node type.
     * 2. If a suitable block is found, it either sets the block type or retains the current type, depending on the state and attributes.
     * 3. The block is applied across the selection range, and any required adjustments are made to ensure consistent application.
     */
    export function createSetBlockCommand<TType extends ProseNodeType>(
        schema: ICommandSchema, 
        nodeType: TType, 
        attrs: ProseAttrs | null = null
    ): Command {
        return new class extends EditorCommandBase {
            public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
                let applicable = false;

                // Step 1: Check if the block type can be applied to any node in the selection ranges
                for (const range of state.selection.ranges) {
                    const { $from, $to } = range;
                    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
                        
                        // Exit early if already applicable
                        if (applicable) {
                            return false; 
                        }

                        // Check if the current node can be replaced with the target nodeType
                        if (!node.isTextblock || node.hasMarkup(nodeType, attrs)) {
                            return;
                        }

                        // If the node type matches, mark it as applicable.
                        if (node.type === nodeType) {
                            applicable = true;
                        } else {
                            const $pos = state.doc.resolve(pos);
                            const index = $pos.index();
                            applicable = $pos.parent.canReplaceWith(index, index + 1, nodeType);
                        }
                    });

                    // Exit early if we already found an applicable node
                    if (applicable) {
                        break;
                    }
                }

                // If no applicable node was found, exit without making any changes
                if (!applicable) {
                    return false;
                }

                // Step 2: If dispatch is provided, apply the block type to the selection ranges
                if (dispatch) {
                    const tr = state.tr;
                    for (const range of state.selection.ranges) {
                        const { $from, $to } = range;
                        tr.setBlockType($from.pos, $to.pos, nodeType, attrs);
                    }
                    dispatch(tr.scrollIntoView());
                }

                return true;
            }
        }(schema);
    }

    export class InsertHardBreak extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void): boolean {
            const br = (<EditorSchema>state.schema).getNodeType(TokenEnum.LineBreak);
            if (!br) {
                return false;
            }
            
            if (dispatch) {
                dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
            }

            return true;
        }
    }
    
    export class FileSave extends EditorCommandBase {

        public run(provider: IServiceProvider, editor: IEditorWidget): boolean {
            editor.save()
                .match(
                    () => {},
                    error => {
                        const notificationService = provider.getOrCreateService(INotificationService);
                        notificationService.error(
                            `Failed to save file: ${error.message}`,
                            { actions: [ { label: 'Close', run: 'noop' }, ] }
                        );
                    }
                );
            return true;
        }
    }

    export class FileUndo extends EditorCommandBase {
        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            // const historyExtension = editor.getExtension(EditorExtensionIDs.History) as IEditorHistoryExtension;
            // return historyExtension['undo'](state, dispatch);
            return undo(state, dispatch, view);
        }
    }
    
    export class FileRedo extends EditorCommandBase {
        public run(provider: IServiceProvider, editor: IEditorWidget, state: ProseEditorState, dispatch?: (tr: ProseTransaction) => void, view?: ProseEditorView): boolean {
            // const historyExtension = editor.getExtension(EditorExtensionIDs.History) as IEditorHistoryExtension;
            // return historyExtension['redo'](state, dispatch);
            return redo(state, dispatch, view);
        }
    }
}

function __atBlockStart(state: ProseEditorState, view?: ProseEditorView): ProseResolvedPos | null {
    const { $cursor } = <ProseTextSelection>state.selection;
    if (!$cursor || (view ? !view.endOfTextblock("backward", state) : $cursor.parentOffset > 0)) {
        return null;
    }
    return $cursor;
}

function __atBlockEnd(state: ProseEditorState, view?: ProseEditorView): ProseResolvedPos | null {
    const { $cursor } = state.selection as ProseTextSelection;
    if (!$cursor || (view ? !view.endOfTextblock("forward", state) : $cursor.parentOffset < $cursor.parent.content.size)) {
        return null;
    }
    return $cursor;
  }

function __findCutBefore($pos: ProseResolvedPos): ProseResolvedPos | null {
    if ($pos.parent.type.spec.isolating) {
        return null;
    }

    for (let i = $pos.depth - 1; i >= 0; i--) {
        if ($pos.index(i) > 0) {
            const newPos = $pos.doc.resolve($pos.before(i + 1));
            return newPos;
        }

        if ($pos.getParentNodeAt(i)!.type.spec.isolating) {
            break;
        }
    }

    return null;
}

function __findCutAfter($pos: ProseResolvedPos): ProseResolvedPos | null {
    if ($pos.parent.type.spec.isolating) {
        return null;
    }

    for (let i = $pos.depth - 1; i >= 0; i--) {
        const parent = $pos.node(i);
        if ($pos.index(i) + 1 < parent.childCount) {
            const newPos = $pos.doc.resolve($pos.after(i + 1));
            return newPos;
        }
        if (parent.type.spec.isolating) {
            break;
        }
    }

    return null;
  }

function __deleteBarrier(state: ProseEditorState, $cut: ProseResolvedPos, dispatch: ((tr: ProseTransaction) => void) | undefined, dir: number) {
    const before = $cut.nodeBefore!;
    const after = $cut.nodeAfter!; 
    let conn: readonly ProseNodeType[] | null;
    let match: ProseContentMatch;

    const isolated = before.type.spec.isolating || after.type.spec.isolating;
    if (!isolated && __joinMaybeClear(state, $cut, dispatch)) {
        return true;
    }

    const canDelAfter = !isolated && $cut.parent.canReplace($cut.index(), $cut.index() + 1);
    if (canDelAfter &&
        (conn = (match = before.contentMatchAt(before.childCount)).findWrapping(after.type)) &&
        match.matchType(conn[0] || after.type)!.validEnd) {
        if (dispatch) {
            const end = $cut.pos + after.nodeSize;
            let wrap = ProseFragment.empty;

            for (let i = conn.length - 1; i >= 0; i--) {
                wrap = ProseFragment.from(conn[i]!.create(null, wrap));
            }

            wrap = ProseFragment.from(before.copy(wrap));
            const tr = state.tr.step(new ReplaceAroundStep($cut.pos - 1, end, $cut.pos, end, new ProseSlice(wrap, 1, 0), conn.length, true));
            const joinAt = end + 2 * conn.length;
            if (canJoin(tr.doc, joinAt)) {
                tr.join(joinAt);
            }

            dispatch(tr.scrollIntoView());
        }
        return true;
    }

    const selAfter = after.type.spec.isolating || (dir > 0 && isolated) ? null : ProseSelection.findFrom($cut, 1);
    const range = selAfter && selAfter.$from.blockRange(selAfter.$to), target = range && liftTarget(range);
    if (target !== null && target >= $cut.depth) {
        if (dispatch) dispatch(state.tr.lift(range!, target).scrollIntoView());
        return true;
    }

    if (canDelAfter && __textblockAt(after, "start", true) && __textblockAt(before, "end")) {
        let at = before;
        const wrap: ProseNode[] = [];
        
        for (; ;) {
            wrap.push(at);
            if (at.isTextblock) {
                break;
            }
            at = at.lastChild!;
        }
        
        let afterText = after;
        let afterDepth = 1;

        for (; !afterText.isTextblock; afterText = afterText.firstChild!) {
            afterDepth++;
        }

        if (at.canReplace(at.childCount, at.childCount, afterText.content)) {
            if (!dispatch) {
                return true;
            }
            
            let end = ProseFragment.empty;
            for (let i = wrap.length - 1; i >= 0; i--) {
                end = ProseFragment.from(wrap[i]!.copy(end));
            }

            const tr = state.tr.step(
                new ReplaceAroundStep(
                    $cut.pos - wrap.length, $cut.pos + after.nodeSize,
                    $cut.pos + afterDepth, $cut.pos + after.nodeSize - afterDepth,
                    new ProseSlice(end, wrap.length, 0), 
                    0, 
                    true
                )
            );
            dispatch(tr.scrollIntoView());
            return true;
        }
    }

    return false;
}

function __textblockAt(node: ProseNode, side: "start" | "end", only = false): boolean {
    for (let scan: ProseNode | null = node; scan; scan = (side === "start" ? scan.firstChild : scan.lastChild)) {
        if (scan.isTextblock) {
            return true;
        }
        if (only && scan.childCount !== 1) {
            return false;
        }
    }
    return false;
}

function __joinMaybeClear(state: ProseEditorState, $pos: ProseResolvedPos, dispatch: ((tr: ProseTransaction) => void) | undefined): boolean {
    const before = $pos.nodeBefore;
    const after = $pos.nodeAfter;
    const index = $pos.index();

    if (!before || !after || !before.type.compatibleContent(after.type)) {
        return false;
    }

    if (!before.content.size && $pos.parent.canReplace(index - 1, index)) {
        const newTr = state.tr.delete($pos.pos - before.nodeSize, $pos.pos);
        dispatch?.(newTr.scrollIntoView());
        return true;
    }
    
    if (!$pos.parent.canReplace(index, index + 1) || !(after.isTextblock || canJoin(state.doc, $pos.pos))) {
        return false;
    }

    const newTr = state.tr
        .clearIncompatible($pos.pos, before.type, before.contentMatchAt(before.childCount))
        .join($pos.pos)
        .scrollIntoView();

    dispatch?.(newTr);
    return true;
}

function __defaultBlockAt(match: ProseContentMatch) {
    for (let i = 0; i < match.edgeCount; i++) {
        const { type } = match.edge(i);
        if (type.isTextblock && !type.hasRequiredAttrs()) {
            return type;
        }
    }
    return null;
}

function __markApplies(doc: ProseNode, ranges: readonly ProseSelectionRange[], type: ProseMarkType, enterAtoms: boolean) {
    for (let i = 0; i < ranges.length; i++) {
        const { $from, $to } = ranges[i]!;
        let can = $from.depth === 0 ? doc.inlineContent && doc.type.allowsMarkType(type) : false;
        doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (can || !enterAtoms && node.isAtom && node.isInline && pos >= $from.pos && pos + node.nodeSize <= $to.pos) {
                return false;
            }
            can = node.inlineContent && node.type.allowsMarkType(type);
        });
        if (can) {
            return true;
        }
    }
    return false;
}

function __removeInlineAtoms(ranges: readonly ProseSelectionRange[]): readonly ProseSelectionRange[] {
    const result: ProseSelectionRange[] = [];
    
    for (let i = 0; i < ranges.length; i++) {
        let $from = ranges[i]!.$from;
        const $to = ranges[i]!.$to;

        $from.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (node.isAtom && node.content.size && node.isInline && pos >= $from.pos && pos + node.nodeSize <= $to.pos) {
                if (pos + 1 > $from.pos) {
                    result.push(new ProseSelectionRange($from, $from.doc.resolve(pos + 1)));
                }
                $from = $from.doc.resolve(pos + 1 + node.content.size);
                return false;
            }
        });
        if ($from.pos < $to.pos) {
            result.push(new ProseSelectionRange($from, $to));
        }
    }

    return result;
}