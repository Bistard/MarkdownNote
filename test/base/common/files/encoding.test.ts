import * as assert from 'assert';
import { suite, test } from 'mocha';
import { DataBuffer } from 'src/base/common/files/buffer';
import { detectEncoding, UTF8_with_bom, UTF16be, UTF16le, detectEncodingByBOM, detectEncodingByZeroByte, UTF8 } from 'src/base/common/files/encoding';
import { URI } from 'src/base/common/files/uri';
import { readFile } from 'test/utils/helpers';
import { APP_FILE_ROOT_URI } from 'test/utils/testService';

suite('DetectEncoding-test (basic)', () => {
    suite('detectEncoding', () => {
        test('should detect UTF-8 with BOM', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0xEF, 0xBB, 0xBF, 0x41]));
            const result = detectEncoding(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, UTF8_with_bom);
            assert.strictEqual(result.seemsBinary, false);
        });

        test('should detect UTF-16 BE', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0xFE, 0xFF, 0x00, 0x41]));
            const result = detectEncoding(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, UTF16be);
            assert.strictEqual(result.seemsBinary, false);
        });

        test('should detect UTF-16 LE', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0xFF, 0xFE, 0x41, 0x00]));
            const result = detectEncoding(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, UTF16le);
            assert.strictEqual(result.seemsBinary, false);
        });

        test('should detect binary file', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
            const result = detectEncoding(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, undefined);
            assert.strictEqual(result.seemsBinary, true);
        });

        test('should return undefined for empty buffer', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([]));
            const result = detectEncoding(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, undefined);
            assert.strictEqual(result.seemsBinary, false);
        });
    });

    suite('detectEncodingByBOM', () => {
        test('should detect UTF-8 with BOM', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0xEF, 0xBB, 0xBF, 0x41]));
            const result = detectEncodingByBOM(buffer, buffer.bufferLength);
            assert.strictEqual(result, UTF8_with_bom);
        });

        test('should detect UTF-16 BE', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0xFE, 0xFF, 0x00, 0x41]));
            const result = detectEncodingByBOM(buffer, buffer.bufferLength);
            assert.strictEqual(result, UTF16be);
        });

        test('should detect UTF-16 LE', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0xFF, 0xFE, 0x41, 0x00]));
            const result = detectEncodingByBOM(buffer, buffer.bufferLength);
            assert.strictEqual(result, UTF16le);
        });

        test('should return undefined for no BOM', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0x41, 0x42, 0x43, 0x44]));
            const result = detectEncodingByBOM(buffer, buffer.bufferLength);
            assert.strictEqual(result, undefined);
        });

        test('should return undefined for insufficient buffer length', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0xFE]));
            const result = detectEncodingByBOM(buffer, buffer.bufferLength);
            assert.strictEqual(result, undefined);
        });
    });

    suite('detectEncodingByZeroByte', () => {
        test('should detect UTF-16 LE', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0x41, 0x00, 0x42, 0x00]));
            const result = detectEncodingByZeroByte(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, UTF16le);
            assert.strictEqual(result.seemsBinary, false);
        });

        test('should detect UTF-16 BE', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0x00, 0x41, 0x00, 0x42]));
            const result = detectEncodingByZeroByte(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, UTF16be);
            assert.strictEqual(result.seemsBinary, false);
        });

        test('should detect binary file', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
            const result = detectEncodingByZeroByte(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, undefined);
            assert.strictEqual(result.seemsBinary, true);
        });

        test('should return no encoding and not binary for buffer without zeros', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([0x41, 0x42, 0x43, 0x44]));
            const result = detectEncodingByZeroByte(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, undefined);
            assert.strictEqual(result.seemsBinary, false);
        });

        test('should handle empty buffer', () => {
            const buffer = DataBuffer.wrap(new Uint8Array([]));
            const result = detectEncodingByZeroByte(buffer, buffer.bufferLength);
            assert.strictEqual(result.encoding, undefined);
            assert.strictEqual(result.seemsBinary, false);
        });
    });
});

