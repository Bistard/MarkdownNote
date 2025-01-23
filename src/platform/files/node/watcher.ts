import * as fs from 'fs';
import * as chokidar from 'chokidar';
import { Emitter } from 'src/base/common/event';
import { URI } from 'src/base/common/files/uri';
import { ILogService } from 'src/base/common/logger';
import { EventBlocker, ThrottleDebouncer } from 'src/base/common/utilities/async';
import { Mutable } from 'src/base/common/utilities/type';
import { IS_LINUX } from 'src/base/common/platform';
import { isParentOf } from 'src/base/common/files/glob';
import { Disposable, IDisposable, toDisposable } from 'src/base/common/dispose';
import { IRawResourceChangeEvent, IRawResourceChangeEvents, IWatcher, IWatchInstance, IWatchRequest, ResourceChangeType } from 'src/platform/files/common/watcher';
import { ResourceChangeEvent } from 'src/platform/files/common/resourceChangeEvent';
import { Time } from 'src/base/common/date';
import { noop } from 'src/base/common/performance';
import { panic } from "src/base/common/utilities/panic";

/**
 * @class A `Watcher` can watch on resources on the disk filesystem. Check more
 * documents from {@link WatchInstance}. Once the watcher is closed it will not
 * work anymore.
 */
export class Watcher extends Disposable implements IWatcher {

    // [event]

    private readonly _onDidChange = this.__register(new Emitter<IRawResourceChangeEvents>());
    public readonly onDidChange = this._onDidChange.registerListener;

    private readonly _onDidClose = this.__register(new Emitter<URI>());
    public readonly onDidClose = this._onDidClose.registerListener;

    // [field]

    private readonly _instances = new Map<URI, WatchInstance>();

    // [constructor]

    constructor(private readonly logService?: ILogService) {
        super();
    }

    // [public methods]

    public watch(request: IWatchRequest): Promise<IDisposable> {

        const exist = this._instances.get(request.resource);
        if (exist) {
            console.warn(`there is already a watcher on '${URI.toString(request.resource)}'.`);
            return Promise.resolve(Disposable.NONE);
        }

        const instance = this.__register(new WatchInstance(this.logService, request, e => this._onDidChange.fire(e)));
        instance.watch();

        this._instances.set(request.resource, instance);
        
        
        const blocker = new EventBlocker<void>(instance.onReady, Time.sec(1));
        const cancel = toDisposable(() => {
            instance.close().then((uri) => { 
                if (uri) {
                    this._onDidClose.fire(uri);
                }
                this.release(instance);
            });
            this._instances.delete(request.resource);
        });

        return blocker.waiting().then(() => cancel);
    }

    public async close(): Promise<any> {
        const closePromises: Promise<void>[] = [];

        for (const watcher of this._instances.values()) {
            closePromises.push(watcher.close().then((uri) => { if (uri) this._onDidClose.fire(uri); }));
        }
        this._instances.clear();

        return Promise.allSettled(closePromises);
    }

    public override dispose(): void {
        super.dispose();
        this.close();
    }
}


/**
 * @class A `WatchInstance` starts to watch the request on the given filesystem
 * path once constructed. It is build upon the third library chokidar and does
 * some extra things:
 *      - When captures DELETED events on the watching resource, it coalesces
 *        events and only fires the single DELETED event of its root directory.
 *        This ensures that we are not producing DELETED events for each file 
 *        inside a directory that gets deleted.
 *      - If a resource is re-added within {@link WatchInstance.FILE_CHANGE_DELAY} 
 *        ms of being deleted, the watcher emits a single UPDATED event rather 
 *        than two events on DELETED and ADDED.
 * 
 * See more info about chokidar from https://github.com/paulmillr/chokidar
 */
export class WatchInstance extends Disposable implements IWatchInstance {

    // [field]

    /**
     * A throttle delaying time for collecting the file change events.
     * @note milliseconds
     */
    public static readonly FILE_CHANGE_DELAY = Time.ms(50);
    private readonly _changeDebouncer = this.__register(new ThrottleDebouncer<void>(WatchInstance.FILE_CHANGE_DELAY));

    private _eventBuffer: IRawResourceChangeEvent[] = [];
    private _anyDirectory = false;
    private _anyFiles = false;
    private _anyAdded = false;
    private _anyUpdated = false;
    private _anyDeleted = false;

    private _watcher?: chokidar.FSWatcher;

    private readonly _request: IWatchRequest;
    private readonly _onDidChange: (event: IRawResourceChangeEvents) => void;
    
