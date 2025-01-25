import { beforeEach, suite, test } from 'mocha';
import * as assert from 'assert';
import { RecentOpenUtility, IRecentOpenedTarget } from 'src/platform/app/common/recentOpen';
import { FileType } from 'src/base/common/files/file';
import { URI } from 'src/base/common/files/uri';
import { IHostService } from 'src/platform/host/common/hostService';
import { StatusKey } from 'src/platform/status/common/status';
import { NullBrowserEnvironmentService, NullLogger } from 'test/utils/testService';
import { IRecentOpenService, RecentOpenService } from 'src/platform/app/browser/recentOpenService';
import { IRegistrantService, RegistrantService } from 'src/platform/registrant/common/registrantService';
import { MenuRegistrant } from 'src/platform/menu/browser/menuRegistrant';
import { ContextService } from 'src/platform/context/common/contextService';
import { InstantiationService } from 'src/platform/instantiation/common/instantiation';
import { MenuTypes } from 'src/platform/menu/common/menu';
import { createIntegration } from 'test/utils/integration';
import { RegistrantType } from 'src/platform/registrant/common/registrant';

suite('RecentOpenUtility', async () => {

    const di = await createIntegration({ hostService: true });
    const hostService = di.getOrCreateService(IHostService);

    beforeEach(() => {
        hostService.setApplicationStatus(StatusKey.OpenRecent, [
            '/path/to/file.txt|{"targetType":"file","pinned":true,"gotoLine":42}',
            '/path/to/directory|{"targetType":"directory","pinned":false}',
            '/path/to/file2.txt|{"targetType":"file","pinned":false,"gotoLine":24}',
            '/path/to/directory2|{"targetType":"directory","pinned":true}',
        ]);
    });

    test('getRecentOpened should return the most recent opened item', async () => {
        const result = await RecentOpenUtility.getRecentOpened(hostService);
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, true);
        assert.strictEqual(result?.gotoLine, 42);
    });

    test('getRecentOpenedDirectory should return the most recent opened directory', async () => {
        const result = await RecentOpenUtility.getRecentOpenedDirectory(hostService);
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/directory');
        assert.strictEqual(result?.targetType, FileType.DIRECTORY);
        assert.strictEqual(result?.pinned, false);
    });

    test('getRecentOpenedFile should return the most recent opened file', async () => {
        const result = await RecentOpenUtility.getRecentOpenedFile(hostService);
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, true);
        assert.strictEqual(result?.gotoLine, 42);
    });

    test('getRecentOpenedAll should return all recent opened items', async () => {
        const result = await RecentOpenUtility.getRecentOpenedAll(hostService);
        assert.strictEqual(result.length, 4);
        assert.strictEqual(result[0]!.targetType, FileType.FILE);
        assert.strictEqual(result[1]!.targetType, FileType.DIRECTORY);
        assert.strictEqual(result[2]!.targetType, FileType.FILE);
        assert.strictEqual(result[3]!.targetType, FileType.DIRECTORY);
    });

    test('addToRecentOpened should add a new item and maintain uniqueness', async () => {
        const newTarget: IRecentOpenedTarget = {
            target: URI.fromFile('/path/to/new-file.txt'),
            targetType: FileType.FILE,
            pinned: false,
            gotoLine: 10,
        };
        assert.strictEqual(await RecentOpenUtility.addToRecentOpened(hostService, newTarget), true);
        assert.strictEqual((await RecentOpenUtility.getRecentOpenedAll(hostService)).length, 5);
        
        const result = await RecentOpenUtility.getRecentOpenedFile(hostService);
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/new-file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, false);
        assert.strictEqual(result?.gotoLine, 10);
    });
    
    test('clearRecentOpened should clear the recent opened list', async () => {
        const result = await RecentOpenUtility.clearRecentOpened(hostService);
        assert.strictEqual(result, true);
        assert.strictEqual((await RecentOpenUtility.getRecentOpenedAll(hostService)).length, 0);
    });
    
    test('addToRecentOpened with invalid gotoLine', async () => {
        const newTarget: IRecentOpenedTarget = {
            target: URI.fromFile('/path/to/new-file.txt'),
            targetType: FileType.FILE,
            pinned: false,
            gotoLine: -10, // invalid
        };
        assert.strictEqual(await RecentOpenUtility.addToRecentOpened(hostService, newTarget), true);
        assert.strictEqual((await RecentOpenUtility.getRecentOpenedAll(hostService)).length, 5);
        
        const result = await RecentOpenUtility.getRecentOpenedFile(hostService);
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/new-file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, false);
        assert.strictEqual(result?.gotoLine, undefined); // `undefined`
    });
});

