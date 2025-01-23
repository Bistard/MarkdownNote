import { CharCode } from "src/base/common/utilities/char";
import { ITextBuffer } from "src/editor/common/model";

export class TextBuffer implements ITextBuffer {
    constructor(
        public readonly buffer: string,
        public readonly linestart: number[]
    ) {}

    /**
     * @description Read through the given string and counts all the newline characters.
     * @param string The given string.
     * @param offset Gives the choice to add an offset to each linestart.
     * @complexity O(n)
     */
    public static readLineStarts(string: string, offset: number = 0): { cr: number; lf: number; crlf: number; linestart: number[] } {
        const arr: number[] = [0];
        let cr = 0;
        let lf = 0;
        let crlf = 0;

        let i = 0;
        const strlen = string.length;
        let c: number;
        for (i = 0; i < strlen; i++) {
            c = string.charCodeAt(i);

            if (c === CharCode.CarriageReturn) {
                // `/r/n`
                if (i + 1 < strlen && string.charCodeAt(i + 1) === CharCode.LineFeed) {
                    arr.push(i + 2 + offset);
                    i++;
                    crlf++;
                } 
                // `/r`
                else {
                    arr.push(i + 1 + offset);
                    cr++;
                }
            } 
            // `/n`
            else if (c === CharCode.LineFeed) {
                arr.push(i + 1 + offset);
                lf++;
            }
        }

        return {
            cr: cr,
            lf: lf,
            crlf: crlf,
            linestart: arr
        };
    }

}

