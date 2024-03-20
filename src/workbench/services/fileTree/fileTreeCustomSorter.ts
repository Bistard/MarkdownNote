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
import { Comparator, CompareOrder } from "src/base/common/utilities/type";
import { IFileService } from "src/platform/files/common/fileService";
import { IFileItem, IFileTarget } from "src/workbench/services/fileTree/fileItem";
import { noop } from "src/base/common/performance";
import { assert } from "src/base/common/utilities/panic";

/**
 * Enumerates the types of modifications to the custom sort order of file tree 
 * items, including adding, removing, updating, or swapping positions.
 *
 * - `Add`: Indicates that an item is being added to the order.
 * - `Remove`: Indicates that an item is being removed from the order.
 * - `Update`: Indicates that an existing item's position is being updated in the order.
 * - `Swap`: Indicates that two items are swapping positions within the order.
 */
export const enum OrderChangeType {
    Add,
    Remove,
    Update,
    Swap,
    Move,
}

/**
 * An interface only for {@link FileTreeCustomSorter}
 */
export interface IFileTreeCustomSorter<TItem extends IFileItem<TItem>> extends IDisposable {

    /**
     * @description Compares two file tree items to determine their relative 
     * order. The comparison is based on a custom sort order defined in the 
     * metadata. If no custom order is specified, a default comparison function 
     * is used.
     * 
     * @param a The first file tree item to compare.
     * @param b The second file tree item to compare.
     * @returns A negative value if `a` should appear before `b`, 
     *          zero if their order is equivalent,
     *          or a positive value if `a` should appear after `b`.
     */
    compare(a: TItem, b: TItem): CompareOrder;

    /**
     * @description Modifies the metadata based on the specified change type, 
     * such as adding, removing, updating, or swapping items in the custom order.
     * 
     * @param type The type of change to apply to the order metadata.
     * @param item The file tree item that is subject to the change.
     * @param index1 For 'Add' and 'Update', this is the index where the item is 
     *               added or updated. For 'Remove', it's the index of the item 
     *               to remove, and it's optional. For 'Swap', it's the index of 
     *               the first item to be swapped.
     * @param index2 For 'Swap', this is the index of the second item to be 
     *               swapped with the first. Not used for other change types.
     * 
     * @panic when missing the provided index1 or index2.
     */
    updateMetadata(type: OrderChangeType.Add   , item: TItem, index1:  number                ): AsyncResult<void, FileOperationError | Error>;
    updateMetadata(type: OrderChangeType.Remove, item: TItem, index1?: number                ): AsyncResult<void, FileOperationError | Error>;
    updateMetadata(type: OrderChangeType.Update, item: TItem, index1:  number                ): AsyncResult<void, FileOperationError | Error>;
    updateMetadata(type: OrderChangeType.Swap  , item: TItem, index1:  number, index2: number): AsyncResult<void, FileOperationError | Error>;
    
    /**
     * @description Handles batch updates to the metadata based on the specified 
     * change type. This will apply all the changes to the metadata in memory 
     * first, then save to disk.
     * 
     * @note It is more efficient than updating each item individually, 
     *       especially for large batches.
     * @note It does not support type 'swap' since every swap operation will 
     *       mess up the input indice relationship. Due to simplicity, it is 
     *       banned.
     * @note 'items' and 'indice' must have the same length for 'Add' and 'Update'.
     * 
     * @param type The type of change to apply to the metadata.
     * @param items An array of file items to the batch change.
     * @param parent Only support for 'Remove', indicates the parent of children
     *               for removing.
     * @param indice For 'Add' and 'Update', this is the index where the item is 
     *               added or updated. For 'Remove', it's the index of the item 
     *               to remove.
     */

