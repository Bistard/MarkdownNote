import { ErrorHandler } from "src/base/common/error";
import { DataBuffer } from "src/base/common/files/buffer";
import { URI } from "src/base/common/files/uri";
import { Mutable } from "src/base/common/utilities/type";
import { IFileService } from "src/platform/files/common/fileService";

/**
 * @file Contains a series of helpers that detect/guess the encoding of a file.
 * Useful for cases such as: detecting if a file is a binary file.
 * 
 * {@link detectEncodingFromFile}
 * {@link detectEncoding}
 * {@link detectEncodingByBOM}
 * {@link detectEncodingByZeroByte}
 */

export const UTF16be_BOM = [0xFE, 0xFF];
export const UTF16le_BOM = [0xFF, 0xFE];
export const UTF8_BOM = [0xEF, 0xBB, 0xBF];

export const UTF8 = 'utf8';
export const UTF8_with_bom = 'utf8bom';
export const UTF16be = 'utf16be';
export const UTF16le = 'utf16le';

const NO_ENCODING_GUESS_MIN_BYTES = 512;       // when not auto guessing the encoding, small number of bytes are enough
const AUTO_ENCODING_GUESS_MIN_BYTES = 512 * 8; // with auto guessing we want a lot more content to be read for guessing
const ZERO_BYTE_DETECTION_BUFFER_MAX_LEN = 512; // number of bytes to look at to decide about a file being binary or not

export interface IDetectEncodingResult {
    /**
     * The file is likely to be a binary file.
     */
    readonly seemsBinary: boolean;
    /**
     * If provided, indicates the encoding method of the file.
     * e.g. UTF-8, UTF-16, UTF-32, etc...
     */
    readonly encoding?: string;
}

export async function detectEncodingFromFile(fileService: IFileService, uri: URI): Promise<IDetectEncodingResult> {
    const bufferLength = NO_ENCODING_GUESS_MIN_BYTES;
    return (await fileService.readFile(uri, { length: bufferLength }))
    .match(
        buffer => detectEncoding(buffer, bufferLength),
        err => {
            ErrorHandler.onUnexpectedError(err);
            return {
                seemsBinary: false,
                encoding: undefined,
            };
        }
    );
}

/**
 * @description Detects the encoding of a given data buffer based on BOM 
 * (Byte Order Mark) or the distribution of zero bytes within the buffer.
 */
export function detectEncoding(buffer: DataBuffer, bufferLength: number): IDetectEncodingResult {
    let result: Mutable<IDetectEncodingResult> = {
        seemsBinary: false,
        encoding: undefined,
    };

    /**
     * Always check BOM (Byte Order Mark) first.
     */
    result.encoding = detectEncodingByBOM(buffer, bufferLength);
    
    /**
     * If BOM doesn't work, we try to detect 0 bytes to see if file is binary or 
     * UTF-16 LE/BE.
     */
	if (!result.encoding) {
        result = detectEncodingByZeroByte(buffer, bufferLength);
    }

    // TODO: fallback to use `jschardet` to guess encoding

    return result;
}

/**
 * @description Detects the encoding of a given data buffer by checking for a 
 * BOM (Byte Order Mark).
 */
export function detectEncodingByBOM(buffer: DataBuffer, bufferLength: number): string | undefined {
    if (!buffer || bufferLength < UTF16be_BOM.length) {
		return undefined;
	}

	const b0 = buffer.readUInt8(0);
	const b1 = buffer.readUInt8(1);

	// UTF-16 BE
	if (b0 === UTF16be_BOM[0] && b1 === UTF16be_BOM[1]) {
		return UTF16be;
	}

	// UTF-16 LE
	if (b0 === UTF16le_BOM[0] && b1 === UTF16le_BOM[1]) {
		return UTF16le;
	}

	if (bufferLength < UTF8_BOM.length) {
		return undefined;
	}

	const b2 = buffer.readUInt8(2);

	// UTF-8
	if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
		return UTF8_with_bom;
	}

	return undefined;
}

/**
 * @description This is a simplified guess to detect UTF-16 BE or LE by just 
 * checking if the first {@link ZERO_BYTE_DETECTION_BUFFER_MAX_LEN} bytes have 
 * the 0-byte at a specific location. For UTF-16 LE this would be the odd byte 
 * index and for UTF-16 BE the even one.
 * 
 * @note This can produce false positives (a binary file that uses a 2-byte
 * encoding of the same format as UTF-16) and false negatives (a UTF-16 file
 * that is using 4 bytes to encode a character).
 */
export function detectEncodingByZeroByte(buffer: DataBuffer, bufferLength: number): IDetectEncodingResult {
    let encoding: string | undefined = undefined;
    let seemsBinary = false;
    let couldBeUTF16LE = true; // e.g. 0xAA 0x00
    let couldBeUTF16BE = true; // e.g. 0x00 0xAA
    let containsZeroByte = false;

    for (let i = 0; i < bufferLength && i < ZERO_BYTE_DETECTION_BUFFER_MAX_LEN; i++) {
        const isEndian = (i % 2 === 1); // assume 2-byte sequences typical for UTF-16
        const isZeroByte = (buffer.readUInt8(i) === 0);

        if (isZeroByte) {
            containsZeroByte = true;
        }

        // UTF-16 LE: expect e.g. 0xAA 0x00
        if (couldBeUTF16LE && (isEndian && !isZeroByte || !isEndian && isZeroByte)) {
            couldBeUTF16LE = false;
        }

        // UTF-16 BE: expect e.g. 0x00 0xAA
        if (couldBeUTF16BE && (isEndian && isZeroByte || !isEndian && !isZeroByte)) {
            couldBeUTF16BE = false;
        }

        // Return if this is neither UTF16-LE nor UTF16-BE and thus treat as binary
        if (isZeroByte && !couldBeUTF16LE && !couldBeUTF16BE) {
            break;
        }
    }

    // Handle case of 0-byte included
    if (containsZeroByte) {
        if (couldBeUTF16LE) {
            encoding = UTF16le;
        } else if (couldBeUTF16BE) {
            encoding = UTF16be;
        } else {
            seemsBinary = true;
        }
    }

    return {
        seemsBinary: seemsBinary,
        encoding: encoding,
    };
}