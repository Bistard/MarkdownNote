import { IDomBox, Position } from "src/base/common/utilities/size";
import { isDefined } from "src/base/common/utilities/type";
import { ProseContentMatch, ProseCursor, ProseEditorState, ProseEditorView, ProseNode, ProseNodeType, ProseResolvedPos, ProseSelection, ProseTransaction } from "src/editor/common/proseMirror";

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
export namespace ProseUtils {

    // region - [view-related]

    export namespace Cursor {
        
        /**
         * @description Determines if the current selection is empty, which 
         * means the selection behaves like a single cursor.
         */
        export function isCursor(selection: ProseSelection): selection is ProseCursor {
            return selection.empty;
        }

        /**
         * @description If the current cursor is on an empty text block.
         */
        export function isOnEmpty(selection: ProseCursor): boolean {
            const parent = selection.$from.parent;
            return parent.isTextblock && parent.textContent === '';
        }

        export function getPositionDoc(selection: ProseCursor): number | undefined {
            const { $from } = selection;
            return $from.pos;
        }
    
        // export function getPositionDom(view: ProseEditorView): Position | undefined {
        //     const position = getPositionDoc(view.state.selection);
        //     if (!isDefined(position)) {
        //         return undefined;
        //     }
        //     const coordinate = view.coordsAtPos(position);
        //     return new Position(coordinate.top, coordinate.left);
        // }
    
        export function getParentPositionDoc(selection: ProseCursor): number | undefined {
            const { $from } = selection;
            if (!selection.empty) {
                return undefined;
            }
    
            const parentPos = $from.before(1);
            return parentPos;
        }
    
        // export function getParentPositionDom(view: ProseEditorView): IDomBox | undefined {
        //     const parentPosition = getParentPositionDoc(view.state.selection);
        //     if (!isDefined(parentPosition)) {
        //         return undefined;
        //     }
    
        //     const dom = view.nodeDOM(parentPosition) as HTMLElement | null;
        //     if (!dom) {
        //         return undefined;
        //     }
    
        //     const rect = dom.getBoundingClientRect();
        //     return {
        //         left: rect.left,
        //         top: rect.top,
        //         width: rect.width,
        //         height: rect.height,
        //     };
        // }
    }

    export namespace Position {
        export function getPositionDocBlock(selection: ProseCursor): number {
            const { $from } = selection;
            const blockPos = $from.start($from.depth) - 1;
            return blockPos;
        }
    }

    // region - [state-related]

    /**
     * @description Get the entire document size.
     */
    export function getEntireDocumentSize(state: ProseEditorState): number {
        return state.doc.content.size;
    }

    export function getResolvedPositionAt(state: ProseEditorState, position: number): ProseResolvedPos {
        return state.doc.resolve(position);
    }

    export function getNodeAt(state: ProseEditorState, position: number): ProseNode {
        return state.doc.resolve(position).getCurrNode();
    }

    export function appendTextToEnd(state: ProseEditorState, text: string): ProseTransaction {
        const docEnd = state.doc.content.size;
        return state.tr.insertText(text, docEnd);
    }

    // region - [node-related]

    /**
     * @description Get the entire content size of the given node.
     * @note The returned size includes the open and close tokens of the node.
     * @note DO NOT use this function for getting the entire document size. Use
     *      {@link getEntireDocumentSize} instead.
     */
    export function getNodeSize(node: ProseNode): number {
        return node.nodeSize;
    }

    export function *iterateChild(node: ProseNode): IterableIterator<{ node: ProseNode, offset: number, index: number }> {
        const fragment = node.content;
        let offset = 0;
        for (let i = 0; i < fragment.childCount; i++) {
            const child = fragment.maybeChild(i)!;
            yield { node: child, offset: offset, index: i };
            offset += child.nodeSize;
        }
    }

    export function getNextValidDefaultNodeTypeAt(node: ProseNode, position: number): ProseNodeType | null {
        const match = node.contentMatchAt(position);
        return getNextValidDefaultNodeType(match);
    }

    export function getNextValidDefaultNodeType(match: ProseContentMatch): ProseNodeType | null {
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
     * `hel|lo world` will returns `{ from: 0; to: 5 }` which contains the word `hello`.
     */
    export function getWordBound(pos: ProseResolvedPos): { from: number; to: number } | null {
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
}