    /**
     * @description Applies batch updates to the metadata according to the 
     * specified change type. This will apply all the changes to the metadata in 
     * memory first, then save to disk.
     * 
     * @note This approach is more efficient than updating each item individually, 
     *       particularly for large batches.
     * @note It does not support type 'swap' since every swap operation will 
     *       mess up the input indice relationship. Due to simplicity, it is 
     *       banned.
     * @note For 'Add' and 'Update' operations, the 'items' and 'indice' arrays 
     *       must be of equal length.
     * 
     * @param type The type of change to apply to the metadata.
     * @param items For 'Add' and 'Update', an array of items involved in the 
     *              batch change.
     * @param parent For 'Remove' and 'Move' types, specifies the parent 
     *                  metadata from which items are removed or moved.
     * @param indice For 'Add' and 'Update', specifies the indices where items 
     *                  are added or updated.
     *               For 'Remove', specifies the indices of items to remove.
     *               For 'Move', specifies the current indices of items to move.
     * @param destination Only for 'Move' type, specifies the new index within 
     *              the parent metadata where the items should be moved to. 
     *              Items retain their original order during the move.
     */
    updateMetadataLot(type: OrderChangeType.Add   , items: TItem[], indice:  number[]): AsyncResult<void, FileOperationError | Error>;
    updateMetadataLot(type: OrderChangeType.Update, items: TItem[], indice:  number[]): AsyncResult<void, FileOperationError | Error>;
    updateMetadataLot(type: OrderChangeType.Remove, parent: TItem , indice:  number[]): AsyncResult<void, FileOperationError | Error>;
    updateMetadataLot(type: OrderChangeType.Move,   parent: TItem , indice:  number[], destination: number): AsyncResult<void, FileOperationError | Error>;

    /**
     * @description When moving or copying a directory, its corresponding 
     * metadata file must also be updated.
     * @param oldDirUri The directory has changed.
     * @param destination The new destination of the directory.
     * @param cutOrCopy True means cut, false means copy.
     * 
     * @note If oldDirUri has no metadata file before, no operations is taken.
     */
    updateDirectoryMetadata(oldDirUri: URI, destination: URI, cutOrCopy: boolean): AsyncResult<void, Error | FileOperationError>;

    /**
     * @description Synchronizes the metadata in the cache for a given folder 
     * with the current state of its files on disk. 
     * @param folderUri The folder whose metadata needs to be synchronized with 
     *                  its disk state.
     * @param folderChildren The children metadata for update.
     * 
     * @note This method aligns the metadata's custom sort order with the 
     *       current file arrangement on disk.
     * @note Invoke this only when the folder's metadata is not yet loaded into 
     *       memory.
     */
    syncMetadataInCacheWithDisk(folderUri: URI, folderChildren: IFileTarget[]): AsyncResult<void, FileOperationError | Error>;
}

export interface IFileTreeCustomSorterOptions {
    readonly metadataRootPath: URI;
    readonly hash: (input: string) => string;
    readonly defaultItemComparator: Comparator<IFileTarget>;
}

/**
 * @internal
 */
const enum Resources {
    Scheduler,
    Order
}

export class FileTreeCustomSorter<TItem extends IFileItem<TItem>> extends Disposable implements IFileTreeCustomSorter<TItem> {
    
    // [fields]

    /**
     * The root path for all metadata directories.
     */
    private readonly _metadataRootPath: URI;
    private readonly _metadataCache: ResourceMap<[
        clearTimeout: UnbufferedScheduler<URI>, // [1]
        orders: string[],                       // [2]
    ]>;
    private readonly _cacheClearDelay: Time;
    private readonly _hash: (input: string) => string;
    private readonly _defaultItemComparator: Comparator<IFileTarget>;

    // [constructor]

    constructor(
        opts: IFileTreeCustomSorterOptions,
        @IFileService private readonly fileService: IFileService,
        @ILogService private readonly logService: ILogService,
    ) {
        super();
        this._metadataRootPath = opts.metadataRootPath;
        this._metadataCache = new ResourceMap();
        this._cacheClearDelay = Time.min(5);
        this._hash = opts.hash;
        this._defaultItemComparator = opts.defaultItemComparator;
    }
    
