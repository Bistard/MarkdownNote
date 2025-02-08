import { Numbers } from "src/base/common/utilities/number";
import { assert } from "src/base/common/utilities/panic";
import { ProseSelection, ProseCursor, ProseEditorState, ProseNode, ProseTransaction, ProseResolvedPos, ProseNodeType, ProseContentMatch, ProseAllSelection } from "src/editor/common/proseMirror";

/**
 * @description Contains a list of helper functions that relates to ProseMirror.
 * 
 * @note 
 * - The start of the document, right before the first content, is position 0.
 * - Entering or leaving a node that is not a leaf node (i.e. supports content) 
 *      counts as one token. So if the document starts with a paragraph, the 
 *      start of that paragraph counts as position 1.
 * - Each character in text nodes counts as one token. So if the paragraph at 
 *      the start of the document contains the word “hi”, position 2 is after 
 *      the “h”, position 3 after the “i”, and position 4 after the whole 
 *      paragraph.
 * - Leaf nodes that do not allow content (such as images) also count as a 
 *      single token.
 * @example
 * ```
 * 0   1 2 3 4    5
 *  <p> O n e </p>
 * 
 * 5            6   7 8 9 10     11    12             13
 *  <blockquote> <p> T w o  <img>  </p>  </blockquote>
 * ```
 */
export namespace ProseTools {

    export namespace Cursor {
        export const isCursor = __isCursor;
        export const isOnEmpty = __isOnEmpty;
        export const getPosition = __getPosition;
        export const getCurrNode = __getCurrNode;
        export const setCursorAt = __setCursorAt;
    }

    export namespace Selection {
        export const isFullSelection = __isFullSelection;
    }

    export namespace Position {
        export const isValid = __isValid;
        export const clamp = __clamp;
        export const resolve = __resolve;
        export const getNodeAt = __getNodeAtPosition;
        export const isSameParent = __isSameParent;
    }

    export namespace Node {
        export const getDocumentSize = __getDocumentSize;
        export const getNodeSize = __getNodeSize;
        export const isTextBlock = __isTextBlock;
        export const isInline = __isInline;
        export const isLeaf = __isLeaf;
        export const iterateChild = __iterateChild;

        export const getNextValidDefaultNodeTypeAt = __getNextValidDefaultNodeTypeAt;
        export const getNextValidDefaultNodeType = __getNextValidDefaultNodeType;
    }

    export namespace Text {
        export const getWordBound = __getWordBound;
        export const appendTextToEnd = __appendTextToEnd;
    }
}

// +-----------------------------------------+
// + Function Implementations (Non-exported) +
// +-----------------------------------------+

/**
 * @description Determines if the current selection is empty, which 
 * means the selection behaves like a single cursor.
 */
function __isCursor(selection: ProseSelection): selection is ProseCursor {
    return selection.empty;
}

/**
 * @description If the current cursor is on an empty text block.
 */
function __isOnEmpty(cursor: ProseCursor): boolean {
    const parent = cursor.$from.parent;
    return parent.isTextblock && parent.textContent === '';
}

function __getPosition(cursor: ProseCursor): number {
    return cursor.$from.pos;
}

function __getCurrNode(cursor: ProseCursor, state: ProseEditorState): ProseNode {
    return assert(state.doc.nodeAt(cursor.$from.pos));
}

function __setCursorAt(state: ProseEditorState, position: number): ProseTransaction {
    const tr = state.tr;
    const $pos = state.doc.resolve(position);
    tr.setSelection(ProseSelection.near($pos));
    return tr;
}

function __isFullSelection(state: ProseEditorState): boolean {
    const { selection } = state;
    return selection instanceof ProseAllSelection || selection.from === 0 && selection.to === ProseTools.Node.getDocumentSize(state);
}

function __isValid(state: ProseEditorState, position: number): boolean {
    return position >= 0 && position <= state.doc.content.size;
}

function __clamp(state: ProseEditorState, position: number): number {
    return Numbers.clamp(position, 0, state.doc.content.size);
}

function __resolve(state: ProseEditorState, position: number): ProseResolvedPos {
    return state.doc.resolve(position);
}

function __getNodeAtPosition(state: ProseEditorState, position: number): ProseNode {
    return __resolve(state, position).getCurrNode();
}

function __isSameParent(position1: ProseResolvedPos, position2: ProseResolvedPos): boolean {
    return position1.sameParent(position2);
}

/**
 * @description Get the entire document size.
 */
function __getDocumentSize(state: ProseEditorState): number {
    return state.doc.content.size;
}

/**
 * @description Get the entire content size of the given node.
 * @note The returned size includes the open and close tokens of the node.
 * @note DO NOT use this function for getting the entire document size. Use
 *      {@link getDocumentSize} instead.
 */
function __getNodeSize(node: ProseNode): number {
    return node.nodeSize;
}

/**
 * @description Check if the node is a textblock.
 */
function __isTextBlock(node: ProseNode): boolean {
    return node.isTextblock;
}

/**
 * @description Check if the node is inline.
 */
function __isInline(node: ProseNode): boolean {
    return node.isInline;
}

/**
 * @description Check if the node is a leaf node (no child).
 */
function __isLeaf(node: ProseNode): boolean {
    return node.isLeaf;
}

function *__iterateChild(node: ProseNode): IterableIterator<{ node: ProseNode, offset: number, index: number }> {
    const fragment = node.content;
    let offset = 0;
    for (let i = 0; i < fragment.childCount; i++) {
        const child = fragment.maybeChild(i)!;
        yield { node: child, offset: offset, index: i };
        offset += child.nodeSize;
    }
}

function __getNextValidDefaultNodeTypeAt(node: ProseNode, position: number): ProseNodeType | null {
    const match = node.contentMatchAt(position);
    return __getNextValidDefaultNodeType(match);
}

function __getNextValidDefaultNodeType(match: ProseContentMatch): ProseNodeType | null {
    for (let i = 0; i < match.edgeCount; i++) {
        const { type } = match.edge(i);
        if (type.isTextblock && !type.hasRequiredAttrs()) {
            return type;
        }
    }
    return null;
}

/**
 * @description Gets the boundaries of the word at the given position.
 * @param pos The resolved position in the document.
 * @returns The start and end positions of the word, or null if no word is found.
 * 
 * ### Example
 * `hel|lo world` will return `{ from: 0; to: 5 }` which contains the word `hello`.
 */
function __getWordBound(pos: ProseResolvedPos): { from: number; to: number } | null {
    const text = pos.parent.textContent;
    const offset = pos.parentOffset;

    if (!text) {
        return null;
    }

    let start = offset;
    while (start > 0 && /\w/.test(text[start - 1]!)) {
        start--;
    }

    let end = offset;
    while (end < text.length && /\w/.test(text[end]!)) {
        end++;
    }

    if (start === end) {
        return null;
    }

    const from = pos.start() + start;
    const to = pos.start() + end;
    return { from, to };
}

function __appendTextToEnd(state: ProseEditorState, text: string): ProseTransaction {
    const docEnd = state.doc.content.size;
    return state.tr.insertText(text, docEnd);
}
