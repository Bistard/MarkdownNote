import { Character, CharCode } from "src/base/common/utilities/char";
import { panic } from "src/base/common/utilities/panic";
import { Mutable } from "src/base/common/utilities/type";
import { EndOfLine, EndOfLineType, IPieceTable, ITextBufferBuilder } from "src/editor/common/model";
import { PieceTable } from "src/editor/model/textBuffer/pieceTable";
import { TextBuffer } from "src/editor/model/textBuffer/textBuffer";

/**
 * @class The receiving phase will receive string chunks and builds
 * corresponding {@link TextBuffer}. The building phase will finish the 
 * receiving phase. The creating phase will create a {@link IPieceTable}.
 */
 export class TextBufferBuilder implements ITextBufferBuilder {

    // [fields]

    protected readonly _chunks: TextBuffer[] = [];
    private _prevChar: number | null = null;

    /**
     * CR = Carriage Return (\r, 0x0D) — moves the cursor to the beginning of 
     *      the line without advancing to the next line. 
     * LF = Line Feed (\n, 0x0A) — moves the cursor down to the next line 
     *      without returning to the beginning of the line.
     */
    
    private _cr: number = 0;
    private _lf: number = 0;
    private _crlf: number = 0;

    private _built: boolean = false;
    private _created: boolean = false;

    // [constructor]

    constructor() {}

    // [public methods]

    public receive(chunk: string): void {

        if (this._built || this._created) {
            panic('TextBufferBuilder is already built or created');
        }
       
        // REVIEW: the string concatenation might need some work around.

        let chunkLength = chunk.length;
        if (chunkLength === 0) {
            return;
        }

        const lastChar = chunk.charCodeAt(chunkLength - 1);

        /**
         * JavaScript is using UTF-16 to encode its strings. It means two bytes
         * (16-bit) are used for every Unicode Code Point (eg. emoji).
         * 
         * Surrogates are always in pairs, with the high surrogate followed by 
         * the low.
         *      - High surrogates—U+D800 to U+DBFF (total of 1,024 code points)
         *      - Low surrogates—U+DC00 to U+DFFF (total of 1,024 code points)
         * 
         * Further reading: {@link https://www.informit.com/articles/article.aspx?p=2274038&seqNum=10}
         */

        let newChunk = chunk;

        // If we have a previous character last time we omit it, we take it into account this time.
        if (this._prevChar) {
            const prevChar = String.fromCharCode(this._prevChar);
            newChunk = prevChar.concat(chunk);
            chunkLength += prevChar.length;
            this._prevChar = null;
        }

        if (Character.isHighSurrogate(lastChar) || CharCode.CarriageReturn === lastChar) {
            newChunk = chunk.substring(0, chunkLength - 1); // remove that character for now
            this._prevChar = lastChar;
        }

        this.__receiveChunk(newChunk);
    }

    public build(): void {
        if (this._built) {
            panic('TextBufferBuilder cannot build twice');
        }

        // never received a chunk, we still need to push an empty StringBuffer.
        if (this._chunks.length === 0) {
            if (this._prevChar) {
                this.__receiveChunk(String.fromCharCode(this._prevChar));
            } else {
                this.__receiveChunk('', true);
            }
        } 
        
        // we have left a character, we need to concatenate it with the last buffer.
        else if (this._prevChar) {
            
            const lastChunk = this._chunks[this._chunks.length - 1]!;
            (<Mutable<string>>lastChunk.buffer) = lastChunk.buffer.concat(String.fromCharCode(this._prevChar)); // avoid readonly
            
            if (this._prevChar === CharCode.CarriageReturn) {
                this._cr++;
                lastChunk.linestart.push(lastChunk.buffer.length);
            } else if (this._prevChar === CharCode.LineFeed) {
                this._lf++;
                lastChunk.linestart.push(lastChunk.buffer.length);
            }

            this._prevChar = null;
        }

        this._built = true;
    }

    public create(normalizationEOL: boolean = false, defaultEOL: EndOfLineType = EndOfLineType.LF, force?: boolean): IPieceTable {
        if (this._created) {
            panic('TextBufferBuilder cannot create twice');
        }

        const eol = this.__getEOF(defaultEOL, force);
        if (normalizationEOL) {
            this.__normalizeEOL(eol);
        }

        this._created = true;
        return new PieceTable(this._chunks, normalizationEOL, eol);
    }

    // [private helper methods]

    private __receiveChunk(chunk: string, allowEmptyString: boolean = false): void {
        if (allowEmptyString === false && chunk.length === 0) {
            return;
        }

        const {cr, lf, crlf, linestart} = TextBuffer.readLineStarts(chunk);
        
        this._chunks.push(new TextBuffer(chunk, linestart));
        this._cr += cr;
        this._lf += lf;
        this._crlf += crlf;
    }

    private __getEOF(defaultEOF: EndOfLineType, force?: boolean): EndOfLine {

        const totalCR = this._cr + this._crlf;
        const totalEOF = totalCR + this._lf;
        
        // either empty file or file contains just one line.
        if (totalEOF === 0 || force) {
            return defaultEOF === EndOfLineType.CRLF ? EndOfLine.CRLF : EndOfLine.LF;
        }

        if (totalCR > totalEOF / 2) {
            return EndOfLine.CRLF;
        } else {
            return EndOfLine.LF;
        }
    }

    /**
     * @description Replaces all the linefeeds to the given {@link EndOfLine}.
     */
    private __normalizeEOL(EOL: EndOfLine): void {
        
        if (EOL === EndOfLine.CRLF && !this._cr && !this._lf) {
            return;
        }

        if (EOL === EndOfLine.LF && !this._cr && !this._crlf) {
            return;
        }
        
        let i = 0;
        for (i = 0; i < this._chunks.length; i++) {
            const chunk = this._chunks[i]!;
            const normalizedBuffer = chunk.buffer.replace(/\r\n|\r|\n/g, EOL);
            const normalizedLinestart = TextBuffer.readLineStarts(normalizedBuffer).linestart;
            this._chunks[i] = new TextBuffer(normalizedBuffer, normalizedLinestart);
        }
    }

}
