import * as assert from 'assert';
import { DataBuffer } from 'src/base/common/file/buffer';
import { ByteSize, FileType } from 'src/base/common/file/file';
import { URI } from 'src/base/common/file/uri';
import { DiskFileSystemProvider } from 'src/code/platform/files/node/diskFileSystemProvider';
import { FileService } from 'src/code/platform/files/common/fileService';
import { NullLogger, TestURI } from 'test/testUtility';
import { Random } from 'src/base/common/util/random';
import { Array } from 'src/base/common/util/array';

suite('FileService-disk-test', () => {

    const service = new FileService(new NullLogger());

    async function createFileWithSize(resource: URI, size: number, defaultChar?: number): Promise<void> {
        
        const arr: string[] = [];

        if (!defaultChar) {
            for (let i = 0; i < size; i++) {
                arr[i] = Random.getRandChar();
            }
        } else {
            for (let i = 0; i < size; i++) {
                arr[i] = String(defaultChar);
            }
        }
        
        const buffer = DataBuffer.fromString(arr.join());
        return service.writeFile(resource, buffer, { create: true, overwrite: true, unlock: true });
    }

    const baseURI = URI.join(TestURI, 'file-service-test');

    setup(async () => {
        // disk provider registration
        const provider = new DiskFileSystemProvider();
        service.registerProvider('file', provider);
        assert.strictEqual(provider, service.getProvider('file'));

        // create testing files
        await service.createDir(baseURI);
        const filebaseURI = URI.join(baseURI, 'files');
        for (const size of [ByteSize.KB, 256 * ByteSize.KB, ByteSize.MB, 10 * ByteSize.MB]) {
            await createFileWithSize(URI.join(filebaseURI, `file-${size}.txt`), size, undefined);
        }
    });

    test('stat - basic', async () => {
        const stat = await service.stat(baseURI);
        assert.strictEqual(stat.type, FileType.DIRECTORY);
        assert.strictEqual(stat.name, 'file-service-test');
        assert.strictEqual(stat.readonly, false);
        assert.strictEqual(stat.children, undefined);
    });
    
    test('stat - resolve children', async () => {
        const filebaseURI = URI.join(baseURI, 'files');
        const stat = await service.stat(filebaseURI, { resolveChildren: true });
        assert.strictEqual(stat.type, FileType.DIRECTORY);
        assert.strictEqual(stat.name, 'files');
        assert.strictEqual(stat.readonly, false);
        assert.strictEqual([...stat.children!].length, 4);
    });

    test('stat - resolve children recursive', async () => {
        const stat = await service.stat(baseURI, { resolveChildrenRecursive: true });
        
        assert.strictEqual(stat.type, FileType.DIRECTORY);
        assert.strictEqual(stat.name, 'file-service-test');
        assert.strictEqual(stat.readonly, false);

        const tempDir = Array.coalesce([...stat.children!].map(child => child.name === 'files' ? child : undefined))[0]!;
        assert.strictEqual(tempDir.type, FileType.DIRECTORY);
        assert.strictEqual(tempDir.name, 'files');
        assert.strictEqual([...tempDir.children!].length, 4);
    });

    test('readFile - basic', async () => {
        const filebaseURI = URI.join(baseURI, 'files');
        const uri = URI.join(filebaseURI, `file-${ByteSize.KB}.txt`);
        await service.readFile(uri);
    });

    test('readFile - error', async () => {
        const filebaseURI = URI.join(baseURI, 'files');
        const uri = URI.join(filebaseURI, `file-unknown.txt`);
        try {
            await service.readFile(uri);
            assert.strictEqual(false, true);
        } catch (error) {
            assert.strictEqual(true, true);
        }
    });

    test('readDir', async () => {
        const filebaseURI = URI.join(baseURI, 'files');
        const dir = await service.readDir(filebaseURI);
        assert.strictEqual(dir.length, 4);
        assert.strictEqual(dir[0]![1], FileType.FILE);
        assert.strictEqual(dir[1]![1], FileType.FILE);
        assert.strictEqual(dir[2]![1], FileType.FILE);
        assert.strictEqual(dir[3]![1], FileType.FILE);
    });

    test('createDir', async () => {
        const root = URI.join(baseURI, 'dir-1');
        const uri = URI.join(root, 'dir-2');
        
        await service.createDir(uri);
        const dir1 = await service.readDir(root);
        assert.strictEqual(dir1.length, 1);
        assert.strictEqual(dir1[0]![0], 'dir-2');
        assert.strictEqual(dir1[0]![1], FileType.DIRECTORY);
        
        await service.delete(root, { recursive: true, useTrash: false });
    });

    test('exist', async () => {
        const filebaseURI = URI.join(baseURI, 'files');
        assert.strictEqual(await service.exist(filebaseURI), true);
        assert.strictEqual(await service.exist(URI.join(filebaseURI, `file-${ByteSize.KB}.hello.world`)), false);
        assert.strictEqual(await service.exist(URI.join(filebaseURI, `file-${256 * ByteSize.KB}.txt`)), true);
        assert.strictEqual(await service.exist(URI.join(filebaseURI, `file-${ByteSize.MB}.txt`)), true);
        assert.strictEqual(await service.exist(URI.join(filebaseURI, `file-${10 * ByteSize.MB}.txt`)), true);
    });

    test('delete - file', async () => {
        const base = URI.join(baseURI, 'delete');
        const uri = URI.join(base, 'delete.txt');
        await service.writeFile(uri, DataBuffer.fromString('goodbyte world'), { create: true, overwrite: true, unlock: true });

        await service.delete(uri, { useTrash: true, recursive: true });

        const dir = await service.readDir(base);
        assert.strictEqual(dir.length, 0);
    });

    test('delete - directory', async () => {
        const root = URI.fromFile('test/code/service/temp');
        const uri = URI.fromFile('test/code/service/temp/newDir1');
        await service.createDir(uri);

        await service.delete(uri, { useTrash: true, recursive: true });
        
        const dir = await service.readDir(root);
        assert.strictEqual(dir.length, 4);
        assert.strictEqual(dir[0]![1], FileType.FILE);
        assert.strictEqual(dir[1]![1], FileType.FILE);
        assert.strictEqual(dir[2]![1], FileType.FILE);
        assert.strictEqual(dir[3]![1], FileType.FILE);
    });

    test('delete - recursive', async () => {
        const root = URI.join(baseURI, 'delete-recursive');
        const dir1 = URI.join(root, 'dir-1');
        const dir2 = URI.join(dir1, 'dir-2');
        const dir3 = URI.join(dir2, 'dir-3');
        await service.createDir(dir3);

        await service.delete(dir1, { useTrash: true, recursive: true });

        const dir = await service.readDir(root);
        assert.strictEqual(dir.length, 0);
    });

    test('delete - non recursive', async () => {
        const base = URI.join(baseURI, 'delete-non-recursive');
        try {    
            const uri = URI.join(base, 'dir1', 'dir2', 'file1.txt');
            await service.writeFile(uri, DataBuffer.alloc(0), { create: true, overwrite: true, unlock: true });
            await service.delete(base, { useTrash: true, recursive: false });
            assert.strictEqual(true, false);
        } catch (err) {
            await service.delete(base, { useTrash: true, recursive: true });
            assert.strictEqual(true, true);
        }
    });

    test('writeFile - basic', async () => {
        const uri = URI.join(baseURI, 'writefile');
        await service.writeFile(uri, DataBuffer.alloc(0), { create: true, overwrite: true, unlock: true });

        const write1 = DataBuffer.fromString('Goodbye World');
        await service.writeFile(uri, write1, { create: false, overwrite: true, unlock: true });
        const read1 = await service.readFile(uri);
        assert.strictEqual(read1.toString(), 'Goodbye World');

        const write2 = DataBuffer.fromString('Hello World');
        await service.writeFile(uri, write2, { create: false, overwrite: true, unlock: true });
        const read2 = await service.readFile(uri);
        assert.strictEqual(read2.toString(), 'Hello World');
    });

    test('writeFile - create', async () => {
        const uri = URI.join(baseURI, 'writefile-create', 'create.txt');
        
        // create: false
        const write1 = DataBuffer.fromString('create new file1');
        try {
            await service.writeFile(uri, write1, { create: false, overwrite: false, unlock: true });
        } catch { /** noop */ }
        const exist = await service.exist(uri);
        assert.strictEqual(exist, false);

        // create: true
        const write2 = DataBuffer.fromString('create new file2');
        await service.writeFile(uri, write2, { create: true, overwrite: false, unlock: true });
        const read2 = await service.readFile(uri);
        assert.strictEqual(read2.toString(), 'create new file2');
    });

    test('writeFile - overwrite', async () => {
        const uri = URI.join(baseURI, 'writefile-overwrite', 'overwrite.txt');
        await service.writeFile(uri, DataBuffer.fromString('Hello World'), { create: true, overwrite: true, unlock: true });

        try {
            await service.writeFile(uri, DataBuffer.fromString('Goodbye World'), { create: false, overwrite: false, unlock: true });
        } catch { /** noop */ }
        const read1 = await service.readFile(uri);
        assert.strictEqual(read1.toString(), 'Hello World');
    });
   
    test('readFile - 256kb', async () => {
        const uri = URI.join(baseURI, 'files', `file-${256 * ByteSize.KB}.txt`);
        await service.readFile(uri);
    });

    test('writeFile - 256kb', async () => {
        const uri = URI.join(baseURI, 'files', `file-${256 * ByteSize.KB}.txt`);
        const buffer = DataBuffer.fromString(Random.getRandString(256 * ByteSize.KB));
        await service.writeFile(uri, buffer, { create: true, overwrite: true, unlock: true });
    });

    test('readFile - 1mb', async () => {
        const uri = URI.join(baseURI, 'files', `file-${1 * ByteSize.MB}.txt`);
        await service.readFile(uri);
    });

    test('writeFile - 1mb', async () => {
        const uri = URI.join(baseURI, 'files', `file-${1 * ByteSize.MB}.txt`);
        const buffer = DataBuffer.fromString(Random.getRandString(ByteSize.MB));
        await service.writeFile(uri, buffer, { create: true, overwrite: true, unlock: true });
    });

    test('readFile - 10mb', async () => {
        const uri = URI.join(baseURI, 'files', `file-${10 * ByteSize.MB}.txt`);
        await service.readFile(uri);
    });

    test('writeFile - 10mb', async () => {
        const uri = URI.join(baseURI, 'files', `file-${10 * ByteSize.MB}.txt`);
        const buffer = DataBuffer.fromString(Random.getRandString(10 * ByteSize.MB));
        await service.writeFile(uri, buffer, { create: true, overwrite: true, unlock: true });
    });

    test('readFileStream', async () => {
        let cnt = 0;
        const totalSize = 1 * ByteSize.MB;
        const uri = URI.join(baseURI, 'files', `file-${totalSize}.txt`);
        const stream = await service.readFileStream(uri);
        stream.on('data', (data) => {
            cnt++;
        });
        stream.on('end', () => {
            assert.strictEqual(cnt, totalSize / FileService.bufferSize);
        });
        stream.on('error', (err) => {
            assert.strictEqual(false, true);
        }); 

        stream.destroy();
    });

    teardown(async () => {
        await service.delete(baseURI, { recursive: true });
    });
});
