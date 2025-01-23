import { ByteSize } from "src/base/common/files/file";
import { Character, CharCode } from "src/base/common/utilities/char";
import { Mutable } from "src/base/common/utilities/type";
import { EndOfLine, IBufferPosition, IPiece, IPiecePosition, IPieceTable, IPieceNode, RBColor, IPieceNodePosition } from "src/editor/common/model";
import { EditorPosition, IEditorPosition } from "src/editor/common/position";
import { TextBuffer } from "src/editor/model/textBuffer/textBuffer";

/**
 * @internal
 * @class Each {@link Piece} only refers to a {@link TextBuffer} (either `added` 
 * or `original`) inside the {@link PieceTable}.
 * 
 * Printing all the {@link Piece}s inside {@link PieceTable} in the in-order way 
 * is the actual text model.
 */
class Piece implements IPiece {

    public readonly bufferIndex: number;
    public readonly pieceLength: number;
    public readonly lfCount: number;
    public readonly start: IBufferPosition;
    public readonly end: IBufferPosition;

    constructor(bufferIndex: number, pieceLength: number, lfCount: number, start: IBufferPosition, end: IBufferPosition) {
        this.bufferIndex = bufferIndex;
        this.pieceLength = pieceLength;
        this.lfCount = lfCount;
        this.start = start;
        this.end = end;
    }
}

/**
 * @internal
 * @class A tree node used in {@link PieceTable}.
 * 
 * @note Note that the constructor will not point the parent / left / right all 
 * to the {@link NULL_NODE}. Use static method `create()` instead.
 */
class PieceNode implements IPieceNode {

    // [field]

    public color: RBColor;

    public parent: PieceNode;
    public left: PieceNode;
    public right: PieceNode;

    public leftSubtreeBufferLength: number;
    public leftSubtreelfCount: number;

    public piece: Piece;

    // [constructor]

    constructor(piece: Piece, color: RBColor) {
        this.parent = this;
        this.left = this;
        this.right = this;
        this.leftSubtreeBufferLength = 0;
        this.leftSubtreelfCount = 0;
        this.color = color;
        this.piece = piece;
    }

    // [public static method]

    public static create(piece: Piece, color: RBColor): PieceNode {
        const newnode = new PieceNode(piece, color);
        newnode.parent = NULL_NODE;
        newnode.left = NULL_NODE;
        newnode.right = NULL_NODE;
        return newnode;
    }

    // [public methods]

    /**
     * @description Copies the left / right / parent / color from node2 to node1.
     */
    public static copy(node1: PieceNode, node2: PieceNode): void {
        node1.left = node2.left;
        node1.right = node2.right;
        node1.parent = node2.parent;
        node1.color = node2.color;
    }

    /**
     * @description Removes the relationthip between any of the other nodes.
     */
    public static isolate(node: PieceNode): void {
        node.left = NULL_NODE;
        node.right = NULL_NODE;
        node.parent = NULL_NODE;
    }

    /**
     * @description Returns the next node of the current node (pre-order). If 
     * not found, {@link NULL_NODE} will be returned.
     */
    public static next(node: PieceNode): PieceNode {
        if (node.right !== NULL_NODE) {
			const leftMost = PieceNode.leftMost(node.right);
            return leftMost === NULL_NODE ? node.right : leftMost;
		}

		while (node.parent !== NULL_NODE) {
			if (node.parent.left === node) {
				break;
			}
			node = node.parent;
		}

		if (node.parent === NULL_NODE) {
			return NULL_NODE;
		}
        return node.parent;
    }

    /**
     * @description Returns the previous node of the current node (pre-order). 
     * If not found, {@link NULL_NODE} will be returned.
     */
    public static prev(node: PieceNode): PieceNode {
        if (node.left !== NULL_NODE) {
			const rightMost = PieceNode.rightMost(node.left);
            return rightMost === NULL_NODE ? node.left : rightMost;
		}

		while (node.parent !== NULL_NODE) {
			if (node.parent.right === node) {
				break;
			}
			node = node.parent;
		}

		if (node.parent === NULL_NODE) {
			return NULL_NODE;
		}
        return node.parent;
    }

    /**
     * @description Returns the left most tree node of the given node. 
     * @note If the given node is {@link NULL_NODE} or has no left-subtree, a
     * {@link NULL_NODE} will be returned.
     * 
     * @complexity O(h)
     */
    public static leftMost(node: PieceNode): PieceNode {
        if (!node.piece || node.left === NULL_NODE) {
            return NULL_NODE;
        }
        
        while (node.left !== NULL_NODE) {
            node = node.left;
        }
        return node;
    }

    /**
     * @description Returns the right most tree node of the given node. 
     * @note If the given node is {@link NULL_NODE} or has no right-subtree, a
     * {@link NULL_NODE} will be returned.
     * 
     * @complexity O(h)
     */
    public static rightMost(node: PieceNode): PieceNode {
        if (!node.piece || node.right === NULL_NODE) {
            return NULL_NODE;
        }

        while (node.right !== NULL_NODE) {
            node = node.right;
        }
        return node;
    }

    /**
     * @description Calculates the total buffer length of the given node. 
     * Includes its left-subtree, right-subtree and its own buffer length.
     * 
     * @complexity O(h)
     */
    public static totalBufferLength(node: PieceNode): number {
        if (node === NULL_NODE) {
            return 0;
        }
        return node.leftSubtreeBufferLength + node.piece.pieceLength + PieceNode.totalBufferLength(node.right);
    }

    /**
     * @description Calculates the total linefeed count of the given node. Includes
     * its left-subtree, right-subtree and its own linefeed count.
     * 
     * @complexity O(h)
     */
    public static totalLinefeedCount(node: PieceNode): number {
        if (node === NULL_NODE) {
            return 0;
        }
        return node.leftSubtreelfCount + node.piece.lfCount + PieceNode.totalLinefeedCount(node.right);
    }

}

/** 
 * @internal
 * The null node as a leaf.
 */
const NULL_NODE = new PieceNode(null!, RBColor.BLACK);
NULL_NODE.parent = NULL_NODE;
NULL_NODE.left = NULL_NODE;
NULL_NODE.right = NULL_NODE;

/**
 * @class A {@link PieceTable} is an efficient data structure for fast text
 * editing which is commonly used in a text editor.
 * 
 * I. Insertion and deletion are extremely fast in this data structure.
 * 
 * II. Using a single string to represent `original` and `added` may hurts the
 * performance in some circumstances:
 *      1. V8 engine did not support string length over 256MB back at time.
 *      2. String concatenation is inefficient and stupid.
 * Instead, every time when the program reads a chunk of bytes, say 256KB per 
 * time, it will be stored directly into a {@link TextBuffer} and create a 
 * {@link PieceNode} that points to it.
 * 
 * III. When creating a {@link TextBuffer}, program will read through the buffer
 * and count all the linefeeds for later fast querying by line numbers. Since 
 * each {@link TextBuffer} is readonly, the performance cost is worthy.
 * 
 * IV. The whole class is built upon a red-black tree. Unlike the basic ones, 
 * each {@link PieceNode} also maintains the left-subtree total buffer length 
 * and the left-subtree total linefeed count. The tree uses these two metadata 
 * as the key to compare between nodes. In this case, we can search a 
 * {@link Piece} either: 
 *      1. by the offset of the whole text 
 *      2. by the absolute line number 
 * both under the O(logn) situation.
 * 
 * The more detailed idea can be found at the blog of VSCode:
 *  - {@link https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation}
 */
export class PieceTable implements IPieceTable {

    // [field]

    /**
     * APPEND-ONLY BUFFER
     *      - [0]: added buffer
     *      - [i]: original buffer, 1 <= i
     */
    private readonly _buffer: TextBuffer[];

    private _lastAddBufferPosition: IBufferPosition;

    private _root: PieceNode;

    private _bufferLength: number;
    private _lineFeedCount: number;

    private _shouldBeNormalized: boolean;
    private _normalizedEOL: EndOfLine;

    public static readonly AVERAGE_BUFFER_SIZE = 64 * ByteSize.KB;

    // [constructor]

    constructor(chunks: TextBuffer[], shouldBeNormalized: boolean, normalizedEOL: EndOfLine) {
        this._buffer = [new TextBuffer('', [0])];
        this._lastAddBufferPosition = { lineNumber: 0, lineOffset: 0 };
        this._root = NULL_NODE;
        this._bufferLength = 0;
        this._lineFeedCount = 1;
        this._shouldBeNormalized = shouldBeNormalized;
        this._normalizedEOL = normalizedEOL;
        
        let bufferIndex = 1;
        let i = 0;
        const strlen = chunks.length;
        let node = NULL_NODE;
        for (i = 0; i < strlen; i++) {
            const { buffer, linestart } = chunks[i]!;
            
            // since the buffer is empty, no need to store as a node.
            if (buffer.length === 0) {
                continue;
            }

            const piece = this.__constructNewPiece(bufferIndex++, buffer.length, linestart);
            this._buffer.push(chunks[i]!);
            node = this.__insertAsSuccessor(node, piece);
        }

        this.__updateTableMetadata();
    }

