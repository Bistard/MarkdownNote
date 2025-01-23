import * as fs from "fs";
import { Disposable, IDisposable } from "src/base/common/dispose";
import { DataBuffer } from "src/base/common/files/buffer";
import { FileOperationErrorType, FileSystemProviderCapability, FileSystemProviderError, FileType, IDeleteFileOptions, IFileStat, IFileSystemProviderWithFileReadWrite, IFileSystemProviderWithOpenReadWriteClose, IFileSystemProviderWithReadFileStream, IOpenFileOptions, IOverwriteFileOptions, IReadFileOptions, IWatchOptions, IWriteFileOptions } from "src/base/common/files/file";
import { join } from "src/base/common/files/path";
import { IReadyReadableStream, newWriteableStream, readFileIntoStream, toReadyStream } from "src/base/common/files/stream";
import { URI } from "src/base/common/files/uri";
import { retry } from "src/base/common/utilities/async";
import { FileService } from "src/platform/files/common/fileService";
import { fileExists, FileMode, statWithSymbolink } from "src/base/node/io";
import { Watcher } from "src/platform/files/node/watcher";
import { ILogService } from "src/base/common/logger";
import { Emitter } from "src/base/common/event";
import { IRawResourceChangeEvents, IWatcher } from "src/platform/files/common/watcher";
import { errorToMessage, panic } from "src/base/common/utilities/panic";
import { Time } from "src/base/common/date";
import { OS_CASE_SENSITIVE } from "src/base/common/platform";