    private readonly _onReady = this.__register(new Emitter<void>());
    public readonly onReady = this._onReady.registerListener;


    // [constructor]

    constructor(
        private readonly logService: ILogService | undefined,
        request: IWatchRequest,
        onDidChange: (event: IRawResourceChangeEvents) => void,
    ) {
        super();
        this._request = request;
        (<Mutable<RegExp[]>>this._request.exclude) = this._request.exclude ?? [];
        this._onDidChange = onDidChange;
    }

    // [public methods]

    get request(): IWatchRequest {
        return this._request;
    }

    public async close(): Promise<URI | undefined> {
        if (!this._watcher) {
            return;
        }

        this.release(this._changeDebouncer);
        await this._watcher.close();
        this._watcher = undefined;

        return this._request.resource;
    }

    public watch(): void {
        const resource = URI.toFsPath(this._request.resource);
        try {
            this._watcher = this.__watch(resource);
        }
        catch (error: any) {
            this.logService?.error(`Error encounters on watching the resource '${resource}'`, error);
            panic(error);
        }
    }

    public override dispose(): void {
        this.close();
        super.dispose();
    }

    // [private helper methods]

    private __watch(resource: string): chokidar.FSWatcher {

        /**
         * The `fs.watch` is not 100% consistent across platforms and will not
         * work in some cases. Moreover, the `fs.watch` also has other kinds
         * of flaws when using. This is where Chokidar comes in which I believe
         * is more reliable and API friendly.
         * 
         * @see https://nodejs.org/api/fs.html#filename-argument
         * @see https://github.com/paulmillr/chokidar
         */
        const watcher = chokidar.watch(resource, {
            alwaysStat: true,
            atomic: WatchInstance.FILE_CHANGE_DELAY.toMs().time,
            ignored: this._request.exclude,
            ignorePermissionErrors: false,
            ignoreInitial: true,
            depth: this._request.recursive ? undefined : 0,
            usePolling: true, // issue: https://github.com/Bistard/nota/issues/149
        });

        watcher
        .on('add', (path: string, stat?: fs.Stats) => {
            this.__onEventFire({ type: ResourceChangeType.ADDED, resource: path, isDirectory: stat?.isDirectory() });
        })
        .on('unlink', (path: string, stat?: fs.Stats) => {
            this.__onEventFire({ type: ResourceChangeType.DELETED, resource: path, isDirectory: stat?.isDirectory() });
        })
        .on('addDir', (path: string, stat?: fs.Stats) => {
            this.__onEventFire({ type: ResourceChangeType.ADDED, resource: path, isDirectory: stat?.isDirectory() });
        })
        .on('unlinkDir', (path: string, stat?: fs.Stats) => {
            this.__onEventFire({ type: ResourceChangeType.DELETED, resource: path, isDirectory: stat?.isDirectory() });
        })
        .on('change', (path: string, stat?: fs.Stats) => {
            this.__onEventFire({ type: ResourceChangeType.UPDATED, resource: path, isDirectory: stat?.isDirectory() });
        })
        .on('error', (error: Error) => {
            panic(error);
        })
        .on('ready', () => {
            this._onReady.fire();
            this.logService?.debug('WatchInstance', `filesystem watcher is ready at: ${resource}`);
        });

        return watcher;
    }

    private __onEventFire(event: Mutable<IRawResourceChangeEvent>): void {
        /**
         * fix: A node.js watcher will produce the raw path which schema will be 
         * the disk name (C:/, D:/, etc), we need to convert it to the correct 
         * schema (file://).
         */
        event.resource = URI.toString(URI.fromFile(event.resource));

        this._eventBuffer.push(event);

        // update metadata for each fired event
        if (event.isDirectory) {
            this._anyDirectory = true;
        } else if (event.isDirectory === false) {
            this._anyFiles = true;
        }

        if (event.type === ResourceChangeType.ADDED) {
            this._anyAdded = true;
        } else if (event.type === ResourceChangeType.DELETED) {
            this._anyDeleted = true;
        } else {
            this._anyUpdated = true;
        }

        this._changeDebouncer.queue(async () => {
            const rawChanges = this._eventBuffer;

            const coalescer = new FileChangeEventCoalescer();
            for (const change of rawChanges) {
                coalescer.push(change);
            }

            const changes = coalescer.coalesce();
            if (changes.length) {
                this._onDidChange(createRawResourceChangeEvents(changes, this._anyAdded, this._anyDeleted, this._anyUpdated, this._anyDirectory, this._anyFiles));
                this.__clearMetadata();
            }
        })
            .catch(noop); /** ignores error from the debouncer when closing */
    }