    // [public methods - node]

    get root(): IPieceNode { return this._root; }

    /**
     * @description Iterates each tree node in pre-order.
     * @param fn Function applies to each node.
     * 
     * @note This will not go through each leaf (null node).
     */
    public forEach(fn: (node: PieceNode) => void): void {
        this.__preOrder(this._root, fn);
    }

    // [public methods - piece table]

    public insertAt(textOffset: number, text: string): void {
        
        if (textOffset < 0) {
            return;
        }

        // empty tree, insert as root
        if (this._root === NULL_NODE) {
            const pieces = this.__createNewPieces(text);
            let node = NULL_NODE;
            for (const piece of pieces) {
                node = this.__insertAsSuccessor(node, piece);
            }
        }
        // non-empty, complicated stuff
        else {
            const { position, pieceOffset } = this.__getNodeByOffset(textOffset);
            const nodeOffset = position.textOffset;
            const node = position.node;
            const piece = node.piece;
            const startBufferPosition = this.__getPositionInBufferAt(piece, pieceOffset);
            /**
             * If inserting to the end of the piece which is also the last piece 
             * in the add buffer, we first need to check CRLF situation, then
             * instead of creating a new piece, we simply extend that piece.
             */
            if (node.piece.bufferIndex === 0 &&
				piece.end.lineNumber === this._lastAddBufferPosition.lineNumber &&
				piece.end.lineOffset === this._lastAddBufferPosition.lineOffset &&
				(nodeOffset + piece.pieceLength === textOffset) &&
				text.length < PieceTable.AVERAGE_BUFFER_SIZE
			) {
                this.__extendLastAddBufferPiece(node, text);
            }

            // inserting at the start of the piece
            else if (nodeOffset === textOffset) {
                this.__insertLeft(node, text);
            } 
            
            /**
             * Inserting at the middle of the piece. We need to split the 
             * current piece into left two pieces, and insert the new text as a 
             * new piece to the middle.
             */
            else if (piece.pieceLength > textOffset - nodeOffset) {
                this.__insertMiddle(node, text, pieceOffset, startBufferPosition);
            }
            // inserting at the end the piece
            else {
                this.__insertRight(node, text);
            }
        }

        this.__updateTableMetadata();
    }

    public deleteAt(textOffset: number, length: number): void {
        
        if (length < 0 || this._root === NULL_NODE) {
            return;
        }

        const startNodePosition = this.__getNodeByOffset(textOffset);
        const endNodePosition = this.__getNodeByOffset(textOffset + length);
        const startNode = startNodePosition.position.node;
        const endNode = endNodePosition.position.node;

        const startDeleteBufferPosition = this.__getPositionInBufferAt(startNode.piece, startNodePosition.pieceOffset);
        const endDeleteBufferPosition = this.__getPositionInBufferAt(endNode.piece, endNodePosition.pieceOffset);

        // deleting text are in the same piece
        if (startNode === endNode) {

            // deletion starts at the beginning of the node
            if (startNodePosition.position.textOffset === textOffset) {
                // only deleting the whole node
                if (startNode.piece.pieceLength === length) {
                    const nextNode = PieceNode.next(startNode);
                    this.__deleteNode(startNode);
                    this.__validateCRLFwithPrevNode(nextNode);
                    this.__updateTableMetadata();
                    return;
                } 
                // only deleting the head part of the node
                else {
                    this.__deletePieceHeadAt(startNode, endDeleteBufferPosition);
                    this.__validateCRLFwithPrevNode(startNode);
                }
            }
            // deletion ends at the ending of the node
            else if (startNodePosition.position.textOffset + startNode.piece.pieceLength === textOffset + length) {
                this.__deletePieceTailAt(startNode, startDeleteBufferPosition);
                this.__validateCRLFwithNextNode(startNode);
            }
            // deletion happens in the middle of the node
            else {
                const middleNode = this.__deletePieceMiddleAt(startNode, startDeleteBufferPosition, endDeleteBufferPosition);
                this.__validateCRLFwithPrevNode(middleNode);
            }

            this.__updateTableMetadata();
            return;
        }

        // Deletion affects multiple nodes (pieces).
        const toBeDeleted: PieceNode[] = [];

        this.__deletePieceTailAt(startNode, startDeleteBufferPosition);
        if (startNode.piece.pieceLength === 0) {
            toBeDeleted.push(startNode);
        }

        this.__deletePieceHeadAt(endNode, endDeleteBufferPosition);
        if (endNode.piece.pieceLength === 0) {
            toBeDeleted.push(endNode);
        }

        let node = PieceNode.next(startNode);
        for (; node !== endNode; node = PieceNode.next(node)) {
            toBeDeleted.push(node);
        }
        
        const prevNode = startNode.piece.pieceLength ? startNode : PieceNode.prev(startNode);
        this.__deleteNodes(toBeDeleted);
        this.__validateCRLFwithNextNode(prevNode);

        this.__updateTableMetadata();
    }

    public getContent(): string[] {
        
        // these lines will not contain any CR / LF / CRLF.
        const lines: string[] = [];
        let currLineBuffer = '';
        let danglingCarriageReturn = false;

        this.forEach(node => {

            const piece = node.piece;
            let pieceLength = piece.pieceLength;
            
            if (pieceLength === 0) {
                return;
            }
            
            const buffer = this._buffer[piece.bufferIndex]!.buffer;
            const linestart = this._buffer[piece.bufferIndex]!.linestart;

            const pieceStartLine = piece.start.lineNumber;
            const pieceEndLine = piece.end.lineNumber;
            
            // the first character offset of the piece
            let firstCharOffset = linestart[piece.start.lineNumber]! + piece.start.lineOffset;

            /**
             * If the previous piece has a CR at the end, we should refresh the 
             * line buffer.
             */
            if (danglingCarriageReturn) {
                /**
                 * The CRLF is splitted into two pieces, we pretend LF is at the 
                 * previous one.
                 */
                if (buffer.charCodeAt(firstCharOffset) === CharCode.LineFeed) {
                    firstCharOffset++;
                    pieceLength--;
                }

                /**
                 * We refresh line buffer since we know there is a CRLF before 
                 * this piece.
                 */
                lines.push(currLineBuffer);
                currLineBuffer = '';
                danglingCarriageReturn = false;

                /**
                 * Meaning the current piece only contains a LF, we ignore this 
                 * piece to next one.
                 */
                if (pieceLength === 0) {
                    return;
                }
            }

            /**
             * The piece is just one single line, we stores this line and 
             * iterate next node.
             */
            if (piece.start.lineNumber === piece.end.lineNumber) {
                
                if (this._shouldBeNormalized === false && 
                    buffer.charCodeAt(firstCharOffset + pieceLength - 1) === CharCode.CarriageReturn
                ) {
                    /**
                     * The end of the piece contains a CR, it is possible that
                     * a CRLF got splitted into two pieces, so we mark it as 
                     * dangling and ignore the CR character until next node.
                     */
                    danglingCarriageReturn = true;
                    currLineBuffer += buffer.substring(firstCharOffset, firstCharOffset + pieceLength - 1);
                } else {
                    currLineBuffer += buffer.substring(firstCharOffset, firstCharOffset + pieceLength);
                }
                
                return;
            }

            /**
             * Now the piece will contain multiple lines. We need to use three
             * different stages to store these lines:
             *      - store the first line (partial)
             *      - store the middle lines (full)
             *      - store the last line (partial)
             */
            
            // save the first partial line
            if (this._shouldBeNormalized) {
                /**
                 * Since it's normalized, it guarantees the length of eol. Use
                 * Math.max() to guarantee the range is valid.
                 */
                currLineBuffer += buffer.substring(firstCharOffset, Math.max(firstCharOffset, linestart[pieceStartLine + 1]! - this._normalizedEOL.length));
            } else {
                /**
                 * Since it's not normalized, we cannot ensure the length of eol,
                 * we need to manually remove them.
                 */
                currLineBuffer += buffer.substring(firstCharOffset, linestart[pieceStartLine + 1]!).replace(/(\r\n|\r|\n)$/, '');
            }
            lines.push(currLineBuffer);

            // save all the middle lines completely
            for (let line = pieceStartLine + 1; line < pieceEndLine; line++) {
                if (this._shouldBeNormalized) {
                    currLineBuffer = buffer.substring(linestart[line]!, linestart[line + 1]! - this._normalizedEOL.length);
                } else {
                    currLineBuffer = buffer.substring(linestart[line]!, linestart[line + 1]).replace(/(\r\n|\r|\n)$/, '');
                }

                lines.push(currLineBuffer);
            }

            /**
             * Saving the last partial line, we need to handle the possible 
             * dangling CR situation again.
             */
            const lastLineOffset = linestart[pieceEndLine]!;
            if (this._shouldBeNormalized === false &&
                buffer.charCodeAt(linestart[pieceEndLine]! + piece.end.lineOffset - 1) === CharCode.CarriageReturn
            ) {
                danglingCarriageReturn = true;
                if (piece.end.lineOffset === 0) {
                    /**
                     * The last line only has a CR, undo the push until the next
                     * node.
                     */
                    lines.pop();
                } else {
                    // ignore the CR
                    currLineBuffer = buffer.substring(lastLineOffset, lastLineOffset + piece.end.lineOffset - 1);
                }
            } else {
                currLineBuffer = buffer.substring(lastLineOffset, lastLineOffset + piece.end.lineOffset);
            }
            
            return;
        });

        if (danglingCarriageReturn) {
            lines.push(currLineBuffer);
            currLineBuffer = '';
        }

        lines.push(currLineBuffer);

        return lines;
    }