export class DiskFileSystemProvider extends Disposable implements
    IFileSystemProviderWithFileReadWrite,
    IFileSystemProviderWithOpenReadWriteClose,
    IFileSystemProviderWithReadFileStream 
{
    
    // [event]

    private readonly _onDidResourceChange = this.__register(new Emitter<IRawResourceChangeEvents>());
    public readonly onDidResourceChange = this._onDidResourceChange.registerListener;

    private readonly _onDidResourceClose = this.__register(new Emitter<URI>());
    public readonly onDidResourceClose = this._onDidResourceClose.registerListener;

    // [field]

    /**
     * @readonly DiskFileSystemProvider has fully permission to deal with disk
     * fileSystems.
     */
    public readonly capabilities: FileSystemProviderCapability =
        FileSystemProviderCapability.FileReadWrite |
        FileSystemProviderCapability.FileOpenReadWriteClose |
        FileSystemProviderCapability.ReadFileStream |
        FileSystemProviderCapability.FileFolderCopy;

    private _watcher?: IWatcher;

    // [constructor]

    constructor(
        private readonly logService?: ILogService,
    ) {
        super();
        if (OS_CASE_SENSITIVE) {
            this.capabilities |= FileSystemProviderCapability.PathCaseSensitive;
        }
    }

    /***************************************************************************
     * Unbuffered File Operations readFile/writeFile
     **************************************************************************/

    public async readFile(uri: URI): Promise<Uint8Array> {
        try {
            const path = URI.toFsPath(uri);
            return await fs.promises.readFile(path);
        }
        catch (err: any) {
            if (err.code === 'ENOENT') {
                panic(new FileSystemProviderError(`File does not exist: ${URI.toString(uri)}`, FileOperationErrorType.FILE_NOT_FOUND));
            }
            panic(err);
        }
    }

    public async writeFile(
        uri: URI,
        content: Uint8Array,
        opts: IWriteFileOptions): Promise<void> {
        let fd: number | undefined = undefined;

        try {
            const path = URI.toFsPath(uri);

            // validation {overwrite, create}
            if (opts.create === false || opts.overwrite === false) {
                const exist = await fileExists(path);

                if (exist && opts.overwrite === false) {
                    panic(new FileSystemProviderError(`File already exists: ${URI.toString(uri)}`, FileOperationErrorType.FILE_EXISTS));
                }

                else if (!exist && opts.create === false) {
                    panic(new FileSystemProviderError(`File does not exist: ${URI.toString(uri)}`, FileOperationErrorType.FILE_NOT_FOUND));
                }
            }

            // open the file
            fd = await this.open(uri, { create: true, unlock: opts.unlock });

            // write the content at once (write from beginning)
            await this.write(fd, 0, content, 0, content.byteLength);
        }

        catch (error) {
            panic(this.__toError(error));
        }

        finally {
            if (typeof fd === 'number') {
                await this.close(fd);
            }
        }

    }

    public readFileStream(uri: URI, opt?: IReadFileOptions): IReadyReadableStream<Uint8Array> {
        const stream = newWriteableStream<Uint8Array>(data => DataBuffer.concat(data.map(data => DataBuffer.wrap(data))).buffer);
        return toReadyStream(() => {
            readFileIntoStream(this, uri, stream, data => data.buffer, {
                ...opt,
                bufferSize: FileService.bufferSize
            });
            
            return stream;
        });
    }

    /***************************************************************************
     * Low Level File Operations open/read/write/close 
     **************************************************************************/

    public async open(uri: URI, opts: IOpenFileOptions): Promise<number> {

        try {
            const path = URI.toFsPath(uri);

            // determine wether to unlock the file (write mode only)
            if (opts.create === true && opts.unlock === true) {
                try {
                    const stat = await fs.promises.stat(path);
                    /* File mode indicating writable by owner */
                    if (!(stat.mode & 0o200)) {
                        await fs.promises.chmod(path, stat.mode | FileMode.writable);
                    }
                } catch (_err) {
                    // ignore any errors here and try to just write
                }

            }

            // Determine file flags for opening (read vs write)
            let flag: string | undefined = undefined;
            if (opts.create === true) {
                flag = 'w';
            } else {
                flag = 'r';
            }

            const fd = fs.openSync(path, flag);
            return fd;
        }

        catch (err) {
            panic(this.__toError(err));
        }
    }

    public async close(fd: number): Promise<void> {
        try {
            fs.closeSync(fd);
        } catch (err) {
            panic(this.__toError(err));
        }
    }

    public async read(fd: number, pos: number, buffer: Uint8Array, offset: number, length: number): Promise<number> {
        let bytesRead: number | null = null;
        try {
            const read = fs.readSync(fd, buffer, offset, length, pos);

            bytesRead = read;
            return bytesRead;

        } catch (err) {
            panic(this.__toError(err));
        }
    }

    public async write(
        fd: number,
        pos: number,
        buffer: Uint8Array,
        offset: number,
        length: number): Promise<number> {
        /**
         * @readonly Retry for maximum 3 times for writing to a file to ensure 
         * the write operation succeeds.
         */
        return retry(() => this.__write(fd, pos, buffer, offset, length), Time.ms(100), 3);
    }

    /***************************************************************************
     * Folder Operations move/copy/delete/create
     **************************************************************************/

    public async copy(from: URI, to: URI, opts: IOverwriteFileOptions): Promise<void> {
        if (from === to) {
            return;
        }

        try {
            const fromPath = URI.toFsPath(from);
            const toPath = URI.toFsPath(to);
            const stat = await this.stat(from);

            if (await fileExists(toPath) && opts.overwrite === false) {
                panic(new FileSystemProviderError(`Target already exists at ${toPath}`, FileOperationErrorType.FILE_EXISTS));
            }

            if (stat.type === FileType.DIRECTORY) {
                await fs.promises.cp(fromPath, toPath, { recursive: true, force: true });
            } else {
                await fs.promises.copyFile(fromPath, toPath);
            }
        }

        catch (err) {
            panic(this.__toError(err));
        }
    }

    public async mkdir(uri: URI): Promise<void> {
        try {
            await fs.promises.mkdir(URI.toFsPath(uri), { recursive: true });
        } catch (err) {
            panic(this.__toError(err));
        }
    }

    public async delete(uri: URI, opts: IDeleteFileOptions): Promise<void> {
        try {
            const path = URI.toFsPath(uri);

            if (opts.recursive) {
                await fs.promises.rm(path, { recursive: opts.recursive });
                return;
            } 

            // not deleting recursive, use unlink
            try {
                await fs.promises.unlink(path);
            } catch (unlinkError: any) {
                /**
                 * `fs.unlink` will throw when used on directories we try to 
                 * detect this error and then see if the provided resource is 
                 * actually a directory. in that case we use `fs.rmdir` to 
                 * delete the directory.
                 */

                if (unlinkError.code === 'EPERM' || unlinkError.code === 'EISDIR') {
                    let isDirectory = false;
                    try {
                        const { stat, symbolicLink } = await statWithSymbolink(path);
                        isDirectory = stat.isDirectory() && !symbolicLink;
                    } catch (statError) { /** ignore */ }

                    if (isDirectory) {
                        await fs.promises.rmdir(path);
                    } else {
                        panic(unlinkError);
                    }
                } else {
                    panic(unlinkError);
                }
            }

        } catch (err) {
            panic(this.__toError(err));
        }
    }

    public async rename(from: URI, to: URI, opts: IOverwriteFileOptions): Promise<void> {
        const fromPath = URI.toFsPath(from);
        const toPath = URI.toFsPath(to);

        if (fromPath === toPath) {
            return;
        }

        try {
            if (await fileExists(toPath) && opts.overwrite === false) {
                panic('file already exists');
            }
            await fs.promises.rename(fromPath, toPath);
        } catch (err) {
            panic(this.__toError(err));
        }
    }

    /***************************************************************************
     * File Metadata Handling
     **************************************************************************/

    public async stat(uri: URI): Promise<IFileStat> {
        try {
            const stat = await fs.promises.stat(URI.toFsPath(uri));

            let fileType: FileType = FileType.UNKNOWN;
            if (stat.isDirectory()) {
                fileType = FileType.DIRECTORY;
            } else if (stat.isFile()) {
                fileType = FileType.FILE;
            }

            return {
                type: fileType,
                createTime: stat.birthtime.getTime(),
                modifyTime: stat.mtime.getTime(),
                byteSize: stat.size
            };
        }

        catch (err) {
            panic(this.__toError(err));
        }
    }

    public async readdir(uri: URI): Promise<[string, FileType][]> {

        try {
            // reads all the children of the current directory
            const path = URI.toFsPath(uri);
            const children = await fs.promises.readdir(path, { withFileTypes: true });

            const result: [string, FileType][] = [];

            // determines each child entry's file type
            Promise.all(children.map(
                async (child: fs.Dirent) => {
                    try {
                        let type: FileType;
                        if (child.isSymbolicLink()) {
                            type = (await this.stat(URI.fromFile(join(path, child.name)))).type;
                        } else {
                            type = this.__getFileType(child);
                        }
                        result.push([child.name, type]);
                    } catch (err) {
                        // ignores err;
                    }
                }
            ));

            return result;
        }

        catch (err) {
            panic(this.__toError(err));
        }
    }

    public watch(uri: URI, opts?: IWatchOptions): Promise<IDisposable> {
        if (!this._watcher) {
            this._watcher = this.__register(new Watcher(this.logService));
            this.__register(this._watcher.onDidChange(e => this._onDidResourceChange.fire(e)));
            this.__register(this._watcher.onDidClose(e => this._onDidResourceClose.fire(e)));
        }
        return this._watcher.watch({ resource: uri, ...opts });
    }

    /***************************************************************************
     * Helper Functions
     **************************************************************************/

    private __getFileType(entry: fs.Dirent): FileType {
        if (entry.isFile()) {
            return FileType.FILE;
        }

        else if (entry.isDirectory()) {
            return FileType.DIRECTORY;
        }

        else {
            return FileType.UNKNOWN;
        }
    }

    private async __write(
        fd: number,
        pos: number,
        data: Uint8Array,
        offset: number,
        length: number): Promise<number> {
        try {
            const written = fs.writeSync(fd, data, offset, length, pos);
            return written;
        }

        catch (error) {
            panic(this.__toError(error));
        }
    }

    private __toError(error: any): FileSystemProviderError {

        if (error instanceof FileSystemProviderError) {
            return error;
        }

        let result: Error | string = error;
        let code: FileOperationErrorType;
        switch (error.code) {
            case 'ENOENT':
                code = FileOperationErrorType.FILE_NOT_FOUND;
                break;
            case 'EISDIR':
                code = FileOperationErrorType.FILE_IS_DIRECTORY;
                break;
            case 'ENOTDIR':
                code = FileOperationErrorType.FILE_IS_NOT_DIRECTORY;
                break;
            case 'EEXIST':
                code = FileOperationErrorType.FILE_EXISTS;
                break;
            case 'EPERM':
            case 'EACCES':
                code = FileOperationErrorType.NO_PERMISSIONS;
                break;
            case 'ERR_UNC_HOST_NOT_ALLOWED':
                result = `${error.message}. Please update the 'security.allowedUNCHosts' setting if you want to allow this host.`;
                code = FileOperationErrorType.UNKNOWN;
                break;
            default:
                code = FileOperationErrorType.UNKNOWN;
        }

        return new FileSystemProviderError(errorToMessage(result), code);
    }
}