    private __clearMetadata(): void {
        this._eventBuffer = [];
        this._anyDirectory = false;
        this._anyFiles = false;
        this._anyAdded = false;
        this._anyUpdated = false;
        this._anyDeleted = false;
    }
}

export function createRawResourceChangeEvents(changes: IRawResourceChangeEvent[], anyAdded: boolean, anyDeleted: boolean, anyUpdated: boolean, anyDirectory: boolean, anyFile: boolean): IRawResourceChangeEvents {
    return {
        wrap: function (ignoreCase?: boolean) { return new ResourceChangeEvent(this, ignoreCase); },
        events: changes,
        anyAdded: anyAdded,
        anyDeleted: anyDeleted,
        anyUpdated: anyUpdated,
        anyDirectory: anyDirectory,
        anyFile: anyFile,
    };
}

/**
 * @internal
 * @class Provides algorithm to remove all the DELETE events up to the root 
 * directory that got deleted if any. This ensures that we are not producing 
 * DELETE events for each file inside a directory that gets deleted.
 */
class FileChangeEventCoalescer {

    // [field]

    private readonly coalesced = new Set<IRawResourceChangeEvent>();
    private readonly mapPathToChange = new Map<string, Mutable<IRawResourceChangeEvent>>();

    // [constructor]

    constructor() { /** noop */ }

    // [public methods]

    public push(event: IRawResourceChangeEvent): void {
        const existingEvent = this.mapPathToChange.get(this.__toKey(event));

        let keepEvent = false;

        // Event path already exists
        if (existingEvent) {
            const currentChangeType = existingEvent.type;
            const newChangeType = event.type;

            // macOS/Windows: track renames to different case
            // by keeping both CREATE and DELETE events
            if (existingEvent.resource !== event.resource && (event.type === ResourceChangeType.DELETED || event.type === ResourceChangeType.ADDED)) {
                keepEvent = true;
            }

            // Ignore CREATE followed by DELETE in one go
            else if (currentChangeType === ResourceChangeType.ADDED && newChangeType === ResourceChangeType.DELETED) {
                this.mapPathToChange.delete(this.__toKey(event));
                this.coalesced.delete(existingEvent);
            }

            // Flatten DELETE followed by CREATE into CHANGE
            else if (currentChangeType === ResourceChangeType.DELETED && newChangeType === ResourceChangeType.ADDED) {
                existingEvent.type = ResourceChangeType.UPDATED;
            }

            // Do nothing. Keep the created event
            else if (currentChangeType === ResourceChangeType.ADDED && newChangeType === ResourceChangeType.UPDATED) { }

            // Otherwise apply change type
            else {
                existingEvent.type = newChangeType;
            }
        }

        // Otherwise keep
        else {
            keepEvent = true;
        }

        if (keepEvent) {
            this.coalesced.add(event);
            this.mapPathToChange.set(this.__toKey(event), event);
        }
    }

    public coalesce(): IRawResourceChangeEvent[] {
        const addOrChangeEvents: IRawResourceChangeEvent[] = [];
        const deletedPaths: string[] = [];

        const result = Array.from(this.coalesced)
            // 1.) split ADD/CHANGE and DELETED events
            .filter(e => {
                if (e.type !== ResourceChangeType.DELETED) {
                    addOrChangeEvents.push(e);
                    return false; // remove ADD / CHANGE
                }
                return true; // keep DELETE
            })
            // 2.) sort short deleted paths to the top
            .sort((e1, e2) => {
                return e1.resource.length - e2.resource.length;
            })
            /**
             * 3.) for each DELETE, check if there is a deleted parent and ignore 
             * the event in that case.
             */
            .filter(e => {
                // DELETE is ignored if parent is deleted already
                if (deletedPaths.some(deletedPath => isParentOf(e.resource, deletedPath, !IS_LINUX))) {
                    return false;
                }
                // otherwise mark as deleted
                deletedPaths.push(e.resource);
                return true;
            })
            .concat(addOrChangeEvents);

        return result;
    }

    // [private helper methods]

    private __toKey(event: IRawResourceChangeEvent): string {
        if (IS_LINUX) {
            // linux is case sensitive
            return event.resource;
        } else {
            // mac and windows are case insensitive
            return event.resource.toLowerCase();
        }
    }
}