suite('DetectEncoding-test (fixtures)', () => {

    const baseURI = URI.join(APP_FILE_ROOT_URI, './test/base/common/files/fixtures/');
    function assertEncoding(input: { buffer?: DataBuffer, bufferLength: number }, expect: { seemsBinary: boolean, encoding?: string }): void {
        if (!input.buffer) {
            assert.fail('No given buffer');
        }
        const actual = detectEncoding(input.buffer, input.bufferLength);
        assert.strictEqual(actual.seemsBinary, expect.seemsBinary, `Expecting "seemsBinary: ${expect.seemsBinary}"`);
        assert.strictEqual(actual.encoding, expect.encoding);
    }

    suite('non-binary', () => {
        test('detectEncoding (empty)', async () => {
            const result = await readFile(URI.join(baseURI, 'empty.txt'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: undefined,
            });
        });
        
        test('detectEncoding (some_utf8_bom.txt)', async () => {
            const result = await readFile(URI.join(baseURI, 'some_utf8_bom.txt'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF8_with_bom,
            });
        });
        
        test('detectEncoding (some_ansi.css)', async () => {
            const result = await readFile(URI.join(baseURI, 'some_ansi.css'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: undefined,
            });
        });
        
        // FIX: required to use `jschardet` to detect utf8
        test.skip('detectEncoding (some_file.css)', async () => {
            const result = await readFile(URI.join(baseURI, 'some_file.css'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF8,
            });
        });
        
        test('detectEncoding (some_gbk.txt)', async () => {
            const result = await readFile(URI.join(baseURI, 'some_gbk.txt'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: undefined,
            });
        });
        
        // FIX: required to use `jschardet` to detect utf8
        test.skip('detectEncoding (some_utf8.css)', async () => {
            const result = await readFile(URI.join(baseURI, 'some_utf8.css'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF8,
            });
        });
        
        test('detectEncoding (some_utf16be.css)', async () => {
            const result = await readFile(URI.join(baseURI, 'some_utf16be.css'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF16be,
            });
        });
        
        test('detectEncoding (some_utf16le.css)', async () => {
            const result = await readFile(URI.join(baseURI, 'some_utf16le.css'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF16le,
            });
        });

        // FIX: required to use `jschardet` to detect utf8
        test.skip('detectEncoding (some.json.png)', async () => {
            const result = await readFile(URI.join(baseURI, 'some.json.png'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF8,
            });
        });

        test('detectEncoding (some.xml.png)', async () => {
            const result = await readFile(URI.join(baseURI, 'some.xml.png'));
            assertEncoding(result, {
                seemsBinary: false,
            });
        });
        
        test('detectEncoding (utf16_be_nobom.txt)', async () => {
            const result = await readFile(URI.join(baseURI, 'utf16_be_nobom.txt'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF16be,
            });
        });
        
        test('detectEncoding (utf16_le_nobom.txt)', async () => {
            const result = await readFile(URI.join(baseURI, 'utf16_le_nobom.txt'));
            assertEncoding(result, {
                seemsBinary: false,
                encoding: UTF16le,
            });
        });
    });

    suite('binary', () => {
        test('detectEncoding (some.pdf)', async () => {
            const result = await readFile(URI.join(baseURI, 'some.pdf'));
            assertEncoding(result, {
                seemsBinary: true,
            });
        });
        
        test('detectEncoding (some.png.txt)', async () => {
            const result = await readFile(URI.join(baseURI, 'some.png.txt'));
            assertEncoding(result, {
                seemsBinary: true,
            });
        });
        
        test('detectEncoding (some.qwoff.txt)', async () => {
            const result = await readFile(URI.join(baseURI, 'some.qwoff.txt'));
            assertEncoding(result, {
                seemsBinary: true,
            });
        });
    });
});