    // [public methods]

    public compare(a: TItem, b: TItem): CompareOrder {
        const parent = a.parent!;

        const order = this.__getMetadataFromCache(parent.uri);
        if (order === undefined) {
            return this._defaultItemComparator(a, b);
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
            return this._defaultItemComparator(a, b);
        }
    }

    public updateMetadata(type: OrderChangeType.Add   , item: TItem, index1:  number                 ): AsyncResult<void, FileOperationError | Error>;
    public updateMetadata(type: OrderChangeType.Remove, item: TItem, index1?: number                 ): AsyncResult<void, FileOperationError | Error>;
    public updateMetadata(type: OrderChangeType.Update, item: TItem, index1:  number                 ): AsyncResult<void, FileOperationError | Error>;
    public updateMetadata(type: OrderChangeType.Swap  , item: TItem, index1:  number, index2:  number): AsyncResult<void, FileOperationError | Error>;
    public updateMetadata(type: OrderChangeType       , item: TItem, index1?: number, index2?: number): AsyncResult<void, FileOperationError | Error> {
        const parent = assert(item.parent);
        const inCache = this._metadataCache.has(parent.uri);
        
        const preparation = inCache 
            ? AsyncResult.ok<void, FileOperationError>()
            : this.__loadMetadataIntoCache(parent.uri, parent.children);

        return preparation
        .andThen(() => {
            this.__updateMetadataInCache(type, parent.uri, item.name, index1, index2);
            return this.__saveMetadataIntoDisk(parent.uri);
        });
    }

    // TODO: refactor 'Add' to support 'parent: URI' instead of require 'TItem'
    public updateMetadataLot(type: OrderChangeType.Add   , items: TItem[]  , indice: number[]): AsyncResult<void, FileOperationError | Error>;
    public updateMetadataLot(type: OrderChangeType.Update, items: TItem[]  , indice: number[]): AsyncResult<void, FileOperationError | Error>;
    public updateMetadataLot(type: OrderChangeType.Remove, parent: TItem   , indice: number[]): AsyncResult<void, FileOperationError | Error>;
    public updateMetadataLot(type: OrderChangeType.Move,   parent: TItem   , indice: number[], destination: number): AsyncResult<void, FileOperationError | Error>;
    public updateMetadataLot(type: OrderChangeType,      itemsOrParent: any, indice: number[], destination?: number): AsyncResult<void, FileOperationError | Error> {
        if (type === OrderChangeType.Swap) {
            return AsyncResult.err(new Error('[FileTreeCustomSorter] does not support "swap" operation in "updateMetadataLot"'));
        }
        
        let resolvedParent: TItem;
        let resolvedItems : TItem[];

        // remove & move
        if (type === OrderChangeType.Remove || type === OrderChangeType.Move) {
            resolvedParent = itemsOrParent;
            resolvedItems = [];
        } 
        // add & update
        else {
            const items    = itemsOrParent as TItem[];
            resolvedParent = assert(items[0]!.parent);
            resolvedItems  = items;

            if (items.length === 0) {
                return AsyncResult.ok();
            }
    
            if (items.length !== indice.length) {
                return AsyncResult.err(new Error('[FileTreeCustomSorter] "updateMetadataLot" items and indice must have same length'));
            }
    
            // make sure every item all have the same parent
            const allSameParent = items.every(item => item.parent === resolvedParent);
            if (!allSameParent) {
                return AsyncResult.err(new Error('[FileTreeCustomSorter] "updateMetadataLot" items must have all the same parent'));
            }
        }

        // load metadata to the cache first
        const inCache = this._metadataCache.has(resolvedParent.uri);
        const preparation = inCache 
            ? AsyncResult.ok<void, FileOperationError>()
            : this.__loadMetadataIntoCache(resolvedParent.uri, resolvedParent.children);
        
        return preparation
        .andThen(() => {
            // update metadata all in once
            this.__updateMetadataInCacheLot(type, resolvedParent.uri, resolvedItems.map(item => item.name), indice, destination);
            return this.__saveMetadataIntoDisk(resolvedParent.uri);
        });
    }

