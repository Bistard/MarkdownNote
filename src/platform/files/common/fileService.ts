import { Disposable, IDisposable } from "src/base/common/dispose";
import { AsyncResult, Result, err, ok } from "src/base/common/result";
import { Emitter, Event, Register } from "src/base/common/event";
import { DataBuffer } from "src/base/common/files/buffer";
import { FileSystemProviderAbleToRead, hasOpenReadWriteCloseCapability, hasReadWriteCapability, IReadFileOptions, IFileSystemProvider, IFileSystemProviderWithFileReadWrite, IFileSystemProviderWithOpenReadWriteClose, IWriteFileOptions, IFileStat, FileType, FileOperationErrorType, FileSystemProviderCapability, IDeleteFileOptions, IResolveStatOptions, IResolvedFileStat, hasReadFileStreamCapability, IFileSystemProviderWithReadFileStream, ICreateFileOptions, FileOperationError, hasCopyCapability, IWatchOptions, FileSystemProviderError } from "src/base/common/files/file";
import { basename, dirname } from "src/base/common/files/path";
import { bufferToStream, IReadableStream, IReadyReadableStream, listenStream, newWriteableBufferStream, readFileIntoStream, readFileIntoStreamAsync, streamToBuffer, toReadyStream, transformStream } from "src/base/common/files/stream";
import { isAbsoluteURI, Schemas, URI } from "src/base/common/files/uri";
import { ILogService } from "src/base/common/logger";
import { Blocker } from "src/base/common/utilities/async";
import { Mutable, Pair } from "src/base/common/utilities/type";
import { IRawResourceChangeEvents } from "src/platform/files/common/watcher";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { noop } from "src/base/common/performance";
import { errorToMessage } from "src/base/common/utilities/panic";

export const IFileService = createService<IFileService>('file-service');

export interface IFileService extends IDisposable, IService {

    /**
     * Fires when the watched resources are either added, deleted or updated.
     */
    readonly onDidResourceChange: Register<IRawResourceChangeEvents>;

    /**
     * Fires when any watched resource is closed.
     */
    readonly onDidResourceClose: Register<URI>;

    /**
     * Fires when all the watched resources are closed.
     */
    readonly onDidAllResourceClosed: Register<void>;

    /** 
     * @description Registers a file system provider for a given scheme. 
     */
    registerProvider(scheme: string | Schemas, provider: IFileSystemProvider): void;

    /** 
     * @description Gets a file system provider for a given scheme. 
     */
    getProvider(scheme: string | Schemas): IFileSystemProvider | undefined;

    /**
     * @description Resolves the properties of a file/folder identified by the 
     * given URI.
     * @param uri The given URI.
     * @param opts Option of the operation.
     * @returns The properties of the specified file/folder.
     */
    stat(uri: URI, opts?: IResolveStatOptions): AsyncResult<IResolvedFileStat, FileOperationError>;

    /** 
     * @description Read the file unbuffered. 
     * @note Options is set to false if it is not given.
     */
    readFile(uri: URI, opts?: IReadFileOptions): AsyncResult<DataBuffer, FileOperationError>;

    /**
     * @description Reads the directory by a given URI.
     */
    readDir(uri: URI): AsyncResult<Pair<string, FileType>[], FileOperationError>;

    /** 
     * @description Read the file buffered using stream. 
     * @note Options is set to false if it is not given.
     */
    readFileStream(uri: URI, opts?: IReadFileOptions): AsyncResult<IReadyReadableStream<DataBuffer>, FileOperationError>;

    /** 
     * @description Write to the file. 
     * @note Options is set to false if it is not given.
     */
    writeFile(uri: URI, bufferOrStream: DataBuffer | IReadableStream<DataBuffer>, opts: IWriteFileOptions): AsyncResult<void, FileOperationError>;

    /** 
     * @description Determines if the file/directory exists. 
     */
    exist(uri: URI): AsyncResult<boolean, FileOperationError>;

    /** 
     * @description Creates a file described by a given URI. 
     * @note Options is set to false if it is not given.
     */
    createFile(uri: URI, bufferOrStream?: DataBuffer | IReadableStream<DataBuffer>, opts?: ICreateFileOptions): AsyncResult<void, FileOperationError>;

