import * as assert from 'assert';
import * as fs from 'fs';
import { after, afterEach, before } from 'mocha';
import { join } from 'src/base/common/file/path';
import { Schemas, URI } from 'src/base/common/file/uri';
import { DiskFileSystemProvider } from 'src/code/platform/files/node/diskFileSystemProvider';
import { FileService, IFileService } from 'src/code/platform/files/common/fileService';
import { DiskStorage } from 'src/code/platform/files/common/diskStorage';
import { TestPath, NullLogger } from 'test/utils/utility';

suite.only('storage-test', () => {

    let dir: string;
    let path: string;
    let fileService: IFileService;
    
    before(() => {
        dir = join(TestPath, 'storage');
        path = join(dir, 'storage.json');

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path, '');
        fileService = new FileService(new NullLogger());
        fileService.registerProvider(Schemas.FILE, new DiskFileSystemProvider());
    });

    afterEach(() => {
        fs.writeFileSync(path, '');
    });

    after(() => {
        fileService.dispose();
        fs.rmSync(dir, { recursive: true });
    });

    test('basic - set / get / has', async () => {
        const storage = new DiskStorage(URI.fromFile(path), true, fileService);
        await storage.init();

        storage.set('key1', 'value1');
        assert.strictEqual(storage.get('key1'), 'value1');

        storage.set('key2', null);
        assert.strictEqual(storage.get('key2'), undefined);

        assert.strictEqual(storage.get('key3'), undefined);

        storage.setLot([
            { key: 'key3', val: 'value3' },
            { key: 'key4', val: 'value4' },
            { key: 'key5', val: 'value5' },
        ]);
        assert.strictEqual(storage.get('key3'), 'value3');
        assert.strictEqual(storage.get('key4'), 'value4');
        assert.strictEqual(storage.get('key5'), 'value5');

        storage.set('key6', null);
        assert.deepStrictEqual(storage.getLot(['key6', 'key7'], [undefined, undefined]), [undefined, undefined]);
        
        assert.strictEqual(storage.has('key4'), true);
        assert.strictEqual(storage.has('key5'), true);
        assert.strictEqual(storage.has('key6'), false);
        assert.strictEqual(storage.has('key7'), false);
    });

    test('used before init', async () => {
        const storage = new DiskStorage(URI.fromFile(path), true, fileService);

		storage.set('key1', 'value1');
		storage.delete('key2');

		assert.strictEqual(storage.get('key1'), 'value1');
		assert.strictEqual(storage.get('key2'), undefined);

		await storage.init();

		assert.strictEqual(storage.get('key1'), 'value1');
		assert.strictEqual(storage.get('key2'), undefined);
    });

    test('used after close', async () => {
        const storage = new DiskStorage(URI.fromFile(path), true, fileService);
		await storage.init();

		storage.set('key1', 'value1');
		storage.set('key2', 'value2');
		storage.set('key3', 'value3');
		storage.set('key4', 'value4');

		await storage.close();

		storage.set('key5', 'marker');

		const contents = fs.readFileSync(path).toString();
		assert.ok(contents.includes('value1'));
		assert.ok(!contents.includes('marker'));

		await storage.close();
    });

    test('Closed before init', async () => {
		const storage = new DiskStorage(URI.fromFile(path), true, fileService);

		storage.set('key1', 'value1');
		storage.set('key2', 'value2');
		storage.set('key3', 'value3');
		storage.set('key4', 'value4');

		await storage.close();

		const contents = fs.readFileSync(path).toString();
		assert.strictEqual(contents.length, 0);
	});

    test('re-init', async () => {
		const storage = new DiskStorage(URI.fromFile(path), true, fileService);
        await storage.init();

        await storage.close();

		storage.set('key1', 'value1');
		storage.set('key2', 'value2');
		storage.set('key3', 'value3');
		storage.set('key4', 'value4');

        await storage.init();

        assert.deepStrictEqual(storage.getLot(['key1', 'key2', 'key3', 'key4']), [undefined, undefined, undefined, undefined]);
	});

    test('non-sync saving', async () => {
        const storage = new DiskStorage(URI.fromFile(path), false, fileService);
        await storage.init();

        storage.set('key1', 'value1');
		storage.set('key2', 'value2');
		storage.set('key3', 'value3');
		storage.set('key4', 'value4');

        let contents = fs.readFileSync(path).toString();
		assert.strictEqual(contents.length, 0);

        await storage.close();

		contents = fs.readFileSync(path).toString();
		assert.strictEqual(contents.length > 0, true);
    });

    test('manually saving', async () => {
        const storage = new DiskStorage(URI.fromFile(path), false, fileService);
        await storage.init();

        storage.set('key1', 'value1');
		storage.set('key2', 'value2');
		storage.set('key3', 'value3');
		storage.set('key4', 'value4');

        await storage.save();

        let contents = fs.readFileSync(path).toString();
		assert.strictEqual(contents.length > 0, true);
    });

    test('sync saving', async () => {
        const storage = new DiskStorage(URI.fromFile(path), true, fileService);
        await storage.init();

        await storage.set('key1', 'value1');
		await storage.set('key2', 'value2');
		await storage.set('key3', 'value3');
		await storage.set('key4', 'value4');

        let contents = fs.readFileSync(path).toString();
		assert.strictEqual(contents.length > 0, true);
    });
});