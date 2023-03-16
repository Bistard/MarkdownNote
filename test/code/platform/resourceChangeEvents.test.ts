import * as assert from 'assert';
import { join } from 'src/base/common/file/path';
import { URI } from 'src/base/common/file/uri';
import { IS_WINDOWS } from 'src/base/common/platform';
import { ResourceChangeEvents } from 'src/code/platform/files/node/resourceChangeEvent';
import { IRawResourceChangeEvents, ResourceChangeType } from 'src/code/platform/files/node/watcher';

function toPath(this: Mocha.Suite, path: string): string {
	if (IS_WINDOWS) {
		return join('C:\\', this.fullTitle(), path);
	}
	return join('/', this.fullTitle(), path);
}

function toResource(this: Mocha.Suite, path: string): URI {
	if (IS_WINDOWS) {
		return URI.fromFile(join('C:\\', this.fullTitle(), path));
	}
	return URI.fromFile(join('/', this.fullTitle(), path));
}

suite.only('ResourceChangeEvents-test', function () {

    test('basic', () => {
        const changes: IRawResourceChangeEvents = {
            events: [
                { resource: toPath.call(this, '/foo/updated.txt'), type: ResourceChangeType.UPDATED },
                { resource: toPath.call(this, '/foo/otherupdated.txt'), type: ResourceChangeType.UPDATED },
                { resource: toPath.call(this, '/added.txt'), type: ResourceChangeType.ADDED },
                { resource: toPath.call(this, '/bar/deleted.txt'), type: ResourceChangeType.DELETED },
                { resource: toPath.call(this, '/bar/folder'), type: ResourceChangeType.DELETED },
                { resource: toPath.call(this, '/BAR/FOLDER'), type: ResourceChangeType.DELETED }
            ],
            anyAdded: true,
            anyDeleted: true,
            anyUpdated: true,
            anyDirectory: true,
            anyFile: true,
        };

        for (const ignorePathCasing of [false, true]) {
			const event = new ResourceChangeEvents(changes, ignorePathCasing);

			assert.ok(!event.match(toResource.call(this, '/foo'), [ResourceChangeType.UPDATED]));
			assert.ok(event.affect(toResource.call(this, '/foo'), [ResourceChangeType.UPDATED]));
			assert.ok(event.match(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.UPDATED]));
			assert.ok(event.affect(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.UPDATED]));
			assert.ok(event.match(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.UPDATED, ResourceChangeType.ADDED]));
			assert.ok(event.affect(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.UPDATED, ResourceChangeType.ADDED]));
			assert.ok(event.match(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.UPDATED, ResourceChangeType.ADDED, ResourceChangeType.DELETED]));
			assert.ok(!event.match(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.ADDED, ResourceChangeType.DELETED]));
			assert.ok(!event.match(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.ADDED]));
			assert.ok(!event.match(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.DELETED]));
			assert.ok(!event.affect(toResource.call(this, '/foo/updated.txt'), [ResourceChangeType.DELETED]));

			assert.ok(event.match(toResource.call(this, '/bar/folder'), [ResourceChangeType.DELETED]));
			assert.ok(event.match(toResource.call(this, '/BAR/FOLDER'), [ResourceChangeType.DELETED]));
			assert.ok(event.affect(toResource.call(this, '/BAR'), [ResourceChangeType.DELETED]));
			if (ignorePathCasing) {
				assert.ok(event.match(toResource.call(this, '/BAR/folder'), [ResourceChangeType.DELETED]));
				assert.ok(event.affect(toResource.call(this, '/bar'), [ResourceChangeType.DELETED]));
			} else {
				assert.ok(!event.match(toResource.call(this, '/BAR/folder'), [ResourceChangeType.DELETED]));
				assert.ok(event.affect(toResource.call(this, '/bar'), [ResourceChangeType.DELETED]));
			}
			assert.ok(event.match(toResource.call(this, '/bar/folder/somefile'), [ResourceChangeType.DELETED]));
			assert.ok(event.match(toResource.call(this, '/bar/folder/somefile/test.txt'), [ResourceChangeType.DELETED]));
			assert.ok(event.match(toResource.call(this, '/BAR/FOLDER/somefile/test.txt'), [ResourceChangeType.DELETED]));
			if (ignorePathCasing) {
				assert.ok(event.match(toResource.call(this, '/BAR/folder/somefile/test.txt'), [ResourceChangeType.DELETED]));
			} else {
				assert.ok(!event.match(toResource.call(this, '/BAR/folder/somefile/test.txt'), [ResourceChangeType.DELETED]));
			}
			assert.ok(!event.match(toResource.call(this, '/bar/folder2/somefile'), [ResourceChangeType.DELETED]));
		}
    });

});