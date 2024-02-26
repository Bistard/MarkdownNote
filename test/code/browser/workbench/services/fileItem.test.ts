import * as assert from 'assert';
import { after, before, beforeEach } from 'mocha';
import { FileType } from 'src/base/common/files/file';
import { Schemas, URI } from 'src/base/common/files/uri';
import { OS_CASE_SENSITIVE } from 'src/base/common/platform';
import { TreeLike } from 'src/base/common/utilities/type';
import { FileService, IFileService } from 'src/platform/files/common/fileService';
import { DiskFileSystemProvider } from 'src/platform/files/node/diskFileSystemProvider';
import { FileItem, IFileItemResolveOptions } from 'src/workbench/services/fileTree/fileItem';
import { FileTreeNode, SAMPLE_TREE_LIKE3, buildFileItem, buildFileTree, findFileItemByPath } from 'test/utils/helpers';
import { NullLogger, TestURI } from 'test/utils/testService';

suite('FileItem-test', () => {
    let fileService!: IFileService;

    const rootURI = URI.join(TestURI, 'fileItem');
    let root!: FileItem;

    before(async () => {
        fileService = new FileService(new NullLogger());
        fileService.registerProvider(Schemas.FILE, new DiskFileSystemProvider());
        await fileService.createDir(rootURI).unwrap();
    });

    after(async () => {
        await fileService.delete(rootURI, { recursive: true }).unwrap();
    });

    // refreah the tree hierarchy every test
    beforeEach(async () => {
        await buildFileTree(fileService, rootURI, { cleanRoot: true, overwrite: true }, SAMPLE_TREE_LIKE3);
        root = await buildFileItem(fileService, rootURI);
    });

    suite('property-test', () => {
        
        test('property check: uri / id / parent', async () => {
            const expectRootURI = URI.join(rootURI, 'root');
            assert.strictEqual(root.parent, null);
            assert.ok(URI.equals(root.uri, expectRootURI));
            assert.strictEqual(root.id, URI.toString(expectRootURI));

            const fFirstChild = findFileItemByPath(root, [0]);
            assert.strictEqual(fFirstChild?.parent, root);
        });

        test('property check: name / basename / extname / type', async () => {
            assert.strictEqual(root.name, 'root');
            assert.strictEqual(root.basename, 'root');
            assert.strictEqual(root.extname, '');
            assert.strictEqual(root.type, FileType.DIRECTORY);

            const file1 = findFileItemByPath(root, [0]);
            assert.ok(file1);

            assert.strictEqual(file1.name, 'FILE1.js');
            assert.strictEqual(file1.basename, 'FILE1');
            assert.strictEqual(file1.extname, '.js');
            assert.strictEqual(file1.type, FileType.FILE);
        });
        
        test('property check: children', async () => {
            assert.strictEqual(root.children.length, 5);

            // first child ref check
            const firstChild = root.children[0]!;
            const actualFirstChild = findFileItemByPath(root, [0]);
            assert.strictEqual(firstChild, actualFirstChild);
        });

        test('property check: mapChildren (lazy loading)', async function () {
            // make sure it is lazy loading
            assert.strictEqual(root['_mapChildrenCache'], undefined);
            assert.strictEqual(root.mapChildren.size, 5);
            assert.notStrictEqual(root['_mapChildrenCache'], undefined);
        });
        
        test('property check: mapChildren (CaseIgnore)', async function () {
            if (OS_CASE_SENSITIVE) {
                this.skip();
            }
            assert.strictEqual(root.mapChildren.size, 5);
            assert.ok(root.mapChildren.get('file1.js') === findFileItemByPath(root, [0]));
            assert.ok(root.mapChildren.get('file2.js') === findFileItemByPath(root, [1]));
            assert.ok(root.mapChildren.get('file3.txt') === findFileItemByPath(root, [2]));
            assert.ok(root.mapChildren.get('folder1') === findFileItemByPath(root, [3]));
            assert.ok(root.mapChildren.get('folder2') === findFileItemByPath(root, [4]));
        });
        
        test('property check: mapChildren (CaseSensitive)', async function () {
            if (!OS_CASE_SENSITIVE) {
                this.skip();
            }
            assert.strictEqual(root.mapChildren.size, 5);
            console.log(root.mapChildren.keys());
            assert.ok(root.mapChildren.get('FILE1.js') === findFileItemByPath(root, [0]), '0 fails');
            
            console.log(root.mapChildren.get('file2.JS')?.name);
            console.log(findFileItemByPath(root, [1])?.name);
            assert.ok(root.mapChildren.get('file2.JS') === findFileItemByPath(root, [1]), '1 fails');
            
            
            // assert.ok(root.mapChildren.get('File3.txt') === findFileItemByPath(root, [2]), '2 fails');
            // assert.ok(root.mapChildren.get('folder1') === findFileItemByPath(root, [3]), '3 fails');
            // assert.ok(root.mapChildren.get('folder2') === findFileItemByPath(root, [4]), '4 fails');
        });
    });

    suite('method-test', () => {
        test('root() / isDirectory() / isFile() / hasChildren()', async () => {
            assert.strictEqual(root.root(), root);
            assert.ok(root.isRoot());
            
            assert.ok(root.isDirectory());

            const file1 = findFileItemByPath(root, [0])!;
            assert.ok(file1.isFile());

            assert.ok(root.hasChildren());
            assert.ok(!file1.hasChildren());
        });

        test('FileItem.resolve()', async () => {
            // noop: already tested in `buildFileItem` helper utility
        });
        
        test('forgetChildren() / isChildrenResolved()', async () => {
            assert.ok(root.isChildrenResolved());
            root.forgetChildren();
            assert.strictEqual(root.children.length, 0);
            assert.strictEqual(root.mapChildren.size, 0);
            assert.ok(!root.isChildrenResolved());
        });

        test('refreshChildren()', async () => {

        });
    });
    

    // test('isRoot() returns true if no parent', () => {
    //     assert.strictEqual(fileItem.isRoot(), true);
    // });

    // test('isDirectory() returns true for directory type', () => {
    //     fileItem = new FileItem({ ...fileStat, type: FileType.DIRECTORY }, null, []);
    //     assert.strictEqual(fileItem.isDirectory(), true);
    // });

    // test('isFile() returns true for file type', () => {
    //     assert.strictEqual(fileItem.isFile(), true);
    // });

    // test('isChildrenResolved() returns false initially', () => {
    //     assert.strictEqual(fileItem.isChildrenResolved(), false);
    // });

    // test('hasChildren() returns false for file type', () => {
    //     assert.strictEqual(fileItem.hasChildren(), false);
    // });

    // test('refreshChildren() resolves children for directory', async () => {
    //     fileItem = new FileItem({ ...fileStat, type: FileType.DIRECTORY }, null, []);
    //     // Mock fileService.stat() to return a resolved directory with children
    //     fileService.stat = () => Promise.resolve({
    //         uri: new URI('file://path/to/directory'),
    //         name: 'directory',
    //         type: FileType.DIRECTORY,
    //         createTime: Date.now(),
    //         modifyTime: Date.now(),
    //         children: [{ ...fileStat, name: 'childFile.js' }]
    //     });

    //     await fileItem.refreshChildren(fileService, opts);
    //     assert.strictEqual(fileItem.children.length, 1);
    //     assert.strictEqual(fileItem.children[0].name, 'childFile.js');
    // });

    // test('forgetChildren() clears children and marks as unresolved', () => {
    //     fileItem = new FileItem({ ...fileStat, type: FileType.DIRECTORY, children: [{ ...fileStat, name: 'childFile.js' }] }, null, []);
    //     fileItem.forgetChildren();
    //     assert.strictEqual(fileItem.children.length, 0);
    //     assert.strictEqual(fileItem.isChildrenResolved(), false);
    // });

    // test('findChild() returns undefined for non-matching URI', () => {
    //     const child = fileItem.findChild(new URI('file://path/to/anotherFile'));
    //     assert.strictEqual(child, undefined);
    // });

    // test('findChild() returns child for matching URI', () => {
    //     fileItem = new FileItem({ ...fileStat, type: FileType.DIRECTORY }, null, [
    //         new FileItem({ ...fileStat, name: 'childFile.js', uri: new URI('file://path/to/file/childFile.js') }, fileItem, [])
    //     ]);
    //     const child = fileItem.findChild(new URI('file://path/to/file/childFile.js'));
    //     assert.strictEqual(child?.name, 'childFile.js');
    // });
});