import * as assert from 'assert';
import { after, before, beforeEach } from 'mocha';
import { DataBuffer } from 'src/base/common/files/buffer';
import { URI } from 'src/base/common/files/uri';
import { Arrays } from 'src/base/common/utilities/array';
import { generateMD5Hash } from 'src/base/common/utilities/hash';
import { Pair } from 'src/base/common/utilities/type';
import { FileService } from 'src/platform/files/common/fileService';
import { DiskFileSystemProvider } from 'src/platform/files/node/diskFileSystemProvider';
import { FileItem } from 'src/workbench/services/fileTree/fileItem';
import { defaultFileItemCompareFn } from "src/workbench/services/fileTree/fileTreeSorter";
import { FileTreeCustomSorter, OrderChangeType } from 'src/workbench/services/fileTree/fileTreeCustomSorter';
import { SAMPLE_TREE_LIKE, buildFileItem, buildFileTree, findFileItemByPath, printFileStat } from 'test/utils/helpers';
import { NullLogger, TestURI } from 'test/utils/testService';
import { executeOnce } from 'src/base/common/utilities/function';

suite('fileTreeCustomSorter-test', () => {

    const hash = (input: string) => generateMD5Hash(input);
    const fileService = new FileService(new NullLogger());
    const rootURI = URI.join(TestURI, 'fileTreeCustomSorterTest');
    let sorter!: FileTreeCustomSorter<FileItem>;

    async function init() {
        const provider = new DiskFileSystemProvider();
        fileService.registerProvider('file', provider);
        await fileService.createDir(rootURI).unwrap();
    }

    // Always refresh the tree structure to the file system hierarchy befor every test
    async function refreshFileSystem() {
        // build the file tree hierarchy
        sorter?.dispose();
        sorter = new FileTreeCustomSorter({
            metadataRootPath: rootURI,
            hash: hash,
            defaultComparator: defaultFileItemCompareFn,
        }, fileService, new NullLogger());
        await buildFileTree(fileService, rootURI, { cleanRoot: true, overwrite: true }, SAMPLE_TREE_LIKE);
    }

    async function cleanCache(): Promise<void> {
        await fileService.delete(rootURI, { recursive: true }).unwrap();
    }

    /**
     * @description A helper function to build a {@link FileItem} hierarchy 
     * based on the provided URI in the file system hierarchy.
     */
    const buildFileItem2 = (uri: URI) => buildFileItem(fileService, uri, {
        onError: error => console.log(error),
        beforeCmp: async folder => await sorter.syncMetadataInCacheWithDisk(folder).unwrap(),
        cmp: sorter.compare.bind(sorter),
    });

    function getMetadataURI(folder: URI): URI {
        const root = rootURI;
        const rawHash = hash(URI.toString(folder));

        const subDir = rawHash.slice(0, 2);
        const metadataName = rawHash.slice(2);

        const metadataURI = URI.join(root, subDir, `${metadataName}.json`);
        return metadataURI;
    }

    /** Only for testing purpose */
    class TestUtil {
        
        public static async printRootStat(): Promise<void> {
            const rootStat = await fileService.stat(rootURI, { resolveChildren: true, resolveChildrenRecursive: true }).unwrap();
            printFileStat(rootStat);
        }
        public static async getMetadataContent(folder: URI): Promise<string> {
            return (await fileService.readFile(getMetadataURI(folder)).unwrap()).toString();
        }
    }

    /**
     * @description Check if the given folder has its corresponding metadata 
     * file in the disk. Not just checking the existance, but also checking the 
     * actual data in that metadata file.
     * @param folder The metadata corresponding to the folder name.
     * @param exist If the folder should has a corresponding metadata.
     * @param order The actual data in the metadata file.
     */
    async function assertMetadataInDisk(folder: URI, exist: false): Promise<void>;
    async function assertMetadataInDisk(folder: URI, exist: true, order: string[]): Promise<void>;
    async function assertMetadataInDisk(folder: URI, exist: boolean, order?: string[]): Promise<void> {
        const metadataURI = getMetadataURI(folder);

        // check metadata existance first
        assert.strictEqual(exist, await fileService.exist(metadataURI).unwrap(), `'${URI.toString(folder)}' metadata does not match existance. Expect '${exist}'`);

        if (!order) {
            return;
        }

        // read its data
        const rawData = (await fileService.readFile(metadataURI).unwrap()).toString();
        const actualOrders = <string[]>JSON.parse(rawData);
        const expectOrders = order;
        
        // check the actual metadata are exactly same to the expected metadata
        assert.deepStrictEqual(actualOrders, expectOrders, `orders are not exactly equal at: '${URI.toString(folder)}'`);
    }

    async function updateMetadataToDiskManually(folder: URI, order: string[]): Promise<void> {
        const metadataURI = getMetadataURI(folder);
        const buffer = DataBuffer.fromString(JSON.stringify(order));
        await fileService.writeFile(metadataURI, buffer, { overwrite: true, create: true }).unwrap();
    }

    suite('Disk to Cache (syncMetadataInCacheWithDisk)', () => {

        before(() => init());
        beforeEach(async () => refreshFileSystem());
        after(async () => cleanCache());

        test('default order (directory goes first, then alphabet)', async () => {
            await buildFileItem2(rootURI);

            await assertMetadataInDisk(
                URI.join(rootURI, 'root'), 
                true,
                ['folder1', 'folder2', 'file1', 'file2', 'file3'],
            );
            await assertMetadataInDisk(
                URI.join(rootURI, 'root', 'folder1'), 
                true,
                ['folder1_file1', 'folder1_file2', 'folder1_file3'], 
            );
        });

        test('empty folder will not have corresponding metadata', async () => {
            await buildFileItem2(rootURI);
            await assertMetadataInDisk(
                URI.join(rootURI, 'root', 'folder2'), 
                false,
            );
        });

        test('manually update the metadata to achieve "file goes first"', async () => {
            // update manually
            await updateMetadataToDiskManually(
                URI.join(rootURI, 'root'),
                ['file1', 'file2', 'file3', 'folder1', 'folder2', ],
            );

            // build the actual FileItem
            await buildFileItem2(rootURI);

            // file should goes first
            await assertMetadataInDisk(
                URI.join(rootURI, 'root'), 
                true,
                ['file1', 'file2', 'file3', 'folder1', 'folder2'],
            );
        });
    });

    /**
     * @description It does the following thing in order:
     *      1. build the FileItem based on the root.
     *      2. run the provided `action` that modifies the root FileItem.
     *      3. rebuild the FileItem based on the same root.
     */
    async function assertMetadataAction(opts: {
        action: (root: FileItem) => Promise<void>;
        assertFn: (newRoot: FileItem) => Promise<void>;
    }): Promise<void> 
    {
        // before action is applied
        const root = await buildFileItem2(rootURI);
        await opts.action(root);

        // after action is applied
        const newRoot = await buildFileItem2(rootURI);
        await opts.assertFn(newRoot);
    }

    function __getFileItemBy(root: FileItem, name: string): FileItem {
        const defaultPathMapping = {
            ['folder1']: [0],
            ['folder2']: [1],
            ['folder3']: [2],
            ['file1']: [3],
            ['file2']: [4],
            ['file3']: [5],
            ['folder1_file1']: [0, 0],
            ['folder1_file2']: [0, 1],
            ['folder1_file3']: [0, 2],
        };
        
        const item = findFileItemByPath(root, defaultPathMapping[name]);
        assert.ok(item);
        assert.strictEqual(item.name, name);
        return item;
    }

    suite('Cache to Disk (updateMetadata)', () => {

        before(() => init());
        beforeEach(async () => refreshFileSystem());
        after(async () => cleanCache());

        test('Remove: Verify Metadata After Item Removal', async () => {
            await assertMetadataAction({
                action: async root => {
                    const item = __getFileItemBy(root, 'folder1');
                    await sorter.updateMetadata(OrderChangeType.Remove, item, 0).unwrap();
                },
                assertFn: async () => {
                    await assertMetadataInDisk(
                        URI.join(rootURI, 'root'), true,
                        ['folder2', 'file1', 'file2', 'file3'],
                    );
                },
            });
        });

        test('Swap: Confirm Metadata Reflects Swap Operation', async () => {
            await assertMetadataAction({
                action: async root => {
                    const item = __getFileItemBy(root, 'folder1');
                    await sorter.updateMetadata(OrderChangeType.Swap, item, 0, 1).unwrap();
                },
                assertFn: async () => {
                    await assertMetadataInDisk(
                        URI.join(rootURI, 'root'), true,
                        ['folder2', 'folder1', 'file1', 'file2', 'file3'],
                    );
                },
            });
        });
        
        test('Add: Ensure Metadata After Item Addition', async () => {
            await assertMetadataAction({
                action: async root => {
                    const uri = URI.join(rootURI, 'root', 'folder3');

                    // create 'folder3' in the disk
                    await fileService.createDir(uri).unwrap();

                    // 'folder3'
                    const folder3 = new FileItem(
                        await fileService.stat(uri).unwrap(),
                        root,
                        [],
                    );

                    // Add
                    await sorter.updateMetadata(OrderChangeType.Add, folder3, 2).unwrap();
                },
                assertFn: async () => {
                    await assertMetadataInDisk(
                        URI.join(rootURI, 'root'), 
                        true,
                        ['folder1', 'folder2', 'folder3', 'file1', 'file2', 'file3'],
                    );
                },
            });
        });
        
        test('Update: Check Metadata After Item Rename', async () => {
            await assertMetadataAction({
                action: async root => {
                    const from = URI.join(rootURI, 'root', 'folder2');
                    const to = URI.join(rootURI, 'root', 'folder3');

                    // move from 'folder2' to 'folder3'
                    const toStat = await fileService.moveTo(from, to).unwrap();

                    // 'folder3'
                    const folder3 = new FileItem(toStat, root, []);

                    // Update
                    await sorter.updateMetadata(OrderChangeType.Update, folder3, 1).unwrap();
                },
                assertFn: async () => {
                    await assertMetadataInDisk(
                        URI.join(rootURI, 'root'), 
                        true,
                        ['folder1', 'folder3', 'file1', 'file2', 'file3'],
                    );
                },
            });
        });
    });

    suite('Cache to Disk (updateMetadataLot)', () => {

        before(async () => init());
        beforeEach(async () => {
            await refreshFileSystem();
            // !!!
            // MAKE SURE ONLY SAVE TO DISK ONCE, THIS IS MAINLY WHY IT SUPPORTS THIS API
            // !!!
            sorter['__saveMetadataIntoDisk'] = executeOnce(sorter['__saveMetadataIntoDisk']);
        });
        after(async () => cleanCache());

        suite('removeLot', () => {
            
            // another wrapper
            async function assertRemoveLotAction(itemIndicateLevel: string, deleteIdx: number[], resultMetadata: string[]): Promise<void> {
                await assertMetadataAction({
                    action: async root => {
                        const item = __getFileItemBy(root, itemIndicateLevel);
                        await sorter.updateMetadataLot(OrderChangeType.Remove, item.parent!, deleteIdx).unwrap();
                    },
                    assertFn: async () => {
                        await assertMetadataInDisk(
                            URI.join(rootURI, 'root'), true,
                            resultMetadata,
                        );
                    },
                });
            }

            // remove 'folder1' and 'folder2'
            test('Remove: remove two items in a sequence', async () => {
                await assertRemoveLotAction('folder1', [0, 1], ['file1', 'file2', 'file3']);
            });
            
            // remove 'folder1' and 'file1'
            test('Remove: remove two items not in a sequence (case1)', async () => {
                await assertRemoveLotAction('folder1', [0, 2], ['folder2', 'file2', 'file3']);
            });
            
            // remove 'folder1' and 'file3'
            test('Remove: remove two items not in a sequence (case2)', async () => {
                await assertRemoveLotAction('folder1', [0, 4], ['folder2', 'file1', 'file2']);
            });
            
            // remove 'folder1' 'file2' and 'file3'
            test('Remove: remove two items not in a sequence (case3)', async () => {
                await assertRemoveLotAction('folder1', [0, 3, 4], ['folder2', 'file1']);
            });
            
            // remove all
            test('Remove: remove all items (case4)', async () => {
                await assertRemoveLotAction('folder1', Arrays.range(0, 5), []);
            });
        });

        suite('addLot', () => {

            /**
             * Only support adding files to the root.
             */
            async function assertAddLotAction(toAddNames: string[], addIdx: number[], resultMetadata: string[]): Promise<void> {
                await assertMetadataAction({
                    action: async root => {
                        const toAdd: FileItem[] = [];

                        for (const name of toAddNames) {
                            const fileURI = URI.join(root.uri, name);

                            await fileService.createFile(fileURI, DataBuffer.alloc(0), { overwrite: true }).unwrap();
                            const item = new FileItem(
                                await fileService.stat(fileURI).unwrap(),
                                root,
                                [],
                            );

                            toAdd.push(item);
                        }

                        await sorter.updateMetadataLot(OrderChangeType.Add, toAdd, addIdx).unwrap();
                    },
                    assertFn: async () => {
                        await assertMetadataInDisk(
                            URI.join(rootURI, 'root'), true,
                            resultMetadata,
                        );
                    },
                });
            }

            test('Add: should support adding single item', async () => {
                await assertAddLotAction(
                    ['newFile1'], [0],
                    ['newFile1', 'folder1', 'folder2', 'file1', 'file2', 'file3'],
                );
            });

            test('Add: adding mutiple items (case1)', async () => {
                await assertAddLotAction(
                    ['newFile1', 'newFile2', 'newFile3'], [0, 1, 1],
                    ['newFile1', 'folder1', 'newFile2', 'newFile3', 'folder2', 'file1', 'file2', 'file3'],
                );
            });
            
            test('Add: adding mutiple items (case2)', async () => {
                await assertAddLotAction(
                    ['newFile1', 'newFile2', 'newFile3', 'newFile4', 'newFile5'], [0, 1, 1, 3, 4],
                    ['newFile1', 'folder1', 'newFile2', 'newFile3', 'folder2', 'file1', 'newFile4', 'file2', 'newFile5', 'file3'],
                );
            });
            
            test('Add: items and indice should have the same length', async () => {
                await assert.rejects(() => assertAddLotAction(
                    ['newFile1'], [0, 1, 1, 1, 1, 1, 1, 1, 1],
                    ['newFile1', 'folder1', 'folder2', 'file1', 'file2', 'file3'],
                ), 'items and indice should have the same length');
            });
        });

        suite('updateLot', () => {

            /**
             * Only support updating files at the root.
             */
            async function assertUpdateLotAction(toUpdateNames: Pair<string, string>[], updateIdx: number[], resultMetadata: string[]): Promise<void> {
                await assertMetadataAction({
                    action: async root => {
                        const toUpdate: FileItem[] = [];
                        for (const [oldName, newName] of toUpdateNames) {
                            const from = URI.join(root.uri, oldName);
                            const to = URI.join(root.uri, newName);
                            
                            const toStat = await fileService.moveTo(from, to, true).unwrap();
                            const newItem = new FileItem(toStat, root, []);

                            toUpdate.push(newItem);
                        }
                        await sorter.updateMetadataLot(OrderChangeType.Update, toUpdate, updateIdx).unwrap();
                    },
                    assertFn: async () => {
                        await assertMetadataInDisk(
                            URI.join(rootURI, 'root'), true,
                            resultMetadata,
                        );
                    },
                });
            }

            test('Update: should support update single item', async () => {
                await assertUpdateLotAction(
                    [['folder1', 'folder3']], [0],
                    ['folder3', 'folder2', 'file1', 'file2', 'file3']
                );
            });
            
            test('Update: update mutiple items', async () => {
                await assertUpdateLotAction(
                    [
                        ['folder1', 'update_folder1'], 
                        ['file2', 'update_file2'], 
                        ['file3', 'update_file3']
                    ], [0, 3, 4],
                    ['update_folder1', 'folder2', 'file1', 'update_file2', 'update_file3']
                );
            });
            
            test('Update: items and indice should have the same length', async () => {
                await assert.rejects(() => assertUpdateLotAction(
                    [
                        ['folder1', 'update_folder1'], 
                        ['file2', 'update_file2'], 
                        ['file3', 'update_file3']
                    ], [1, 1, 1, 1, 1, 1, 1, 1],
                    ['update_folder1', 'folder2', 'file1', 'update_file2', 'update_file3']
                ), 'items and indice should have the same length');
            });
        });
    });

    suite('moveDirectoryMetadata', () => {
        
        before(async () => init());
        beforeEach(async () => refreshFileSystem());
        after(async () => cleanCache());

        test('move existing directory to a new destination', async () => {
            const rootItem = await buildFileItem2(rootURI);

            // metadata file before move
            await assertMetadataInDisk(
                URI.join(rootURI, 'root', 'folder1'), 
                true,
                ['folder1_file1', 'folder1_file2', 'folder1_file3'],
            );

            // move under the root
            const folder1 = __getFileItemBy(rootItem, 'folder1');
            await sorter.moveDirectoryMetadata(folder1.uri, URI.join(rootURI, 'root', 'folder2', 'folder1')).unwrap();

            // new metadata file after move
            await assertMetadataInDisk(
                URI.join(rootURI, 'root', 'folder2', 'folder1'), true,
                ['folder1_file1', 'folder1_file2', 'folder1_file3'],
            );
            
            // old should not exist
            await assertMetadataInDisk(
                URI.join(rootURI, 'root', 'folder1'), false,
            );
        });
    });
});