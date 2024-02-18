import { Time } from "src/base/common/date";
import { Disposable, IDisposable } from "src/base/common/dispose";
import { AsyncResult, ok } from "src/base/common/result";
import { DataBuffer } from "src/base/common/files/buffer";
import { FileOperationError } from "src/base/common/files/file";
import { URI } from "src/base/common/files/uri";
import { jsonSafeStringify, jsonSafeParse } from "src/base/common/json";
import { ILogService } from "src/base/common/logger";
import { ResourceMap } from "src/base/common/structures/map";
import { Arrays } from "src/base/common/utilities/array";
import { UnbufferedScheduler } from "src/base/common/utilities/async";
import { generateMD5Hash } from "src/base/common/utilities/hash";
import { CompareOrder } from "src/base/common/utilities/type";
import { IFileService } from "src/platform/files/common/fileService";
import { IFileItem, defaultFileItemCompareFn } from "src/workbench/services/fileTree/fileItem";

/**
 * @internal
 */
const enum Resources {
    Accessed,
    Scheduler,
    Order
}

export const enum OrderChangeType {
    Add,
    Remove,
    Update,
    Swap
}

/**
 * An interface only for {@link FileTreeCustomSorter}
 */
export interface IFileTreeCustomSorter<TItem extends IFileItem<TItem>> extends IDisposable {

    /**
     * @description Compares two file tree items based on a custom sort order or
     * the default comparison function if no custom order is defined.
     * @param a The first file tree item
     * @param b The second file tree item
     * @returns negative, 0, positive int if a is ahead, same place, after b 
     */
    compare(a: TItem, b: TItem): number;

    /**
     * @description // TODO
     */
    changeMetadataBy(changeType: OrderChangeType, item: TItem, index1: number, index2: number | undefined): AsyncResult<void, FileOperationError | SyntaxError>

    /**
     * @description // TODO
     */
    syncMetadataWithDiskState(folder: TItem, currentFiles: TItem[]): AsyncResult<void, FileOperationError | SyntaxError>;
}

export class FileTreeCustomSorter<TItem extends IFileItem<TItem>> extends Disposable implements IFileTreeCustomSorter<TItem> {
    
    // [fields]

    private readonly _metadataRootPath: URI;
    private readonly _metadataCache: ResourceMap<[
        accessedRecent: boolean,                // [0]
        clearTimeout: UnbufferedScheduler<URI>, // [1]
        orders: string[],                       // [2]
    ]>;
    private readonly _cacheClearDelay: Time;

    // [constructor]

    constructor(
        metadataRootPath: URI,
        @IFileService private readonly fileService: IFileService,
        @ILogService private readonly logService: ILogService,
    ) {
        super();
        this._metadataCache = new ResourceMap();
        this._cacheClearDelay = Time.min(5);
        this._metadataRootPath = metadataRootPath;
    }
    
    // [public methods]