    public getRawContent(): string {
        let raw = '';

		this.__preOrder(this._root, node => {
			raw += this.__getNodeContent(node);
		});

		return raw;
    }

    public getLine(lineNumber: number): string {
        let line: string;
        if (this._shouldBeNormalized) {
            line = this.__getRawLine(lineNumber, this._normalizedEOL.length);
        } else {
            line = this.__getRawLine(lineNumber).replace(/(\r\n|\r|\n)$/, '');
        }
        return line;
    }

    public getRawLine(lineNumber: number): string {
        return this.__getRawLine(lineNumber, 0);
    }

    public getLineLength(lineNumber: number): number {
        if (lineNumber === this.getLineCount()) {
			const startOffset = this.getOffsetAt(lineNumber, 0);
			return this.getBufferLength() - startOffset;
		}

        const length = this.getOffsetAt(lineNumber + 1, 0) - this.getOffsetAt(lineNumber, 0);
		if (this._shouldBeNormalized) {
            return length - this._normalizedEOL.length;
        } 

        const lineEndOffset = this.getOffsetAt(lineNumber, length - 1);
        const lastChar = this.getCharcodeByOffset(lineEndOffset);
        
        if (lastChar === CharCode.CarriageReturn) {
            return length - 1;
        } else if (lastChar === CharCode.LineFeed) {
            if (length >= 2 && this.getCharcodeByOffset(lineEndOffset - 1) === CharCode.CarriageReturn) {
                return length - 2;
            }
            return length - 1;
        }
        
        return length;
    }

    public getRawLineLength(lineNumber: number): number {
        return this.getOffsetAt(lineNumber + 1, 0) - this.getOffsetAt(lineNumber, 0);
    }

    public getBufferLength(): number {
        return this._bufferLength;
    }

    public getLineCount(): number {
        return this._lineFeedCount;
    }

    public getOffsetAt(lineNumber: number, lineOffset: number): number {

        let offset = 0;
        let node = this._root;
        
        while (node !== NULL_NODE) {
            // left piece may has partial content of the required line
            if (node.left !== NULL_NODE && node.leftSubtreelfCount >= lineNumber) {
                node = node.left;
            } 
            // current piece has the required line
            else if (node.piece.lfCount >= lineNumber - node.leftSubtreelfCount) {
                lineNumber -= node.leftSubtreelfCount;
                const piece = node.piece;
                const linestart = this._buffer[piece.bufferIndex]!.linestart;
                const desiredLineStartOffset = linestart[lineNumber]!;
                const pieceStartOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.start);
                const desiredBufferOffset = pieceStartOffset + desiredLineStartOffset;
                offset += node.leftSubtreeBufferLength + desiredBufferOffset + lineOffset;
                return offset;
            } 
            // go right
            else {
                lineNumber -= (node.leftSubtreelfCount + node.piece.lfCount);
                offset += (node.leftSubtreeBufferLength + node.piece.pieceLength);
                node = node.right;
            }
        }