    /** 
     * @description Creates a directory described by a given URI. 
     * @note No action is taken if the 'uri' is already existed.
     */
    createDir(uri: URI): AsyncResult<void, FileOperationError>;

    /** 
     * @description Moves a file/directory to a new location described by a given URI. 
     * @param {boolean} [overwrite=false] - Optional. whether should the 
     *      destination should be overwritten.
     * @note No action is taken if the 'from' and 'to' are identical.
     */
    moveTo(from: URI, to: URI, overwrite?: boolean): AsyncResult<IResolvedFileStat, FileOperationError>;

    /** 
     * @description Copy a file/directory to a new location. 
     * @param {boolean} [overwrite=false] - Optional. whether should the 
     *      destination should be overwritten.
     * @note No action is taken if the 'from' and 'to' are identical.
     */
    copyTo(from: URI, to: URI, overwrite?: boolean): AsyncResult<IResolvedFileStat, FileOperationError>;

    /** 
     * @description Deletes a file/directory described by a given URI. 
     */
    delete(uri: URI, opts?: IDeleteFileOptions): AsyncResult<void, FileOperationError>;

    /**
     * @description Watch the given target and events will be fired by listening 
     * to file service.
     */
    watch(uri: URI, opts?: IWatchOptions): AsyncResult<IDisposable, FileOperationError>;
}

/**
 * @class Provides a high-level abstraction layer for file system operations. 
 * This service allows for reading, writing, creating, and manipulating files 
 * and directories in a file system. 
 * 
 * It supports registering multiple {@link IFileSystemProvider}, each associated 
 * with a specific URI scheme.
 * 
 * The detailed implementation of every file operations is implemented by
 * {@link IFileSystemProvider}. The class acts as a central point for file 
 * system operations, allowing for a unified way to interact with different file 
 * systems.
 */
export class FileService extends Disposable implements IFileService {

    declare _serviceMarker: undefined;

    // [event]

    private readonly _onDidResourceChange = this.__register(new Emitter<IRawResourceChangeEvents>());
    public readonly onDidResourceChange = this._onDidResourceChange.registerListener;

    private readonly _onDidResourceClose = this.__register(new Emitter<URI>());
    public readonly onDidResourceClose = this._onDidResourceClose.registerListener;

    private readonly _onDidAllResourceClosed = this.__register(new Emitter<void>());
    public readonly onDidAllResourceClosed = this._onDidAllResourceClosed.registerListener;

    private readonly _activeWatchers = new Map<URI, IDisposable>();

    // [fields]

    private readonly _providers: Map<string, IFileSystemProvider> = new Map();

    /** @readonly read into chunks of 256KB each to reduce IPC overhead. */
    public static readonly bufferSize = 256 * 1024;

    // [constructor]

    constructor(@ILogService private readonly logService: ILogService) {
        super();
        logService.debug('FileService', 'FileService constructed.');
    }

    /***************************************************************************
     * public API - Provider Operations
     **************************************************************************/

    public registerProvider(scheme: string | Schemas, provider: IFileSystemProvider): void {
        this._providers.set(scheme, provider);
        
        this.__register(provider);
        this.__register(provider.onDidResourceChange(e => this._onDidResourceChange.fire(e)));
        this.__register(provider.onDidResourceClose(uri => {
            this.logService.debug('FileService', `stop watching at: ${URI.toString(uri)}`);

            this.release(this._activeWatchers.get(uri));
            this._activeWatchers.delete(uri);
            this._onDidResourceClose.fire(uri);

            if (!this._activeWatchers.size) {
                this._onDidAllResourceClosed.fire();
            }
        }));

        this.logService.debug('FileService', `Provider registered with scheme: ${scheme}`);
    }

    public getProvider(scheme: string | Schemas): IFileSystemProvider | undefined {
        return this._providers.get(scheme);
    }

    /***************************************************************************
     * public API - File Operations
     **************************************************************************/