    public updateDirectoryMetadata(oldDirUri: URI, destination: URI, cutOrCopy: boolean): AsyncResult<void, Error | FileOperationError> {
        const oldMetadataURI = this.__computeMetadataURI(oldDirUri);
        
        return this.fileService.exist(oldMetadataURI)
            .andThen(exist => {
                if (!exist) {
                    return ok();
                }
                
                const newMetadataURI = this.__computeMetadataURI(destination);
                const operation = cutOrCopy 
                    ? this.fileService.moveTo 
                    : this.fileService.copyTo;
                return operation.call(this.fileService, oldMetadataURI, newMetadataURI, false).map(noop);
            });
    }

    public syncMetadataInCacheWithDisk(folderUri: URI, folderChildren: IFileTarget[]): AsyncResult<void, FileOperationError | Error> {
        const inCache = this._metadataCache.get(folderUri);
        if (inCache) {
            return AsyncResult.ok();
        }
        
        return this.__loadMetadataIntoCache(folderUri, folderChildren)
        .andThen(() => {
            const parentUri    = folderUri;
            const currentFiles = folderChildren.map(child => child.name);
            
            const resource      = assert(this._metadataCache.get(parentUri));
            const existingOrder = resource[Resources.Order];

            // faster lookups
            const inCacheItems = new Set(existingOrder);
            const inDiskItems  = new Set(currentFiles);
            
            const updatedSortOrder: string[] = [];
            let hasChanges = false;

            // Keep items from the cache if they exist on disk
            for (const item of existingOrder) {
                if (inDiskItems.has(item)) {
                    updatedSortOrder.push(item);
                    continue;
                } 
                // found an item in cache that's not on disk
                hasChanges = true; 
            }

            // Add new items from disk that are not in cache
            for (const item of currentFiles) {
                if (!inCacheItems.has(item)) {
                    updatedSortOrder.push(item);
                    // found a new item on disk that is not in cache
                    hasChanges = true;
                }
            }

            // Update the cache only if there are changes
            if (!hasChanges) {
                return AsyncResult.ok();
            }

            resource[Resources.Order] = updatedSortOrder;
            resource[Resources.Scheduler].schedule(parentUri);

            return this.__saveMetadataIntoDisk(folderUri);
        });
    }
    
    // [private helper methods]

    private __getMetadataFromCache(uri: URI): string[] | undefined {
        const resource = this._metadataCache.get(uri);
        if (resource === undefined) {
            return undefined;
        }

        // TODO: perf - use recentAccess instead of simply schedule out, setTimeout is really time consuming
        // TODO: or simply universally check every 5min, clean all the metadata that has not been accessed during the 5min.
        resource[Resources.Scheduler].schedule(uri);
        return resource[Resources.Order];
    }

    /**
     * @description Check if the given folder has corresponding metadata file.
     * @param folderUri The folder to load.
     * @param folderChildren The initial children if need to create a new metadata.
     * @returns A URI points to either the existing file or the newly created one.
     */
    private __findOrCreateMetadataFile(folderUri: URI, folderChildren: IFileTarget[]): AsyncResult<URI, FileOperationError | SyntaxError> {
        const metadataURI = this.__computeMetadataURI(folderUri);

        return this.fileService.exist(metadataURI)
        .andThen(existed => {

            // order file founded, we do nothing.
            if (existed) {
                return ok(metadataURI);
            }

            // the order file does not exist, we need to create a new one.
            const defaultOrder = folderChildren
                .sort(this._defaultItemComparator)
                .map(target => target.name);
            
            // write to disk with the default order
            return jsonSafeStringify(defaultOrder, undefined, 4)
            .toAsync()
            .andThen(parsed => this.fileService.createFile(metadataURI, DataBuffer.fromString(parsed))
                .map(() => metadataURI));
        });
    }

