import { Disposable } from "src/base/common/dispose";
import { join } from "src/base/common/files/path";
import { URI } from "src/base/common/files/uri";
import { ILogService } from "src/base/common/logger";
import { IFileService } from "src/platform/files/common/fileService";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { IEnvironmentService, IMainEnvironmentService } from "src/platform/environment/common/environment";
import { DiskStorage } from "src/platform/files/common/diskStorage";
import { IMainLifecycleService } from "src/platform/lifecycle/electron/mainLifecycleService";
import { StatusKey } from "src/platform/status/common/status";
import { APP_DIR_NAME } from "src/platform/configuration/common/configuration";
import { FileOperationError } from "src/base/common/files/file";
import { AsyncResult, ok } from "src/base/common/result";
import { Dictionary } from "src/base/common/utilities/type";

export const IMainStatusService = createService<IMainStatusService>('status-service');

/**
 * An interface only for {@link MainStatusService}. The API are mainly just a
 * wrapper of a {@link DiskStorage}. You may check the more detailed 
 * document from there.
 */
export interface IMainStatusService extends Disposable, IService {
    set<T>(key: StatusKey, val: T): AsyncResult<void, FileOperationError>;
    setLot<T>(items: readonly { key: StatusKey, val: T; }[]): AsyncResult<void, FileOperationError>;
    get<T>(key: StatusKey, defaultVal?: T): T | undefined;
    getLot<T>(keys: StatusKey[], defaultVal?: T[]): (T | undefined)[];
    delete(key: StatusKey): AsyncResult<boolean, FileOperationError>;
    has(key: StatusKey): boolean;
    init(): AsyncResult<void, FileOperationError>;
    close(): AsyncResult<void, FileOperationError>;
    getAllStatus(): Dictionary<string, any>;
}

/**
 * @class The service stores and saves the user-specific and window-status
 * related data into the disk. 
 * 
 * Invoking set / setLot / delete will automatically save the data into 
 * the disk and the process is asynchronous.
 * 
 * Code implementation mainly is just a wrapper of a {@link IDiskStorage}.
 * 
 * When setting value with `null`, it will be replace with undefined for
 * simplicity.
 * 
 * You may await for the set / setLot / delete to ensure that the saving
 * operation has finished (if sync is on).
 * 
 * @note Service will be initialized at the very beginning of the program.
 * You may assume the service is initialized properly and invoke `init()`
 * only if you need to re-initialize.
 */
export class MainStatusService extends Disposable implements IMainStatusService {

    declare _serviceMarker: undefined;

    // [field]

    public static readonly FILE_NAME = 'status.nota.json';
    private _storage: DiskStorage;

    // [constructor]

    constructor(
        @IFileService private readonly fileService: IFileService,
        @ILogService private readonly logService: ILogService,
        @IEnvironmentService private readonly environmentService: IMainEnvironmentService,
        @IMainLifecycleService private readonly lifecycleService: IMainLifecycleService,
    ) {
        super();
        const path = URI.fromFile(join(URI.toFsPath(this.environmentService.userDataPath), APP_DIR_NAME, MainStatusService.FILE_NAME));
        this._storage = new DiskStorage(path, this.fileService);
        this.__registerListeners();
        this.logService.debug('MainStatusService', 'MainStatusService constructed.');
    }

    // [public methods]

    public set<T>(key: StatusKey, val: T): AsyncResult<void, FileOperationError> {
        return this._storage.set(key, val);
    }

    public setLot<T>(items: readonly { key: StatusKey, val: T; }[]): AsyncResult<void, FileOperationError> {
        return this._storage.setLot(items);
    }

    public get<T>(key: StatusKey, defaultVal?: T): T | undefined {
        return this._storage.get(key, defaultVal);
    }

    public getLot<T>(keys: StatusKey[], defaultVal?: T[]): (T | undefined)[] {
        return this._storage.getLot(keys, defaultVal);
    }

    public delete(key: StatusKey): AsyncResult<boolean, FileOperationError> {
        return this._storage.delete(key);
    }

    public has(key: StatusKey): boolean {
        return this._storage.has(key);
    }

    public init(): AsyncResult<void, FileOperationError> {
        this.logService.debug('MainStatusService', `initializing at '${URI.toString(this._storage.resource)}'...`);

        return this._storage.init()
        .andThen(() => { 
            this.logService.debug('MainStatusService', `initialized.`);
            return ok();
        });
    }

    public close(): AsyncResult<void, FileOperationError> {
        return this._storage.close();
    }

    public getAllStatus(): Dictionary<string, any> {
        return this._storage.getStorage();
    }

    private __registerListeners(): void {
        this.__register(this.lifecycleService.onWillQuit((e) => e.join(this.close())));
    }
}