    // The following TItem.parent are definitely not null, as those following
    // function can only be called when TItem.parent is at collaped state
    public compare(a: TItem, b: TItem): CompareOrder {
        const parent = a.parent!;

        const order = this.__getMetadataFromCache(parent.uri);
        if (order === undefined) {
            return defaultFileItemCompareFn(a, b);
        }

        const indexA = order.indexOf(a.name);
        const indexB = order.indexOf(b.name);

        // Both item are found in the order, we compare them easily.
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        } 
        // Item B order info is not found, we put B at the end by default.
        else if (indexA !== -1) {
            this.logService.warn('FileTreeCustomSorter', 'ItemA is missing in custom order file');
            return CompareOrder.First;
        } 
        // Item A order info is not found, we put A at the end by default.
        else if (indexB !== -1) {
            this.logService.warn('FileTreeCustomSorter', 'ItemB is missing in custom order file');
            return CompareOrder.Second;
        } 
        // Both items are not found, item A and B will be sort as default.
        else {
            return defaultFileItemCompareFn(a, b);
        }
    }

    // item.parent is gurrented not undefined
    public changeMetadataBy(changeType: OrderChangeType, item: TItem, index1: number, index2: number | undefined): AsyncResult<void, FileOperationError | SyntaxError> {
        const parent = item.parent!;
        
        const order = this._metadataCache.has(parent.uri);
        if (order === true) {
            this.__changeOrderBasedOnType(changeType, item, index1, index2);
            return this.__saveSortOrder(parent);
        }

        return this.__loadOrderIntoCache(parent)
        .andThen(() => {
            this.__changeOrderBasedOnType(changeType, item, index1, index2);
            return this.__saveSortOrder(parent);
        });
    }

    // TODO: compare the given array with the exsiting order array
    // Updates custom sort order items based on provided array of new items
    public syncMetadataWithDiskState(folder: TItem, currentFiles: TItem[]): AsyncResult<void, FileOperationError | SyntaxError> {
        return this.__loadOrderIntoCache(folder) // FIX: `new UnbufferedScheduler` already constructed here
        .andThen(() => {
            const parentUri = folder.uri;
            const resource = this._metadataCache.get(parentUri);
            
            // Use an empty array if the resource is undefined
            const existingOrder = resource ? resource[Resources.Order] : [];
            const inCacheItems = new Set(existingOrder);
            const inDiskItems = new Set(currentFiles.map(item => item.name));

            // Update the sort order
            // TODO: perf - too many array iteration here, should be able to optimize.
            // TODO: bad readability
            const updatedSortOrder = existingOrder.filter(item => inDiskItems.has(item))
                .concat(currentFiles.filter(item => !inCacheItems.has(item.name)).map(item => item.name));

            // FIX: duplicate creating `new UnbufferedScheduler`
            const scheduler = resource?.[Resources.Scheduler] ?? new UnbufferedScheduler<URI>(this._cacheClearDelay, 
                () => {
                    const res = this._metadataCache.get(parentUri);
                    if (res && res[Resources.Accessed] === true) {
                        scheduler.schedule(parentUri);
                        res[Resources.Accessed] = false;
                    } else {
                        this._metadataCache.delete(parentUri);
                    }
                },
            );
            this._metadataCache.set(parentUri, [false, scheduler, updatedSortOrder]);
            scheduler.schedule(parentUri);

            return this.__saveSortOrder(folder);
        });
    }   
    
    // [private helper methods]

    private __getMetadataFromCache(uri: URI): string[] | undefined {
        const resource = this._metadataCache.get(uri);
        if (resource === undefined) {
            return undefined;
        }

        resource[Resources.Accessed] = true;
        return resource[Resources.Order];
    }

    // fileItem's order file will be stored in userDataPath
    // Its order file's name is the md5hash of fileItem.uri path.
    private __findOrCreateMetadataFile(folder: TItem): AsyncResult<URI, FileOperationError | SyntaxError> {
        const hashCode = generateMD5Hash(URI.toString(folder.uri));
        const orderFileName = hashCode + ".json"; // TODO: the first two character should be sliced for better perf
        const orderFileURI = URI.join(this._metadataRootPath, hashCode.slice(0, 2), orderFileName);

        return this.fileService.exist(orderFileURI)
        .andThen(existed => {

            // order file founded, we do nothing.
            if (existed) {
                return ok(orderFileURI);
            }

            // the order file does not exist, we need to create a new one.
            return jsonSafeStringify(folder.children.map(item => item.name), undefined, 4)
            .toAsync()
            .andThen(parsed => this.fileService.createFile(orderFileURI, DataBuffer.fromString(parsed))
                .map(() => orderFileURI));
        });
    }

    private __loadOrderIntoCache(folder: TItem): AsyncResult<void, FileOperationError | SyntaxError> {
        // bug: what if the loading target is already in the memory? Why would I need to read again from the disk
        
        return this.__findOrCreateMetadataFile(folder)
        .andThen(orderFileURI => this.fileService.readFile(orderFileURI))
        .andThen(buffer => jsonSafeParse<string[]>(buffer.toString()))
        .andThen(order => {

            // FIX: duplicate creating `new UnbufferedScheduler`
            const scheduler = new UnbufferedScheduler<URI>(this._cacheClearDelay, 
                (() => {
                    const resource = this._metadataCache.get(folder.uri);
                    if (resource === undefined) {
                        return;
                    }
                    if (resource[Resources.Accessed] === true) {
                        resource[Resources.Accessed] = false;
                        scheduler.schedule(folder.uri);
                    } else {
                        this._metadataCache.delete(folder.uri);
                    }
                }));
            this._metadataCache.set(folder.uri, [false, scheduler, order]);
            scheduler.schedule(folder.uri);
            return ok();
        });
    }

    private __saveSortOrder(folder: TItem): AsyncResult<void, FileOperationError | SyntaxError> {
        // bug: what if the saving target is already in the memory? Why would I need to write again to the disk
        
        return this.__findOrCreateMetadataFile(folder)
        .andThen(orderFileURI => jsonSafeStringify(this.__getMetadataFromCache(folder.uri), undefined, 4) // TODO
            .toAsync()
            .andThen((stringify => this.fileService.writeFile(orderFileURI, DataBuffer.fromString(stringify), { create: false, overwrite: true, }))));
    }

    private __changeOrderBasedOnType(changeType: OrderChangeType, item: TItem, index1: number, index2: number | undefined): void {
        const order = this.__getMetadataFromCache(item.parent!.uri)!;
        switch (changeType) {
            case OrderChangeType.Add:
                order.splice(index1, 0, item.name);
                break;
            case OrderChangeType.Remove:
                order.splice(index1, 1);
                break;
            case OrderChangeType.Swap:
                if (index2 === undefined) {
                    return;
                }
                Arrays.swap(order, index1, index2);
                break;
            case OrderChangeType.Update:
                order[index1] = item.name;
                break;
        }
    }
}