    public stat(uri: URI, opts?: IResolveStatOptions): AsyncResult<IResolvedFileStat, FileOperationError> {
        return this.__getProvider(uri)
        .toAsync()
        .andThen(async provider => <const>[await provider.stat(uri), provider])
        .andThen(([stat, provider]) => this.__resolveStat(uri, provider, stat, opts))
        .mapErr((error) => new FileOperationError(errorToMessage(error), getFileErrorCode(error)));
    }

    public readFile(uri: URI, opts?: IReadFileOptions): AsyncResult<DataBuffer, FileOperationError> {
        return this.__getReadProvider(uri)
            .toAsync()
            .andThen(provider => this.__readFile(provider, uri, opts));
    }

    public readFileStream(uri: URI, opts?: IReadFileOptions): AsyncResult<IReadyReadableStream<DataBuffer>, FileOperationError> {
        return this.__getReadProvider(uri)
            .toAsync()
            .andThen(provider => this.__readFileStream(provider, uri, opts));
    }

    public writeFile(uri: URI, bufferOrStream: DataBuffer | IReadableStream<DataBuffer>, opts: IWriteFileOptions): AsyncResult<void, FileOperationError> {
        const get = this.__getWriteProvider(uri);
        if (get.isErr()) {
            return AsyncResult.err(get.error);
        }
        const provider = get.unwrap();

        // validate write operation, returns the stat of the file.
        return this.__validateWrite(provider, uri, opts)
        
        // create recursive directory if necessary
        .andThen(stat => {
            if (!stat) {
                return this.__mkdirRecursive(provider, URI.fromFile(dirname(URI.toFsPath(uri))));
            }
            return AsyncResult.ok<void, FileOperationError>();
        })
        .andThen(() => {
            // REVIEW: optimization?

            /**
             * write file: unbuffered (only if data to write is a buffer, or the 
             * provider has no buffered write capability).
             */
            if ((hasReadWriteCapability(provider) && bufferOrStream instanceof DataBuffer) ||
                !hasOpenReadWriteCloseCapability(provider)
            ) {
                return this.__writeUnbuffered(provider, uri, opts, bufferOrStream);
            }

            // write file: buffered
            else {
                return this.__writeBuffered(provider, uri, opts, bufferOrStream instanceof DataBuffer ? bufferToStream(bufferOrStream) : bufferOrStream);
            }
        });
    }