suite('RecentOpenService', async () => {

    
    let hostService!: IHostService;
    let recentOpenService!: IRecentOpenService;
    let menuRegistrant!: MenuRegistrant;

    beforeEach(async () => {
        const di = await createIntegration({ 
            hostService: true,
            registrantService: [RegistrantType.Menu],
            recentOpenService: true,
        });
        
        hostService = di.getOrCreateService(IHostService);
        hostService.setApplicationStatus(StatusKey.OpenRecent, [
            '/path/to/file.txt|{"targetType":"file","pinned":true,"gotoLine":42}',
            '/path/to/directory|{"targetType":"directory","pinned":false}',
            '/path/to/file2.txt|{"targetType":"file","pinned":false,"gotoLine":24}',
            '/path/to/directory2|{"targetType":"directory","pinned":true}',
        ]);
        menuRegistrant = di.getOrCreateService(IRegistrantService).getRegistrant(RegistrantType.Menu);
        recentOpenService = di.getOrCreateService(IRecentOpenService);
    });

    test('getRecentOpened should return the most recent opened item', async () => {
        const result = await recentOpenService.getRecentOpened();
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, true);
        assert.strictEqual(result?.gotoLine, 42);
    });

    test('getRecentOpenedDirectory should return the most recent opened directory', async () => {
        const result = await recentOpenService.getRecentOpenedDirectory();
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/directory');
        assert.strictEqual(result?.targetType, FileType.DIRECTORY);
        assert.strictEqual(result?.pinned, false);
    });

    test('getRecentOpenedFile should return the most recent opened file', async () => {
        const result = await recentOpenService.getRecentOpenedFile();
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, true);
        assert.strictEqual(result?.gotoLine, 42);
    });

    test('getRecentOpenedAll should return all recent opened items', async () => {
        const result = await recentOpenService.getRecentOpenedAll();
        assert.strictEqual(result.length, 4);
        assert.strictEqual(result[0]!.targetType, FileType.FILE);
        assert.strictEqual(result[1]!.targetType, FileType.DIRECTORY);
        assert.strictEqual(result[2]!.targetType, FileType.FILE);
        assert.strictEqual(result[3]!.targetType, FileType.DIRECTORY);
    });

    test('addToRecentOpened should add a new item and maintain menuRegistrant', async () => {
        const newTarget: IRecentOpenedTarget = {
            target: URI.fromFile('/path/to/new-file.txt'),
            targetType: FileType.FILE,
            pinned: false,
            gotoLine: 10,
        };
        assert.strictEqual(await recentOpenService.addToRecentOpened(newTarget), true);
        const allItems = await recentOpenService.getRecentOpenedAll();
        assert.strictEqual(allItems.length, 5);

        const result = await recentOpenService.getRecentOpenedFile();
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/new-file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, false);
        assert.strictEqual(result?.gotoLine, 10);
        
        validateMenuDynamicSize(5);
    });

    test('clearRecentOpened should clear the recent opened list', async () => {
        const result = await recentOpenService.clearRecentOpened();
        assert.strictEqual(result, true);
        const allItems = await recentOpenService.getRecentOpenedAll();
        assert.strictEqual(allItems.length, 0);
        validateMenuDynamicSize(0);
    });

    test('addToRecentOpened with invalid gotoLine', async () => {
        const newTarget: IRecentOpenedTarget = {
            target: URI.fromFile('/path/to/new-file.txt'),
            targetType: FileType.FILE,
            pinned: false,
            gotoLine: -10, // invalid
        };
        assert.strictEqual(await recentOpenService.addToRecentOpened(newTarget), true);
        const allItems = await recentOpenService.getRecentOpenedAll();
        assert.strictEqual(allItems.length, 5);

        const result = await recentOpenService.getRecentOpenedFile();
        assert.ok(result);
        assert.strictEqual(URI.toString(result.target), 'file:///path/to/new-file.txt');
        assert.strictEqual(result?.targetType, FileType.FILE);
        assert.strictEqual(result?.pinned, false);
        assert.strictEqual(result?.gotoLine, undefined); // `undefined`
        validateMenuDynamicSize(5);
    });

    function validateMenuDynamicSize(expectSize: number): void {
        const allMenuItems = menuRegistrant.getMenuitems(MenuTypes.FileRecentOpen);
        const dynamicPart = allMenuItems.filter(each => each.group === '2_recent_open');
        assert.strictEqual(dynamicPart.length, expectSize);
    }
});