    /**
     * @description Only invoke this function when the corresponding folder has
     * no cache in the memory.
     * @param folderUri The folder to load.
     * @param folderChildren The initial children if need to create a new metadata.
     */
    private __loadMetadataIntoCache(folderUri: URI, folderChildren: IFileTarget[]): AsyncResult<void, FileOperationError | Error> {
        
        return this.__findOrCreateMetadataFile(folderUri, folderChildren)
            .andThen(orderFileURI => this.fileService.readFile(orderFileURI))
            .andThen(buffer => jsonSafeParse<string[]>(buffer.toString()))
            .andThen(order => {
                const scheduler = this.__register(new UnbufferedScheduler<URI>(
                    this._cacheClearDelay, 
                    () => this._metadataCache.delete(folderUri),
                ));
                this._metadataCache.set(folderUri, [scheduler, order]);
                scheduler.schedule(folderUri);
                return ok();
            });
    }

    /**
     * @note MAKE SURE the metadata of the given folder is already in cache.
     */
    private __saveMetadataIntoDisk(folder: URI): AsyncResult<void, FileOperationError | Error> {        
        const metadataURI = this.__computeMetadataURI(folder);
        const metadata = assert(this.__getMetadataFromCache(folder));
        
        return jsonSafeStringify(metadata, undefined, 4).toAsync()
            .andThen(stringify => this.fileService.writeFile(metadataURI, DataBuffer.fromString(stringify), { create: true, overwrite: true, }));
    }

    /**
     * @note invoke this to MAKE SURE:
     *  - the given item has parent.
     *  - the metadata of the parent already in the cache.
     */
    private __updateMetadataInCache(type: OrderChangeType, parentUri: URI, itemName: string, index1?: number, index2?: number): void {
        const order = assert(this.__getMetadataFromCache(parentUri));
        switch (type) {
            case OrderChangeType.Add:
                order.splice(index1!, 0, itemName);
                break;
            case OrderChangeType.Remove:
                Arrays.remove(order, itemName, index1);
                break;
            case OrderChangeType.Swap:
                Arrays.swap(order, index1!, index2!);
                break;
            case OrderChangeType.Update:
                order[index1!] = itemName;
                break;
        }
    }

    /**
     * @note invoke this to MAKE SURE:
     *  - the given item array is not empty.
     *  - the metadata of the parent already in the cache.
     */
    private __updateMetadataInCacheLot(type: OrderChangeType, parent: URI, itemNames: string[], index1: number[], index2?: number): void {
        const order = assert(this.__getMetadataFromCache(parent));
        switch (type) {
            case OrderChangeType.Add:
                Arrays.insertMultiple(order, itemNames, index1);
                break;
            case OrderChangeType.Update:
                Arrays.parallelEach([itemNames, index1], (name, index) => {
                    order[index] = name;
                });
                break;
            case OrderChangeType.Remove:
                Arrays.removeByIndex(order, index1, true);
                break;
            case OrderChangeType.Move:
                Arrays.relocateByIndex(order, index1, index2!);
                break;
        }
    }

    /**
     * @description Computes and returns the metadata URI for a given resource URI by 
     * generating a hash from the resource URI and using it to construct a 
     * structured file path within the metadata directory.
     * 
     * @example
     * Assuming:
     *      - `_metadataRootPath` is '/metadata' 
     *      - and the uri is 'https://example.com/path'
     * The resulting metadata URI might be '/metadata/3f/4c9b6f3a.json', if 
     * assuming the hash is '3f4c9b6f3a'.
     */
    private __computeMetadataURI(uri: URI): URI {
        const hashCode = this._hash(URI.toString(uri));
        const orderFileName = hashCode.slice(2) + '.json';
        const metadataURI = URI.join(this._metadataRootPath, hashCode.slice(0, 2), orderFileName);
        return metadataURI;
    }
}