    public exist(uri: URI): AsyncResult<boolean, FileOperationError> {
        return this.__getProvider(uri)
            .toAsync()
            .andThen(provider => provider.stat(uri))
            .andThen(() => ok(true))
            .orElse(() => ok(false))
            .mapErr(error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)));
    }

    public createFile(
        uri: URI,
        bufferOrStream: DataBuffer | IReadableStream<DataBuffer> = DataBuffer.alloc(0),
        opts?: ICreateFileOptions,
    ): AsyncResult<void, FileOperationError>
    {
        return this.__validateCreate(uri, opts)
        .andThen(() => this.writeFile(uri, bufferOrStream, { create: true, overwrite: !!opts?.overwrite, unlock: false }));
    }

    public readDir(uri: URI): AsyncResult<Pair<string, FileType>[], FileOperationError> {
        return this.__getProvider(uri)
            .toAsync()
            .andThen(provider => provider.readdir(uri))
            .mapErr(error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)));
    }

    public createDir(uri: URI): AsyncResult<void, FileOperationError> {
        return this.__getWriteProvider(uri)
            .toAsync()
            .andThen(provider => this.__mkdirRecursive(provider, uri));
    }

    public moveTo(from: URI, to: URI, overwrite?: boolean): AsyncResult<IResolvedFileStat, FileOperationError> {
        const fromResult = this.__getWriteProvider(from);
        if (fromResult.isErr()) {
            return AsyncResult.err(fromResult.error);
        }
        
        const toResult = this.__getWriteProvider(from);
        if (toResult.isErr()) {
            return AsyncResult.err(toResult.error);
        }

        const fromProvider = fromResult.unwrap();
        const toProvider = toResult.unwrap();

        return this.__doMoveTo(from, fromProvider, to, toProvider, overwrite)
            .andThen(() => this.stat(to));
    }

    public copyTo(from: URI, to: URI, overwrite?: boolean): AsyncResult<IResolvedFileStat, FileOperationError> {
        const fromResult = this.__getWriteProvider(from);
        if (fromResult.isErr()) {
            return AsyncResult.err(fromResult.error);
        }
        
        const toResult = this.__getWriteProvider(from);
        if (toResult.isErr()) {
            return AsyncResult.err(toResult.error);
        }

        const fromProvider = fromResult.unwrap();
        const toProvider = toResult.unwrap();

        return this.__doCopyTo(from, fromProvider, to, toProvider, overwrite)
        .andThen(() => this.stat(to));
    }

    public delete(uri: URI, opts?: IDeleteFileOptions): AsyncResult<void, FileOperationError> {
        return this.__validateDelete(uri, opts)
            .andThen(provider => provider.delete(uri, { useTrash: !!opts?.useTrash, recursive: !!opts?.recursive }))
            .orElse(error => err(new FileOperationError(`unable to delete uri: '${URI.toString(uri)}'. Reason: ${errorToMessage(error)}`, getFileErrorCode(error))));
    }

    public watch(uri: URI, opts?: IWatchOptions): AsyncResult<IDisposable, FileOperationError> {
        if (this._activeWatchers.has(uri)) {
            this.logService.warn('FileService', `duplicate watching on the same resource: ${URI.toString(uri)}`);
            return AsyncResult.ok(Disposable.NONE);
        }

        this.logService.debug('FileService', `Start watching on file (${URI.toString(uri)})...`);
        return this.__getProvider(uri).toAsync()
            .andThen(provider => {
                return provider.watch(uri, opts);
            })
            .andThen(async disposable => {
                this._activeWatchers.set(uri, this.__register(disposable));
                return disposable;
            })
            .mapErr(error => 
                new FileOperationError(`Cannot watch at target: '${URI.toString(uri)}'. Reason: ${errorToMessage(error)}`, FileOperationErrorType.UNKNOWN)
            );
    }

    public override dispose(): void {
        if (this._activeWatchers.size > 0) {
            // have to unregister listeners after everything is done
            Event.onceSafe(this.onDidAllResourceClosed)(() => {
                super.dispose();
            });
        } else {
            super.dispose();
        }
        
        for (const active of this._activeWatchers.values()) {
            this.release(active);
        }
    }

    /***************************************************************************
     * Reading files related helper methods.
     **************************************************************************/

    private __readFile(
        provider: FileSystemProviderAbleToRead,
        uri: URI,
        opts?: IReadFileOptions,
    ): AsyncResult<DataBuffer, FileOperationError> 
    {
        return this.__readFileStream(provider, uri, { ...opts, preferUnbuffered: true })
        .andThen(ready => {
            const stream = ready.flow();
            return streamToBuffer(stream);
        });
    }

    private __readFileStream(
        provider: FileSystemProviderAbleToRead,
        uri: URI,
        opts?: IReadFileOptions & { preferUnbuffered?: boolean; },
    ): AsyncResult<IReadyReadableStream<DataBuffer>, FileOperationError> 
    {
        return this.__validateRead(provider, uri, opts)
        .andThen(() => {
            let stream: IReadyReadableStream<DataBuffer> | undefined = undefined;

            /**
             * read unbuffered:
             *  - the provider has no buffered capability
             *  - prefer unbuffered
             */
            if (!(hasOpenReadWriteCloseCapability(provider) ||
                hasReadFileStreamCapability(provider)) ||
                (hasReadWriteCapability(provider) && opts?.preferUnbuffered)
            ) {
                stream = this.__readFileUnbuffered(provider, uri, opts);
            }

            // read streamed
            else if (hasReadFileStreamCapability(provider)) {
                stream = this.__readFileStreamed(provider, uri, opts);
            }

            // read buffered
            else {
                stream = this.__readFileBuffered(provider, uri, opts);
            }

            return ok(stream);
        });
    }

    /** @description Read the file directly into the memory in one time. */
    private __readFileUnbuffered(
        provider: IFileSystemProviderWithFileReadWrite,
        uri: URI,
        opts?: IReadFileOptions,
    ): IReadyReadableStream<DataBuffer>
    {
        const stream = newWriteableBufferStream();
        return toReadyStream(() => {
            readFileIntoStreamAsync(provider, uri, stream, opts);
            return stream;
        });
    }

    private __readFileStreamed(
        provider: IFileSystemProviderWithReadFileStream,
        uri: URI,
        opts?: IReadFileOptions,
    ): IReadyReadableStream<DataBuffer> 
    {
        const readyStream = provider.readFileStream(uri, opts);

        return toReadyStream(() => {
            const fromStream = readyStream.flow();

            /**
             * Because `transformStream` will trigger `listenStream` which will
             * force the `fromStream` into flowing state, thus it must be delayed.
             */
            const toStream = transformStream(fromStream, {
                    data: data => DataBuffer.wrap(data),
                },
                data => DataBuffer.concat(data),
            );

            return toStream;
        });
    }

    /** @description Read the file using buffer I/O. */
    private __readFileBuffered(
        provider: IFileSystemProviderWithOpenReadWriteClose,
        uri: URI,
        opts?: IReadFileOptions,
    ): IReadyReadableStream<DataBuffer> 
    {
        const stream = newWriteableBufferStream();
        return toReadyStream(() => {
            readFileIntoStream(provider, uri, stream, data => data, { ...opts, bufferSize: FileService.bufferSize });
            return stream;
        });
    }

    /***************************************************************************
     * Writing files related helper methods.
     **************************************************************************/

    private __writeUnbuffered(
        provider: IFileSystemProviderWithFileReadWrite,
        uri: URI,
        opts: IWriteFileOptions | undefined,
        bufferOrStream: DataBuffer | IReadableStream<DataBuffer>,
    ): AsyncResult<void, FileOperationError> 
    {
        return new AsyncResult((async () => {
            const buffer: DataBuffer = bufferOrStream instanceof DataBuffer ? bufferOrStream : await streamToBuffer(bufferOrStream);
        
            // write through a provider
            return Result.fromPromise(
                async () => { await provider.writeFile(uri, buffer.buffer, { create: opts?.create ?? false, overwrite: opts?.overwrite ?? false, unlock: opts?.unlock ?? false }); },
                error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)),
            );    
        })());
    }

    private __writeBuffered(
        provider: IFileSystemProviderWithOpenReadWriteClose,
        uri: URI,
        opts: IWriteFileOptions | undefined,
        stream: IReadableStream<DataBuffer>,
    ): AsyncResult<void, FileOperationError>
    {
        return Result.fromPromise(
            async () => await provider.open(uri, { create: true, unlock: opts?.unlock ?? false }),
            error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)),
        )
        .andThen(fd => {
            const blocker = new Blocker<void>();
            let posInFile = 0;

            listenStream(stream, {
                onData: async (chunk: DataBuffer) => {

                    // pause stream to perform async write operation
                    stream.pause();

                    const writeResult = await this.__writeBuffer(provider, fd, chunk, chunk.bufferLength, posInFile, 0);
                    if (writeResult.isErr()) {
                        return blocker.reject(writeResult.error);
                    }
                    
                    posInFile += chunk.bufferLength;

                    /**
                     * resume stream now that we have successfully written run this 
                     * on the next tick to prevent increasing the execution stack 
                     * because resume() may call the event handler again before 
                     * finishing.
                     */
                    setTimeout(() => stream.resume());
                },
                onError: error => blocker.reject(error),
                onEnd: () => blocker.resolve(),
            });

            return Result.fromPromise(
                () => blocker.waiting().finally(() => provider.close(fd)),
                error => new FileOperationError(`unable to write the file buffered '${URI.toString(uri)}'. Reason: ${errorToMessage(error)}`, getFileErrorCode(error)),
            );
        });
    }

    private __writeBuffer(
        provider: IFileSystemProviderWithOpenReadWriteClose,
        fs: number,
        buffer: DataBuffer,
        length: number,
        posInFile: number,
        posInBuffer: number,
    ): AsyncResult<void, Error> 
    {
        return Result.fromPromise(
            async () => {
                let written = 0;
                while (written < length) {
                    written += await provider.write(fs, posInFile + written, buffer.buffer, posInBuffer + written, length - written);
                }
            },
        );
    }

    /**
     * @description Create directory recursively if not existed.
     */
    private __mkdirRecursive(provider: IFileSystemProvider, dir: URI): AsyncResult<void, FileOperationError> {
        return new AsyncResult((async () => {
            
        const dirWaitToBeCreate: string[] = [];
        let path = dir;

        while (true) {
            const statResult = await Result.fromPromise(
                async () => await provider.stat(path),
                error => undefined,
            );

            // we reaches a not existed directory, we remember it.
            if (statResult.isErr()) {
                dirWaitToBeCreate.push(URI.basename(path));
                path = URI.dirname(path);
                continue;
            }

            // not a directory
            const stat = statResult.unwrap();
            if ((stat.type & FileType.DIRECTORY) === 0) {
                return err(new FileOperationError('unable to create directory that already exists but is not a directory', FileOperationErrorType.FILE_IS_DIRECTORY));
            }

            // we reaches a existed directory, we break the loop.
            break;
        }

        for (let i = dirWaitToBeCreate.length - 1; i >= 0; i--) {
            path = URI.join(path, dirWaitToBeCreate[i]!);

            const res = await Result.fromPromise(
                async () => provider.mkdir(path),
                error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)),
            );

            if (res.isErr()) {
                return err(res.error);
            }
        }

        return ok();

        })());
    }

    /**
     * @description Resolves the {@link IFileStat} and returns as {@link IResolvedFileStat}.
     */
    private __resolveStat(
        uri: URI,
        provider: IFileSystemProvider,
        stat: IFileStat,
        opts?: IResolveStatOptions,
    ): AsyncResult<IResolvedFileStat, FileOperationError> 
    {
        return new AsyncResult((async () => {

        // the resolved file stat
        const resolved: Mutable<IResolvedFileStat> = {
            ...stat,
            name: basename(URI.toFsPath(uri)),
            uri: uri,
            readonly: stat.readonly || Boolean(provider.capabilities & FileSystemProviderCapability.Readonly),
            children: undefined,
        };

        // resolves the children if needed
        if (stat.type === FileType.DIRECTORY && opts && (opts.resolveChildren || opts.resolveChildrenRecursive)) {
            const dirResult = await Result.fromPromise(
                () => provider.readdir(uri),
                error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)),
            );
            
            if (dirResult.isErr()) {
                return err(dirResult.error);
            }

            const children = dirResult.unwrap();
            const resolvedChildren: IResolvedFileStat[] = [];
            
            // recursively resolve children stat
            for (const [name, _type] of children) {
                const childUri = URI.join(uri, name);
                await Result.fromPromise(() => provider.stat(childUri))
                    .andThen(childStat => this.__resolveStat(childUri, provider, childStat, { resolveChildren: opts.resolveChildrenRecursive }))
                    .match(stat => resolvedChildren.push(stat), noop);
            }
            
            resolved.children = resolvedChildren;
        }

        return ok(resolved);

        })());
    }

    private __doMoveTo(
        from: URI, 
        fromProvider: IFileSystemProvider, 
        to: URI, 
        toProvider: IFileSystemProvider, 
        overwrite?: boolean,
    ): AsyncResult<void, FileOperationError> 
    {
        if (URI.toString(from) === URI.toString(to)) {
            return AsyncResult.ok();
        }

        return this.__validateMoveOrCopy(to, overwrite)
        
        .andThen(exist => {
            if (exist) {
                return this.delete(to, { recursive: true });
            }
            return AsyncResult.ok<void, FileOperationError>();
        })
        
        .andThen(() => {
            const toUriDir = URI.dirname(to);
            return this.__mkdirRecursive(toProvider, toUriDir);
        })
        
        .andThen(() => {
            return this.__doCopyTo(from, fromProvider, to, toProvider, overwrite);
        })

        .andThen(() => {
            return this.delete(from, { recursive: true });
        });
    }

    private __doCopyTo(
        from: URI, 
        fromProvider: IFileSystemProvider, 
        to: URI, 
        toProvider: IFileSystemProvider, 
        overwrite?: boolean,
    ): AsyncResult<void, FileOperationError> 
    {
        if (URI.toString(from) === URI.toString(to)) {
            return AsyncResult.ok();
        }
        
        return this.__validateMoveOrCopy(to, overwrite)
        
        .andThen(exist => {
            if (exist && overwrite) {
                return this.delete(to, { recursive: true });
            }
            return AsyncResult.ok<void, FileOperationError>();
        })
        
        .andThen(() => {
            const toUriDir = URI.fromFile(dirname(URI.toFsPath(to)));
            return this.__mkdirRecursive(toProvider, toUriDir);
        })
        
        .andThen(() => {
            if (!hasCopyCapability(fromProvider)) {
                return err(new FileOperationError(`Unable to copy to the target path '${URI.toString(to)}' because the provider does not provide copy functionality.`, FileOperationErrorType.OTHERS));
            } 
            return Result.fromPromise(
                () => fromProvider.copy(from, to, { overwrite: !!overwrite }),
                error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)),
            );
        });
    }

    private __validateMoveOrCopy(to: URI, overwrite?: boolean): AsyncResult<boolean, FileOperationError> {
        return this.exist(to)
        .andThen(exist => {
            if (exist && overwrite === false) {
                return err(new FileOperationError(`Unable to move / copy to the target path '${URI.toString(to)}' because already exists.`, FileOperationErrorType.FILE_EXISTS));
            }
            return ok(exist);
        });
    }

    /***************************************************************************
     * Provider related helper methods.
     **************************************************************************/

    private __getReadProvider(uri: URI): Result<IFileSystemProviderWithFileReadWrite | IFileSystemProviderWithOpenReadWriteClose, FileOperationError> 
    {
        return this.__getProvider(uri)
        .andThen(provider => {
            if (hasOpenReadWriteCloseCapability(provider) || hasReadWriteCapability(provider)) {
                return ok(provider);
            }
            return err(new FileOperationError(`Filesystem provider for scheme '${uri.scheme}' neither has FileReadWrite nor FileOpenReadWriteClose capability which is needed for the read operation.`, FileOperationErrorType.OTHERS));
        });
    }

    private __getWriteProvider(uri: URI): Result<IFileSystemProviderWithFileReadWrite | IFileSystemProviderWithOpenReadWriteClose, FileOperationError> 
    {
        return this.__getProvider(uri)
            .andThen(provider => this.__errIfProviderReadonly(provider))
            .andThen(provider => {
                if (hasOpenReadWriteCloseCapability(provider) || hasReadWriteCapability(provider)) {
                    return ok(provider);
                }
                return err(new FileOperationError(`filesystem provider for scheme '${uri.scheme}' neither has FileReadWrite nor FileOpenReadWriteClose capability which is needed for the write operation.`, FileOperationErrorType.OTHERS));
            });
    }

    private __getProvider(uri: URI): Result<IFileSystemProvider, FileOperationError> {

        // Assert path is absolute
        if (isAbsoluteURI(uri) === false) {
            return err(new FileOperationError(`unable to resolve filesystem provider with relative file path '${uri.path}`, FileOperationErrorType.OTHERS));
        }

        // Assert provider
        const provider = this._providers.get(uri.scheme);
        if (!provider) {
            return err(new FileOperationError(`no provider found for the given schema: '${uri.scheme}'`, FileOperationErrorType.OTHERS));
        }

        return ok(provider);
    }

    /***************************************************************************
     * Validation
     **************************************************************************/

    private __validateRead(
        provider: IFileSystemProvider,
        uri: URI,
        opts?: IReadFileOptions,
    ): AsyncResult<void, FileOperationError> 
    {
        return Result.fromPromise(
            () => provider.stat(uri),
            error => new FileOperationError(errorToMessage(error), getFileErrorCode(error)),
        )
        .andThen(stat => {
            if (!stat) {
                return err(new FileOperationError('target URI does not exist', FileOperationErrorType.FILE_INVALID_PATH));
            } else if (stat.type & FileType.DIRECTORY) {
                return err(new FileOperationError('unable to read file which is actually a directory', FileOperationErrorType.FILE_IS_DIRECTORY));
            }

            return this.__validateReadLimit(stat.byteSize, opts);
        });
    }

    /**
     * @description Validates if the write operation is legal under the given 
     * provider. Returns the stat of the file. Throws if it is a directory or it 
     * is a readonly file.
     * @returns The stat of the file. Returns undefined if file does not exists.
     */
    private __validateWrite(
        provider: IFileSystemProvider,
        uri: URI,
        opts?: IWriteFileOptions,
    ): AsyncResult<IFileStat | undefined, FileOperationError>
    {
        // todo: Validate unlock support (use `opts`)

        // check existence first
        return Result.fromPromise<IFileStat | undefined, FileOperationError>(() => provider.stat(uri))
            .orElse<FileOperationError>(() => AsyncResult.ok(undefined))
            .andThen(stat => {
                if (!stat) {
                    return AsyncResult.ok(undefined);
                }

                if (stat.type & FileType.DIRECTORY) {
                    return AsyncResult.err(new FileOperationError('unable to write file which is actually a directory', FileOperationErrorType.FILE_IS_DIRECTORY));
                }

                if (stat.readonly ?? false) {
                    return AsyncResult.err(new FileOperationError('unable to write file which is readonly', FileOperationErrorType.FILE_READONLY));
                }

                return AsyncResult.ok(stat);
            });
    }

    private __validateReadLimit(size: number, opts?: IReadFileOptions): Result<void, FileOperationError> {
        if (opts?.limits) {

            let tooLargeErrorResult: FileOperationErrorType | undefined = undefined;

            if (typeof opts.limits.memory === 'number' && size > opts.limits.memory) {
                tooLargeErrorResult = FileOperationErrorType.FILE_EXCEEDS_MEMORY_LIMIT;
            }

            if (typeof opts.limits.size === 'number' && size > opts.limits.size) {
                tooLargeErrorResult = FileOperationErrorType.FILE_TOO_LARGE;
            }

            if (typeof tooLargeErrorResult === 'number') {
                if (tooLargeErrorResult === FileOperationErrorType.FILE_EXCEEDS_MEMORY_LIMIT) {
                    return err(new FileOperationError('read file exceeds memory limit', tooLargeErrorResult));
                } else {
                    return err(new FileOperationError('read file is too large', tooLargeErrorResult));
                }
            }
        }

        return ok();
    }

    private __validateCreate(uri: URI, opts?: ICreateFileOptions): AsyncResult<void, FileOperationError> {
        return this.exist(uri)
            .andThen(exist => {
                if (exist && opts?.overwrite === false) {
                    return err(new FileOperationError('file already exists', FileOperationErrorType.FILE_EXISTS));
                }
                return ok();
            });
    }

    private __validateDelete(uri: URI, opts?: IDeleteFileOptions): AsyncResult<IFileSystemProvider, FileOperationError> {
        const get = this.__getWriteProvider(uri);
        if (get.isErr()) {
            return AsyncResult.err(get.error);
        }
        
        const ifReadonly = this.__errIfProviderReadonly(get.unwrap());
        if (ifReadonly.isErr()) {
            return AsyncResult.err(ifReadonly.error);
        }
        const provider = ifReadonly.unwrap();

        const check = Result.fromPromise(
            async () => provider.stat(uri),
            _err => new FileOperationError('file or directory does not exist', FileOperationErrorType.FILE_NOT_FOUND),
        )
        .andThen(stat => this.__errIfFileIsReadonly(stat));

        return check.map(() => provider);
    }

    private __errIfProviderReadonly(provider: IFileSystemProvider): Result<IFileSystemProvider, FileOperationError> {
        if (provider.capabilities & FileSystemProviderCapability.Readonly) {
            return err(new FileOperationError('file system provider is readonly', FileOperationErrorType.FILE_READONLY));
        }
        return ok(provider);
    }

    private __errIfFileIsReadonly(stat: IFileStat): Result<void, FileOperationError> {
        if (typeof stat.readonly === 'boolean' && stat.readonly === true) {
            return err(new FileOperationError('unable to modify a readonly file', FileOperationErrorType.FILE_READONLY));
        }
        return ok();
    }
}

function getFileErrorCode(error: unknown): FileOperationErrorType {
    if (error instanceof FileSystemProviderError) {
        return error.code;
    }

    if (error instanceof FileOperationError) {
        return error.code;
    }

    return FileOperationErrorType.UNKNOWN;
}