        return offset;
    }

    public getPositionAt(textOffset: number): IEditorPosition {
        
        let node = this._root;
        let lineNumber = 0;
        const initTextOffset = textOffset;

        while (node !== NULL_NODE) {
            // left piece has enough buffer length for the required text offset.
            if (node.leftSubtreeBufferLength >= textOffset) {
                node = node.left;
            }
            // current piece has enough buffer length for the required text offset.
            else if (node.piece.pieceLength >= textOffset - node.leftSubtreeBufferLength) {
                const pieceOffset = textOffset - node.leftSubtreeBufferLength;
                const position = this.__getPositionInPieceAt(node.piece, pieceOffset);
                lineNumber += node.leftSubtreelfCount + position.lineNumber;
                
                if (position.lineNumber === 0) {
                    const lineStartOffset = this.getOffsetAt(lineNumber, 0);
                    const lineOffset = initTextOffset - lineStartOffset;
                    return new EditorPosition(lineNumber, lineOffset);
                }
                
                return new EditorPosition(lineNumber, position.lineOffset);
            }
            // go right
            else {
                textOffset -= node.leftSubtreeBufferLength + node.piece.pieceLength;
                lineNumber += node.leftSubtreelfCount + node.piece.lfCount;

                /**
                 * The provided offset exceeds the total buffer length, we 
                 * return the maximum offset for robustness.
                 */
                if (node.right === NULL_NODE) {
                    const lineStartOffset = this.getOffsetAt(lineNumber, 1);
                    const lineOffset = initTextOffset - textOffset - lineStartOffset;
                    return new EditorPosition(lineNumber, lineOffset);
                }

                node = node.right;
            }
        }
        
        // reach the left-most node
        return new EditorPosition(0, 0);
    }
    
    public getCharcodeByOffset(textOffset: number): number {
        const { position, pieceOffset } = this.__getNodeByOffset(textOffset);
        return this.__getCharcodeAt(position, pieceOffset);
    }

    public getCharcodeByLine(lineNumber: number, lineOffset: number): number {
        const { position, pieceOffset } = this.__getNodeByLine(lineNumber, lineOffset);
        return this.__getCharcodeAt(position, pieceOffset);
    }

    // [private helper methods - node]

    /**
     * @description Since the inserted text may be too long, string related 
     * operations may become slow. We may want to split into multiple pieces 
     * instead of just one. 
     * @param text The plain text.
     */
    private __createNewPieces(text: string): IPiece[] {
        
        if (text.length > PieceTable.AVERAGE_BUFFER_SIZE) {
            return this.__splitIntoPieces(text);
        }

        const addBuffer: Mutable<TextBuffer> = this._buffer[0]!;
        let addBufferLength = addBuffer.buffer.length;
        const linestart = TextBuffer.readLineStarts(text, addBufferLength).linestart;
        
        let pieceStartPosition = this._lastAddBufferPosition;

        /**
         * Creating new pieces meaning adding text to the add buffer. We need to
         * check the CRLF situation here. An important fact needs to be noticed:
         * when a {@link IPiece} points to the add buffer is detecting the CRLF
         * situation during operations like insert / delete, it cannot determine
         * a 'CRLF' should be treated as a whole, or a 'CR' and a 'LF'. To fix
         * this, we did a trick here by split the CRLF using a character so that 
         * in a {@link IPiece} perspective, it will not be treated like a whole.
         */
        if (addBuffer.linestart[addBuffer.linestart.length - 1]! === addBufferLength
            && addBufferLength !== 0 
            && this.__startWithLF(text) && this.__endWithCR(addBuffer.buffer)
        ) {
            this._lastAddBufferPosition = {
				lineNumber: this._lastAddBufferPosition.lineNumber,
				lineOffset: this._lastAddBufferPosition.lineOffset + 1
			};
            pieceStartPosition = this._lastAddBufferPosition;
            addBufferLength += 1;

            for (let i = 0; i < linestart.length; i++) {
                linestart[i]! += 1;
            }
            
            addBuffer.buffer = addBuffer.buffer.concat('_', text);
            addBuffer.linestart = addBuffer.linestart.concat(linestart.splice(1));
        } 
        // If not, simply update the as normal.
        else {
            addBuffer.buffer = addBuffer.buffer.concat(text);
            addBuffer.linestart = addBuffer.linestart.concat(linestart.splice(1));
        }

        /**
         * After appending the text to the add buffer, we construct a piece that
         * points to it.
         */

        const addBufferEndOffset = addBuffer.buffer.length;
        const addBufferLastIndex = addBuffer.linestart.length - 1;
        const pieceEndOffset = addBufferEndOffset - addBuffer.linestart[addBufferLastIndex]!;
        const pieceEndPosition = { 
            lineNumber: addBufferLastIndex, 
            lineOffset: pieceEndOffset 
        };

        const piece = new Piece(
            0,
            addBufferEndOffset - addBufferLength,
            this.__validateLfCount(0, pieceStartPosition, pieceEndPosition),
            pieceStartPosition,
            pieceEndPosition
        );

        this._lastAddBufferPosition = pieceEndPosition;
        return [piece];
    }

    /**
     * @description The text is too large, we need to create multiple pieces for
     * it.
     * @param text The plain text.
     */
    private __splitIntoPieces(text: string): IPiece[] {
        const pieces: IPiece[] = [];
        const BUFFER_SIZE = PieceTable.AVERAGE_BUFFER_SIZE;

        // split into pieces for large text
        while (text.length > BUFFER_SIZE) {
            const lastChar = this.getCharcodeByOffset(BUFFER_SIZE - 1);
            let partText: string = '';

            if (lastChar === CharCode.CarriageReturn || Character.isHighSurrogate(lastChar)) {
                partText += text.substring(0, BUFFER_SIZE - 1);
                text = text.substring(BUFFER_SIZE - 1, undefined);
            } else {
                partText += text.substring(0, BUFFER_SIZE);
                text = text.substring(BUFFER_SIZE, undefined);
            }

            const linestart = TextBuffer.readLineStarts(partText).linestart;
            pieces.push(this.__constructNewPiece(this._buffer.length, partText.length, linestart));
            this._buffer.push(new TextBuffer(partText, linestart));
        }

        // deal with the rest of the short text
        if (text.length > 0) {
            const linestart = TextBuffer.readLineStarts(text).linestart;
            pieces.push(this.__constructNewPiece(this._buffer.length, text.length, linestart));
            this._buffer.push(new TextBuffer(text, linestart));    
        }

        return pieces;
    }

    private __constructNewPiece(bufferIndex: number, pieceLength: number, linestart: number[]): IPiece {
        const linestartLength = linestart.length === 0 ? 0 : linestart.length - 1;
        const linestartOffset = linestartLength ? linestart[linestartLength]! : 0;
        return new Piece(
            bufferIndex,
            pieceLength,
            linestartLength,
            { lineNumber: 0, lineOffset: 0 },
            { lineNumber: linestartLength, lineOffset: pieceLength - linestartOffset }
        );
    }

    private __extendLastAddBufferPiece(node: PieceNode, text: string): void {

        /**
         * CRLF situation when inserting text ends with a CR and the next node 
         * starts with a LF. If yes, we bring the LF backward into the text.
         */
        if (this.__removeLFfromTheNextNodeAt(node, text)) {
            text += EndOfLine.LF;
        }

        const addBuffer: Mutable<TextBuffer> = this._buffer[0]!;
        const addBufferStartOffset = addBuffer.buffer.length;
        addBuffer.buffer += text;

        const linestart = TextBuffer.readLineStarts(text, addBufferStartOffset).linestart;
        
        /**
         * CRLF situation when current node ends with a CR and the inserting 
         * text starts with a LF. If yes, we bring the CR forward counted as
         * part of the text.
         */
        if (this.__shouldCheckCRLF() && 
            this.__endWithCR(node) && this.__startWithLF(text)
        ) {
            const prevAddBufferStartOffset = addBuffer.linestart[addBuffer.linestart.length - 2]!;
			addBuffer.linestart.pop();
			this._lastAddBufferPosition = { 
                lineNumber: this._lastAddBufferPosition.lineNumber - 1, 
                lineOffset: addBufferStartOffset - prevAddBufferStartOffset 
            };
        }

        addBuffer.linestart = addBuffer.linestart.concat(linestart.slice(1));
        const newPieceEndPosition = {
            lineNumber: addBuffer.linestart.length - 1,
            lineOffset: addBuffer.buffer.length - addBuffer.linestart[addBuffer.linestart.length - 1]!
        };
        const oldLfCount = node.piece.lfCount;
        const newLfCount = this.__validateLfCount(0, node.piece.start, newPieceEndPosition);
        const lfDelta = newLfCount - oldLfCount;

        node.piece = new Piece(
            0,
            node.piece.pieceLength + text.length,
            newLfCount,
            node.piece.start,
            newPieceEndPosition
        );

        this._lastAddBufferPosition = newPieceEndPosition;
        this.__updatePieceMetadataWithDelta(node, text.length, lfDelta);
    }

    /**
     * @description Inserts the given text to the left of the given node.
     * @param node The given node.
     * @param text The plain text.
     */
    private __insertLeft(node: PieceNode, text: string): void {
        
        const toBeDeleted: PieceNode[] = [];

        /**
         * Check if there is a posibility that contains CRLF and the CRLF got
         * split into two different incoming pieces. If does, move the \n to the
         * new piece (to the left) that about to be inserted.
         */
        if (this.__removeLFfromTheNextNodeAt(null!, text, node)) {
            text += EndOfLine.LF;
        }
        
        // Inserting to the left (before).
        const pieces = this.__createNewPieces(text);
        let newnode = node;
        for (let i = pieces.length - 1; i >= 0; i--) {
            newnode = this.__insertAsPredecessor(newnode, pieces[i]!);
        }
        this.__validateCRLFwithPrevNode(newnode);

        // delete these nodes
        this.__deleteNodes(toBeDeleted);
    }

    private __insertMiddle(node: PieceNode, text: string, pieceOffset: number, startBufferPosition: IBufferPosition): void {
        const piece = node.piece;

        const toBeDeleted: PieceNode[] = [];

        // the second part of the two pieces.
        let rightPartPiece = new Piece(
            piece.bufferIndex,
            this.__getOffsetInBufferAt(piece.bufferIndex, piece.end) - this.__getOffsetInBufferAt(piece.bufferIndex, startBufferPosition),
            this.__validateLfCount(piece.bufferIndex, startBufferPosition, piece.end),
            startBufferPosition,
            piece.end
        );

        /**
         * Check the CRLF situation at the end of the inserting text. If 
         * true, move the \n to the front as the part of the inserting 
         * text.
         */
        if (this.__shouldCheckCRLF() && this.__endWithCR(text) && 
            this.__getCharcodeAtNode(node, pieceOffset) === CharCode.LineFeed
        ) {
            const newRightStartPosition = { 
                lineNumber: rightPartPiece.start.lineNumber + 1, 
                lineOffset: 0 
            };
            rightPartPiece = new Piece(
                rightPartPiece.bufferIndex,
                rightPartPiece.pieceLength - 1,
                this.__validateLfCount(rightPartPiece.bufferIndex, newRightStartPosition, rightPartPiece.end),
                newRightStartPosition,
                rightPartPiece.end
            );

            text += EndOfLine.LF;
        }

        /**
         * Check the CRLF situation at the beginning of the inserting
         * text. If true, move the \r to the back as the part of the
         * inserting text.
         */
        if (this.__shouldCheckCRLF() && this.__startWithLF(text) && 
            this.__getCharcodeAtNode(node, pieceOffset - 1) === CharCode.CarriageReturn
        ) {
            const beforeBufferPosition = this.__getPositionInBufferAt(node.piece, pieceOffset - 1);
            this.__deletePieceTailAt(node, beforeBufferPosition);
            
            text = '\r'.concat(text);
            if (node.piece.pieceLength === 0) {
                toBeDeleted.push(node);
            }
        } 
        /**
         * Otherwise simply remove the tail part of the current piece.
         * Now the current piece only contains the content before the 
         * inserting text.
         */
        else {
            this.__deletePieceTailAt(node, startBufferPosition);
        }

        const middlePieces = this.__createNewPieces(text);
        if (rightPartPiece.pieceLength) {
            this.__insertAsSuccessor(node, rightPartPiece);
        }

        let newnode = node;
        for (let i = 0; i < middlePieces.length; i++) {
            newnode = this.__insertAsSuccessor(newnode, middlePieces[i]!);
        }

        this.__deleteNodes(toBeDeleted);
    }

    /**
     * @description Inserts the given text to the right of the given node.
     * @param node The given node.
     * @param text The plain text.
     */
    private __insertRight(node: PieceNode, text: string): void {
        
        if (this.__removeLFfromTheNextNodeAt(node, text)) {
            /**
             * The inserting text does end with a CR and the next node does 
             * starts with a LF, we move the LF to the current one.
             */
            text += EndOfLine.LF;
        }

        // Inserting to the right (after).
        const pieces = this.__createNewPieces(text);

        const firstNewNode = this.__insertAsSuccessor(node, pieces[0]!);
        let insert = firstNewNode;
        for (let i = 1; i < pieces.length; i++) {
            insert = this.__insertAsSuccessor(insert, pieces[i]!);
        }

        this.__validateCRLFwithPrevNode(firstNewNode);
    }

    /**
     * @description Iteration the whole red-black tree in pre-order.
     * @param node The current node for iteration.
     * @param fn The function applies to each node.
     * @note This will not go through each {@link NULL_NODE}.
     */
    private __preOrder(node: PieceNode, fn: (node: PieceNode) => void): void {
        
        if (node === NULL_NODE) {
            return;
        }

        this.__preOrder(node.left, fn);
        fn(node);
        this.__preOrder(node.right, fn);
    }

    /**
     * @description Returns the relative offset in the buffer.
     * @param bufferIndex The index of the buffer.
     * @param position The position of points to the location of the buffer.
     * @complexity O(1)
     */
    private __getOffsetInBufferAt(bufferIndex: number, position: IBufferPosition): number {
        const buffer = this._buffer[bufferIndex]!;
        return buffer.linestart[position.lineNumber]! + position.lineOffset;
    }

    /**
     * @description Given the {@link PieceNode}, returns the string which the 
     * node is pointing at.
     * @complexity O(n), n - the length of the piece.
     */
    private __getNodeContent(node: PieceNode): string {
        if (node === NULL_NODE) {
            return '';
        }
        const piece = node.piece;
        const buffer = this._buffer[piece.bufferIndex]!;

        const startOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.start);
        const endOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.end);
        return buffer.buffer.substring(startOffset, endOffset);
    }

    // [private helper methods - red-black tree]

    /**
     * @description Deletes all the {@link PieceNode}s from the tree.
     */
    private __deleteNodes(nodes: PieceNode[]): void {
        for (let i = 0; i < nodes.length; i++) {
            this.__deleteNode(nodes[i]!);
        }
    }

    /**
     * @description Delete the given {@link PieceNode} from the red-black tree.
     * @complexity O(h)
     */
    private __deleteNode(z: PieceNode): void {
        
        let x: PieceNode; // always point to replacement for y or z.
        let y: PieceNode; // always point to node to be deleted or be replaced.

        if (z.left === NULL_NODE) {
            y = z;
            x = y.right;
        } else if (z.right === NULL_NODE) {
            y = z;
            x = y.left;
        } else {
            const leftMost = PieceNode.leftMost(z.right);
            const predecessor = leftMost === NULL_NODE ? z.right : leftMost;
            y = predecessor;
            x = y.right;
        }

        if (y === this._root) {
            this._root = x;
            x.color = RBColor.BLACK;
            PieceNode.isolate(z);
            NULL_NODE.parent = NULL_NODE;
            this._root.parent = NULL_NODE;
            return;
        }

        const yWasRed = y.color === RBColor.RED;

        if (y === y.parent.left) {
            y.parent.left = x;
        } else {
            y.parent.right = x;
        }

        if (y === z) {
            x.parent = y.parent;
            this.__updatePieceMetadata(x);
        } else {
            if (y.parent === z) {
                x.parent = y;
            } else {
                x.parent = y.parent;
            }

            this.__updatePieceMetadata(x);
            PieceNode.copy(y, z);

            if (z === this._root) {
                this._root = y;
            } else {
                if (z === z.parent.left) {
                    z.parent.left = y;
                } else {
                    z.parent.right = y;
                }
            }
    
            if (y.left !== NULL_NODE) {
                y.left.parent = y;
            }
            if (y.right !== NULL_NODE) {
                y.right.parent = y;
            }
            
            y.leftSubtreeBufferLength = z.leftSubtreeBufferLength;
            y.leftSubtreelfCount = z.leftSubtreelfCount;
            this.__updatePieceMetadata(y);
        }

        PieceNode.isolate(z);

        if (x.parent.left === x) {
            const newBufferLength = PieceNode.totalBufferLength(x);
            const newLfCount = PieceNode.totalLinefeedCount(x);
            if (newBufferLength !== x.parent.leftSubtreeBufferLength || 
                newLfCount !== x.parent.leftSubtreelfCount
            ) {
                const bufferDelta = newBufferLength - x.parent.leftSubtreeBufferLength;
                const lfDelta = newLfCount - x.parent.leftSubtreelfCount;
                x.parent.leftSubtreeBufferLength = newBufferLength;
                x.parent.leftSubtreelfCount = newLfCount;
                this.__updatePieceMetadataWithDelta(x.parent, bufferDelta, lfDelta);
            }
        }

        this.__updatePieceMetadata(x.parent);
        
        if (yWasRed) {
            NULL_NODE.parent = NULL_NODE;
            return;
        }

        this.__fixAfterDeletion(x);
    }

    /**
     * @description Set the provided node (piece) end with the new provided 
     * position.
     * @param node The given node.
     * @param position The new ending position.
     */
    private __deletePieceTailAt(node: PieceNode, position: IBufferPosition): void {
        const piece = node.piece;
        const prevLfCount = piece.lfCount;
        const prevEndBufferOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.end);

        const newLfCount = this.__validateLfCount(piece.bufferIndex, piece.start, position);
        const newEndBufferOffset = this.__getOffsetInBufferAt(piece.bufferIndex, position);

        const lfDelta = newLfCount - prevLfCount;
        const lengthDelta = newEndBufferOffset - prevEndBufferOffset;

        node.piece = new Piece(
            piece.bufferIndex,
            piece.pieceLength + lengthDelta,
            newLfCount,
            piece.start,
            position
        );

        this.__updatePieceMetadataWithDelta(node, lengthDelta, lfDelta);
    }

    /**
     * @description Set the provided node (piece) start with the new provided 
     * position.
     * @param node The given node.
     * @param position The new starting position.
     */
    private __deletePieceHeadAt(node: PieceNode, position: IBufferPosition): void {
        const piece = node.piece;
        const prevLfCount = piece.lfCount;
        const prevStartBufferOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.start);

        const newLfCount = this.__validateLfCount(piece.bufferIndex, position, piece.end);
        const newStartBufferOffset = this.__getOffsetInBufferAt(piece.bufferIndex, position);

        const lfDelta = newLfCount - prevLfCount;
        const lengthDelta = prevStartBufferOffset - newStartBufferOffset;

        node.piece = new Piece(
            piece.bufferIndex,
            piece.pieceLength + lengthDelta,
            newLfCount,
            position,
            piece.end
        );

        this.__updatePieceMetadataWithDelta(node, lengthDelta, lfDelta);
    }

    /**
     * @description Delete the provided node (piece) with a given range [start, 
     * end).
     * @param node The given node.
     * @param start The start deleting position.
     * @param end The end deleting position.
     * 
     * @note This method will split the piece into two pieces.
     */
    private __deletePieceMiddleAt(node: PieceNode, start: IBufferPosition, end: IBufferPosition): PieceNode {
        const piece = node.piece;
        const prevEndPosition = piece.end;

        // modify the original piece (left part)
        this.__deletePieceTailAt(node, start);

        // create a new piece (right part)
        const rightPiece = new Piece(
            piece.bufferIndex,
            this.__getOffsetInBufferAt(piece.bufferIndex, prevEndPosition) - this.__getOffsetInBufferAt(piece.bufferIndex, end),
            this.__validateLfCount(piece.bufferIndex, end, prevEndPosition),
            end,
            prevEndPosition
        );

        return this.__insertAsSuccessor(node, rightPiece);
    }

    /**
     * @description Fix the red-black tree metadata after the deletion.
     * @param node The node which just been deleted.
     * 
     * @complexity O(h)
     */
    private __fixAfterDeletion(node: PieceNode): void {
        
        let sibling: PieceNode;
        while (node !== this._root && node.color === RBColor.BLACK) {
            if (node === node.parent.left) {
                sibling = node.parent.right;

                if (sibling.color === RBColor.RED) {
                    sibling.color = RBColor.BLACK;
                    node.parent.color = RBColor.RED;
                    this.__leftRotateNode(node.parent);
                    sibling = node.parent.right;
                }

                if (sibling.left.color === RBColor.BLACK && sibling.right.color === RBColor.BLACK) {
                    sibling.color = RBColor.RED;
                    node = node.parent;
                } else {
                    if (sibling.right.color === RBColor.BLACK) {
                        sibling.left.color = RBColor.BLACK;
                        sibling.color = RBColor.RED;
                        this.__rightRotateNode(sibling);
                        sibling = node.parent.right;
                    }

                    sibling.color = node.parent.color;
                    node.parent.color = RBColor.BLACK;
                    sibling.right.color = RBColor.BLACK;
                    this.__leftRotateNode(node.parent);
                    node = this._root;
                }
            } else {
                sibling = node.parent.left;

                if (sibling.color === RBColor.RED) {
                    sibling.color = RBColor.BLACK;
                    node.parent.color = RBColor.RED;
                    this.__rightRotateNode(node.parent);
                    sibling = node.parent.left;
                }

                if (sibling.left.color === RBColor.BLACK && sibling.right.color === RBColor.BLACK) {
                    sibling.color = RBColor.RED;
                    node = node.parent;
                } else {
                    if (sibling.left.color === RBColor.BLACK) {
                        sibling.right.color = RBColor.BLACK;
                        sibling.color = RBColor.RED;
                        this.__leftRotateNode(sibling);
                        sibling = node.parent.left;
                    }

                    sibling.color = node.parent.color;
                    node.parent.color = RBColor.BLACK;
                    sibling.left.color = RBColor.BLACK;
                    this.__rightRotateNode(node.parent);
                    node = this._root;
                }
            }
        }
        node.color = RBColor.BLACK;
        NULL_NODE.parent = NULL_NODE;
    }

    /**
     * @description Given a {@link Piece}, constructs a new {@link PieceNode} 
     * and insert the new node as a successor to the given node.
     * @returns The created node.
     * 
     * @complexity O(h)
     */
    private __insertAsSuccessor(node: PieceNode, piece: Piece): PieceNode {
        const newnode = PieceNode.create(piece, RBColor.RED);
        
        // empty tree
        if (this._root === NULL_NODE) {
            this._root = newnode;
            newnode.color = RBColor.BLACK;
        }
        // the given node has no right-subtree
        else if (node.right === NULL_NODE) {
            node.right = newnode;
            newnode.parent = node;
        }
        // the given node has right-subtree
        else {
            const leftMost = PieceNode.leftMost(node.right);
            const successor = leftMost === NULL_NODE ? node.right : leftMost;
            successor.left = newnode;
            newnode.parent = successor;
        }

        this.__fixAfterInsertion(newnode);
        return newnode;
    }

    /**
     * @description Given a {@link Piece}, constructs a new {@link PieceNode} 
     * and insert the new node as a predecessor to the given node.
     * @returns The created node.
     * @complexity O(h)
     */
    private __insertAsPredecessor(node: PieceNode, piece: Piece): PieceNode {
        const newnode = PieceNode.create(piece, RBColor.RED);

        // empty tree
        if (this._root === NULL_NODE) {
            this._root = newnode;
            newnode.color = RBColor.BLACK;
        }
        // the given node has no left-subtree
        else if (node.left === NULL_NODE) {
            node.left = newnode;
            newnode.parent = node;
        }
        // the given node has right-subtree
        else {
            const rightMost = PieceNode.rightMost(node.left);
            const predecessor = rightMost === NULL_NODE ? node.left : rightMost;
            predecessor.right = newnode;
            newnode.parent = predecessor;
        }

        this.__fixAfterInsertion(newnode);
        return newnode;
    }

    /**
     * @description Fix the red-black tree metadata after the insertion.
     * @param node The node which just been inserted.
     * @complexity O(h)
     */
    private __fixAfterInsertion(node: PieceNode): void {
        
        this.__updatePieceMetadata(node);

        while (node !== this._root && node.parent.color === RBColor.RED) {
            
            if (node.parent === node.parent.parent.left) {
                const parentSibling = node.parent.parent.right;
                
                if (parentSibling.color === RBColor.RED) {
                    node.parent.color = RBColor.BLACK;
                    parentSibling.color = RBColor.BLACK;
                    node.parent.parent.color = RBColor.RED;
                    node = node.parent.parent;
                }  else {
                    if (node === node.parent.right) {
                        node = node.parent;
                        this.__leftRotateNode(node);
                    }

                    node.parent.color = RBColor.BLACK;
                    node.parent.parent.color = RBColor.RED;
                    this.__rightRotateNode(node.parent.parent);
                }
            }

            else {
                const parentSibling = node.parent.parent.left;

                if (parentSibling.color === RBColor.RED) {
                    node.parent.color = RBColor.BLACK;
                    parentSibling.color = RBColor.BLACK;
                    node.parent.parent.color = RBColor.RED;
                    node = node.parent.parent;
                } else {
                    if (node === node.parent.left) {
                        node = node.parent;
                        this.__rightRotateNode(node);
                    }

                    node.parent.color = RBColor.BLACK;
                    node.parent.parent.color = RBColor.RED;
                    this.__leftRotateNode(node.parent.parent);
                }
            }

        }
        
        this._root.color = RBColor.BLACK;
    }

    /**
     * @description Given the node, recalculates and updates its piece metadata
     * upwards until the root.
     * @param node The node which just been moved.
     * @complexity O(h)
     */
    private __updatePieceMetadata(node: PieceNode): void {
        if (node === this._root) {
            return;
        }

        /**
         * Since each {@link PieceNode} only maintains its left-subtree metadata, 
         * after each insertion, we need to trace back upwards until we find a 
         * parent node, in whose perspective, its left-subtree is changed.
         */
        while (node !== this._root && node !== node.parent.left) {
            node = node.parent;
        }

        /**
         * This means the new node was moved at the right-most of the whole 
         * tree. We do noting since we do not maintain the right-subtree metadata.
         */
        if (node === this._root) {
            return;
        }

        /**
         * We found the first parent node whose left-subtree's metadata is 
         * changed. We recalculate the updated metadata (buffer length and 
         * linefeed count).
         */
        node = node.parent;
        const lengthDelta = PieceNode.totalBufferLength(node.left) - node.leftSubtreeBufferLength;
        const lfDelta = PieceNode.totalLinefeedCount(node.left) - node.leftSubtreelfCount;
        node.leftSubtreeBufferLength += lengthDelta;
        node.leftSubtreelfCount += lfDelta;

        /**
         * We still need to trace back upwards to do the same job to the nodes, 
         * in whose perspective, its left-subtree is changed.
         */
        this.__updatePieceMetadataWithDelta(node, lengthDelta, lfDelta);
    }

    private __updatePieceMetadataWithDelta(node: PieceNode, bufferLengthDelta: number, lfCountDelta: number): void {
        
        if (bufferLengthDelta === 0 && lfCountDelta === 0) {
            return;
        }
        
        while (node !== this._root) {
            if (node.parent.left === node) {
                node.parent.leftSubtreeBufferLength += bufferLengthDelta;
                node.parent.leftSubtreelfCount += lfCountDelta;
            }
            node = node.parent;
        }
    }

    /**
     * @description Left rotates the given node to balance the red-black tree.
     * @param node The given node.
     * @note Rotation will automatically updates piece metadata as well.
     * @complexity O(1)
     */
    private __leftRotateNode(node: PieceNode): void {
        
        const rightNode = node.right;
        node.right = rightNode.left;

        if (rightNode.left !== NULL_NODE) {
            rightNode.left.parent = node;
        }

        rightNode.parent = node.parent;

        if (node.parent === NULL_NODE) {
            this._root = rightNode;
        } else if (node.parent.left === node) {
            node.parent.left = rightNode;
        } else {
            node.parent.right = rightNode;
        }

        rightNode.left = node;
        node.parent = rightNode;

        // update metadata
        rightNode.leftSubtreeBufferLength += node.leftSubtreeBufferLength + node.piece.pieceLength;
        rightNode.leftSubtreelfCount += node.leftSubtreelfCount + node.piece.lfCount;
    }

    /**
     * @description Right rotates the given node to balance the red-black tree.
     * @param node The given node.
     * @note Rotation will automatically updates piece metadata as well.
     * @complexity O(1)
     */
    private __rightRotateNode(node: PieceNode): void {
        
        const leftNode = node.left;
        node.left = leftNode.right;

        if (leftNode.right !== NULL_NODE) {
            leftNode.right.parent = node;
        }

        leftNode.parent = node.parent;

        if (node.parent === NULL_NODE) {
            this._root = leftNode;
        } else if (node.parent.right === node) {
            node.parent.right = leftNode;
        } else {
            node.parent.left = leftNode;
        }

        leftNode.right = node;
        node.parent = leftNode;

        // update metadata
        node.leftSubtreeBufferLength -= leftNode.leftSubtreeBufferLength + leftNode.piece.pieceLength;
        node.leftSubtreelfCount -= leftNode.leftSubtreelfCount + leftNode.piece.lfCount;
    }

    /**
     * @description Given the text offset, returns the corresponding piece, its 
     * buffer start offset, and also a offset relatives to the piece.
     * @param textOffset The text offset relatives to the whole text model.
     * @complexity O(h)
     */
    private __getNodeByOffset(textOffset: number): { position: IPieceNodePosition, pieceOffset: number } {

        let node = this._root;
        let nodeTextOffset = 0;

        while (node !== NULL_NODE) {

            if (node.leftSubtreeBufferLength > textOffset) {
                node = node.left;
            } 
            else if (node.piece.pieceLength >= textOffset - node.leftSubtreeBufferLength) {
                nodeTextOffset += node.leftSubtreeBufferLength;
                return {
                    position: {
                        textOffset: nodeTextOffset,
                        node: node
                    },
                    pieceOffset: textOffset - node.leftSubtreeBufferLength
                };
            } 
            else {
                const currentBufferLength = node.leftSubtreeBufferLength + node.piece.pieceLength;
                textOffset -= currentBufferLength;
                nodeTextOffset += currentBufferLength;
                node = node.right;
            }

        }

        // should never be reached
        return undefined!;
    }

    /**
     * @description Given the line number and line offset, returns the 
     * corresponding piece, its buffer start offset, and also a offset relatives 
     * to the piece.
     * @param lineNumber The line number (zero-based).
     * @param lineOffset The offset relative to the line.
     * @complexity O(h)
     */
    private __getNodeByLine(lineNumber: number, lineOffset: number): { position: IPieceNodePosition, pieceOffset: number } {
        
        let node = this._root;
        let nodeTextOffset = 0;
        while (node !== NULL_NODE) {

            if (node.left !== NULL_NODE && node.leftSubtreelfCount >= lineNumber) {
                node = node.left;
            }
            else if (node.piece.lfCount > lineNumber - node.leftSubtreelfCount) {
                const startOffsetInPiece = this.__getOffsetInPieceAtLineIndex(node.piece, lineNumber - node.leftSubtreelfCount);
                const endOffsetInPiece = this.__getOffsetInPieceAtLineIndex(node.piece, lineNumber - node.leftSubtreelfCount + 1);
                nodeTextOffset += node.leftSubtreeBufferLength;
                return {
                    position: {
                        textOffset: nodeTextOffset,
                        node: node,
                    },
                    pieceOffset: Math.min(endOffsetInPiece, startOffsetInPiece + lineOffset),
                };
            }
            else if (node.piece.lfCount === lineNumber - node.leftSubtreelfCount) {
                const startOffsetInPiece = this.__getOffsetInPieceAtLineIndex(node.piece, lineNumber - node.leftSubtreelfCount);
                if (startOffsetInPiece + lineOffset > node.piece.pieceLength) {
                    // the rest of the line content is in the next piece.
                    lineOffset -= node.piece.pieceLength - startOffsetInPiece;
                    break;
                }

                return {
                    position: {
                        textOffset: nodeTextOffset,
                        node: node,
                    },
                    pieceOffset: startOffsetInPiece + lineOffset,
                };
            }
            else {
                lineNumber -= node.leftSubtreelfCount + node.piece.lfCount;
                nodeTextOffset += node.leftSubtreeBufferLength + node.piece.pieceLength;
                node = node.right;
            }
        }

        // search for the rest of the pieces until we find at least one linefeed
        node = PieceNode.next(node);
        while (node !== NULL_NODE) {
            if (node.piece.lfCount > 0) {
                const startOffsetInPiece = this.__getOffsetInPieceAtLineIndex(node.piece, 1);
                const textOffsetOfPiece = this.__getOffsetOfPiece(node);
                return {
                    position: {
                        textOffset: textOffsetOfPiece,
                        node: node,
                    },
                    pieceOffset: Math.min(lineOffset, startOffsetInPiece),
                };
            }
            else {
                if (node.piece.pieceLength >= lineOffset) {
                    const textOffsetOfPiece = this.__getOffsetOfPiece(node);
                    return {
                        position: {
                            textOffset: textOffsetOfPiece,
                            node: node,
                        },
                        pieceOffset: lineOffset,
                    };
                } else {
                    lineOffset -= node.piece.pieceLength;
                }
            }
            
            node = PieceNode.next(node);
        }

        // should never be reached
        return undefined!;
    }

    /**
     * @description Returns the text offset relatives to the whole text of the 
     * start of the given piece.
     * @param node The given piece node in the tree.
     */
    private __getOffsetOfPiece(node: PieceNode): number {
        if (!node) {
            return 0;
        }
        let textOffset = node.leftSubtreeBufferLength;
        while (node !== this._root) {
            if (node.parent.right === node) {
				textOffset += node.parent.leftSubtreeBufferLength + node.parent.piece.pieceLength;
			}
			node = node.parent;
        }
        return textOffset;
    }

    /**
     * @description Returns the corresponding charcode at the given piece
     * position and the piece offset.
     * @param position The piece position.
     * @param pieceOffset The piece offset.
     * @complexity O(1)
     */
    private __getCharcodeAt(position: IPieceNodePosition, pieceOffset: number): number {
        
        const node = position.node;
        
        /**
         * The desired charcode is at the first character of the next piece.
         */
        if (pieceOffset === node.piece.pieceLength) {
            const nextnode = PieceNode.next(node);

            // invalid position and offset
            if (nextnode === NULL_NODE) {
                return 0;
            }

            const buffer = this._buffer[nextnode.piece.bufferIndex]!.buffer;
            const nextPieceStartOffset = this.__getOffsetInBufferAt(nextnode.piece.bufferIndex, nextnode.piece.start);
            return buffer.charCodeAt(nextPieceStartOffset);
        }

        const buffer = this._buffer[node.piece.bufferIndex]!.buffer;
        const pieceStartOffset = this.__getOffsetInBufferAt(node.piece.bufferIndex, node.piece.start);
        return buffer.charCodeAt(pieceStartOffset + pieceOffset);
    }

    /**
     * @description Returns the desired charcode relatives to the given node.
     * @param node The given node.
     * @param pieceOffset Offset relatives to the node.
     */
    private __getCharcodeAtNode(node: PieceNode, pieceOffset: number): number {
        const buffer = this._buffer[node.piece.bufferIndex]!.buffer;
		const newOffset = this.__getOffsetInBufferAt(node.piece.bufferIndex, node.piece.start) + pieceOffset;
		return buffer.charCodeAt(newOffset);
    }

    // [private helper methods - piece table]

    /**
     * @description Recalculates all the basic metadata of the whole tree (total 
     *  buffer length / total linefeed count).
     * @complexity O(h)
     */
     private __updateTableMetadata(): void {
        let node = this._root;

        let pieceLength = 0;
        let lfCount = 1;
        while (node !== NULL_NODE) {
            pieceLength += node.leftSubtreeBufferLength + node.piece.pieceLength;
            lfCount += node.leftSubtreelfCount + node.piece.lfCount;
            node = node.right;
        }

        this._bufferLength = pieceLength;
        this._lineFeedCount = lfCount;
    }

    /**
     * @description A auxiliary function for `getRawLine`.
     * @param lineNumber The line number (zero-based).
     * @param eolLength The length of the linefeed.
     * @complexity O(h)
     */
    private __getRawLine(lineNumber: number, eolLength: number = 0): string {
        if (lineNumber < 0 || lineNumber >= this._lineFeedCount) {
            return '';
        }

        let node = this._root;
        let lineBuffer = '';
        
        while (node !== NULL_NODE) {

            /**
             * desired line is either: 
             *      - entirely before the current piece
             *      - OR has partial content before the current piece (could be empty)
             */
            if (node.left !== NULL_NODE && node.leftSubtreelfCount >= lineNumber) {
                node = node.left;
            }
            // desired line is within the current piece
            else if (node.piece.lfCount > lineNumber - node.leftSubtreelfCount) {
                const piece = node.piece;
                const { buffer } = this._buffer[piece.bufferIndex]!;
                const pieceStartOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.start);

                lineNumber -= node.leftSubtreelfCount;

                const desiredLineStartOffset = this.__getOffsetInPieceAtLineIndex(piece, lineNumber);
                const desiredLineEndOffset = this.__getOffsetInPieceAtLineIndex(piece, lineNumber + 1);
                
                return buffer.substring(
                    pieceStartOffset + desiredLineStartOffset, 
                    pieceStartOffset + desiredLineEndOffset - eolLength
                );
            }
            // desired line has partial content at the end of the current piece (could be empty)
            else if (node.piece.lfCount === lineNumber - node.leftSubtreelfCount) {
                const piece = node.piece;
                const { buffer } = this._buffer[piece.bufferIndex]!;
                const pieceStartOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.start);
                
                lineNumber -= node.leftSubtreelfCount;
                const desiredLineStartOffset = this.__getOffsetInPieceAtLineIndex(piece, lineNumber);
                
                lineBuffer = buffer.substring(
                    pieceStartOffset + desiredLineStartOffset,
                    pieceStartOffset + piece.pieceLength
                );
                break;
            } 
            // desired line is after the current piece
            else {
                lineNumber -= (node.leftSubtreelfCount + node.piece.lfCount);
                node = node.right;
            }
        }

        /**
         * Reaching here means the required line is at the end of a piece. To
         * get a complete line, We need to find the next piece which has at 
         * least one linefeed.
         */

        node = PieceNode.next(node);
        while (node !== NULL_NODE) {
            const piece = node.piece;
            const buffer = this._buffer[piece.bufferIndex]!.buffer;
            const pieceStartOffset = this.__getOffsetInBufferAt(piece.bufferIndex, piece.start);

            if (piece.lfCount) {
                const lineLength = this.__getOffsetInPieceAtLineIndex(node.piece, 1);
                lineBuffer += buffer.substring(
                    pieceStartOffset, 
                    pieceStartOffset + lineLength - eolLength
                );
                return lineBuffer;
            }

            lineBuffer += buffer.substring(
                pieceStartOffset, 
                pieceStartOffset + piece.pieceLength
            );
            node = PieceNode.next(node);
        }

        return lineBuffer;
    }

    /**
     * @description Given a piece, returns a {@link IBufferPosition} describes
     * the given piece offset where the location is relatives to the buffer.
     * @param piece The given piece.
     * @param pieceOffset The offset relatives to the piece.
     * @complexity O(logn), n - number of lines in the piece.
     */
    private __getPositionInBufferAt(piece: IPiece, pieceOffset: number): IBufferPosition {
        const linestart = this._buffer[piece.bufferIndex]!.linestart;
        
        const pieceStartOffsetInBuffer = linestart[piece.start.lineNumber]! + piece.start.lineOffset;
        const desiredOffset = pieceStartOffsetInBuffer + pieceOffset;

        /**
         * Using binary search to search for the line that contains the current 
         * offset in the current piece.
         */

        let low = piece.start.lineNumber;
        let high = piece.end.lineNumber;
        let mid = 0;

        let midStartLineOffset = 0;
        let midEndLineOffset = 0;

        while (low <= high) {
            mid = ((low + high) / 2) | 0;

            midStartLineOffset = linestart[mid]!;
            
            // reaching the end of the current piece
            if (mid === high) {
                break;
            }

            midEndLineOffset = linestart[mid + 1]!;

            if (desiredOffset < midStartLineOffset) {
                high = mid - 1;
            } else if (desiredOffset >= midEndLineOffset) {
                low = mid + 1;
            } else {
                // found it
                break;
            }
        }

        return {
            lineNumber: mid,
            lineOffset: desiredOffset - midStartLineOffset
        };
    }

    /**
     * @description Given a piece, returns a {@link IPiecePosition} describes
     * the given piece offset where the location is relatives to the piece.
     * @param piece The given {@link IPiece}.
     * @param pieceOffset The offset relatives to the piece.
     * @complexity — O(logn), n - number of lines in the piece.
     */
    private __getPositionInPieceAt(piece: IPiece, pieceOffset: number): IPiecePosition {
        
        const { 
            lineNumber: lineNumberInPiece, 
            lineOffset: lineOffsetInPiece 
        } = this.__getPositionInBufferAt(piece, pieceOffset);

        const lineIndexInPiece = lineNumberInPiece - piece.start.lineNumber;

        return {
            lineNumber: lineIndexInPiece,
            lineOffset: lineOffsetInPiece
        };
    }

    /**
     * @description Returns the linestart offset relatives to the given piece at 
     * the given line index (relative to the buffer).
     * @param lineIndex The line number where it stops (the length of the line 
     * is not included).
     */
    private __getOffsetInPieceAtLineIndex(piece: Piece, lineIndex: number): number {
        if (lineIndex <= 0) {
            return 0;
        }

        const desiredLineIndex = piece.start.lineNumber + lineIndex;
        if (desiredLineIndex > piece.end.lineNumber) {
            return piece.pieceLength;
        }

        const linestart = this._buffer[piece.bufferIndex]!.linestart;
        return linestart[desiredLineIndex]! - (linestart[piece.start.lineNumber]! + piece.start.lineOffset);
    }

    // [private helper methods - EOL]

    private __shouldCheckCRLF(): boolean {

        /**
         * only need to check for CRLF because there is a chance the \r\n got
         * stored into two different pieces.
         */

        return !(this._shouldBeNormalized && this._normalizedEOL === EndOfLine.LF);
    }

    private __endWithCR(value: string | PieceNode): boolean {
        if (typeof value === 'string') {
            return value.charCodeAt(value.length - 1) === CharCode.CarriageReturn;
        }
        return this.__nodeEndWithCR(value);
    }

    private __startWithLF(value: string | PieceNode): boolean {
        if (typeof value === 'string') {
            return value.charCodeAt(0) === CharCode.LineFeed;
        }
        return this.__nodeStartWithLF(value);
    }

    private __nodeEndWithCR(node: PieceNode): boolean {
        if (node === NULL_NODE || node.piece.lfCount === 0) {
            return false;
        }

        return this.__getCharcodeAtNode(node, node.piece.pieceLength - 1) === CharCode.CarriageReturn;
    }

    private __nodeStartWithLF(node: PieceNode): boolean {
        if (node === NULL_NODE || node.piece.lfCount === 0) {
            return false;
        }

        const piece = node.piece;
        const { buffer, linestart } = this._buffer[piece.bufferIndex]!;
        const pieceStartOffset = linestart[piece.start.lineNumber]! + piece.start.lineOffset;

        return buffer.charCodeAt(pieceStartOffset) === CharCode.LineFeed;
    }

    /**
     * @description Try to move a LF that appears to be the first character from 
     * the accessor of the given node to the previous node which is the text we 
     * are about to insert with.
     * @returns If the operation was taken.
     */
    private __removeLFfromTheNextNodeAt(node: PieceNode, text: string, provided?: PieceNode): boolean {
        
        if (this.__shouldCheckCRLF() && this.__endWithCR(text)) {
            
            const nextnode = provided ? provided : PieceNode.next(node);
            if (this.__startWithLF(nextnode)) {
                /**
                 * We are suppose to move the first character \n to the previous
                 * piece, which will be the text we are about to insert with.
                 */
                if (nextnode.piece.pieceLength === 1) {
                    this.__deleteNode(nextnode);
                }
                else {
                    const piece = nextnode.piece;
                    const newPieceStartPosition = { lineNumber: piece.start.lineNumber + 1, lineOffset: 0 };
					nextnode.piece = new Piece(
						piece.bufferIndex,
						piece.pieceLength - 1,
                        this.__validateLfCount(piece.bufferIndex, newPieceStartPosition, piece.end),
                        newPieceStartPosition,
						piece.end,
					);

                    this.__updatePieceMetadataWithDelta(nextnode, -1, -1);
                }

                return true;
            }
        }

        return false;
    }

    /**
     * @description If the given node start with \n and its previous node end 
     * with \r, we combine these CRLF.
     */
    private __validateCRLFwithPrevNode(node: PieceNode): void {
        if (this.__shouldCheckCRLF() && this.__startWithLF(node)) {
			const prev = PieceNode.prev(node);
			if (this.__endWithCR(prev)) {
				this.__fixCRLF(prev, node);
			}
		}
    }

    /**
     * @description If the given node ends with \r and its next node start with
     * \n, we combine these CRLF.
     */
    private __validateCRLFwithNextNode(node: PieceNode): void {
        if (this.__shouldCheckCRLF() && this.__endWithCR(node)) {
			const next = PieceNode.next(node);
			if (this.__startWithLF(next)) {
				this.__fixCRLF(node, next);
			}
		}
    }

    /**
     * @description Invokes only when the `prev` ends with '\r' and the `next` 
     * starts with '\n'.
     */
    private __fixCRLF(prev: PieceNode, next: PieceNode): void {

        const toBeDeleted: PieceNode[] = [];
		
        /** Isolate '\r' from the prev piece. */

		const lineStart = this._buffer[prev.piece.bufferIndex]!.linestart;
        const prevLastLineOffset = prev.piece.end.lineNumber;
        let prevNewEndPosition: IBufferPosition;
        if (prev.piece.end.lineOffset === 0) {
            /**
             * If the line was ends with a '\r', we need to decrease the line 
             * number by one.
             */
            prevNewEndPosition = { 
                lineNumber: prevLastLineOffset - 1, 
                lineOffset: lineStart[prevLastLineOffset]! - lineStart[prevLastLineOffset - 1]! - 1 
            };
        } else {
            /**
             * If the line was ends with a '\r\n', after isolate the '\r', we
             * still have the same ending line number, except the line offset
             * should minus by one.
             */
            prevNewEndPosition = { 
                lineNumber: prevLastLineOffset, 
                lineOffset: prev.piece.end.lineOffset - 1
            };
        }
        prev.piece = new Piece(
			prev.piece.bufferIndex,
			prev.piece.pieceLength - 1,
			prev.piece.lfCount - 1,
            prev.piece.start,
			prevNewEndPosition,
		);
        this.__updatePieceMetadataWithDelta(prev, -1, -1);
        if (prev.piece.pieceLength === 0) {
            toBeDeleted.push(prev);
        }

        /** Isolate '\n' from the next piece. */

        const nextNewStartPosition = { 
            lineNumber: next.piece.start.lineNumber + 1, 
            lineOffset: 0 
        };
        next.piece = new Piece(
            next.piece.bufferIndex,
            next.piece.pieceLength - 1,
            this.__validateLfCount(next.piece.bufferIndex, nextNewStartPosition, next.piece.end),
            nextNewStartPosition,
            next.piece.end
        );
        this.__updatePieceMetadataWithDelta(next, -1, -1);
        if (next.piece.pieceLength === 0) {
            toBeDeleted.push(next);
        }

        /** Create a new '\r\n' piece. */

        const pieces = this.__createNewPieces('\r\n');
		this.__insertAsSuccessor(prev, pieces[0]!);

        // delete empty pieces
        this.__deleteNodes(toBeDeleted);
    }

    /**
     * @description Given the start and the end of the pieces, we need to 
     * determine the correct line feed counts by considering CRLF situation.
     */
    private __validateLfCount(bufferIndex: number, start: IBufferPosition, end: IBufferPosition): number {
        
        if (end.lineOffset === 0) {
			return end.lineNumber - start.lineNumber;
		}

		const linestart = this._buffer[bufferIndex]!.linestart;
		if (end.lineNumber === linestart.length - 1) {
			return end.lineNumber - start.lineNumber;
		}

		const nextLineStartOffset = linestart[end.lineNumber + 1]!;
		const endOffset = linestart[end.lineNumber]! + end.lineOffset;
		if (nextLineStartOffset > endOffset + 1) {
			return end.lineNumber - start.lineNumber;
		}
		
        const previousCharOffset = endOffset - 1;
		const buffer = this._buffer[bufferIndex]!.buffer;

		if (buffer.charCodeAt(previousCharOffset) === CharCode.CarriageReturn) {
			return end.lineNumber - start.lineNumber + 1;
		} else {
			return end.lineNumber - start.lineNumber;
		}
    }
}

/**
 * @namespace PieceTableInternal Should ONLY be used in `pieceTable.test.ts`. 
 */
export namespace PieceTableInternal {

    /** @warn Should ONLY be used in `pieceTable.test.ts`. */
    export const NULL = NULL_NODE;

}