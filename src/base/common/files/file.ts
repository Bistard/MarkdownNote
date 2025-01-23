import { IDisposable } from "src/base/common/dispose";
import { Register } from "src/base/common/event";
import { IReadyReadableStream } from "src/base/common/files/stream";
import { URI } from "src/base/common/files/uri";
import { IRawResourceChangeEvents } from "src/platform/files/common/watcher";

export const enum ByteSize {
	KB = 1024,
	MB = KB * KB,
	GB = MB * MB,
	TB = GB * GB,
}

export const enum FileType {
	UNKNOWN,
	FILE,
	DIRECTORY
}

export interface IFileStat {

	/**
	 * The type of the file.
	 */
	readonly type: FileType;

	/**
	 * The creation date in milliseconds.
	 */
	readonly createTime: number;

	/**
	 * The last modified date in milliseconds.
	 */
	readonly modifyTime: number;

	/**
	 * The size of the target in byte.
	 */
	readonly byteSize: number;

	/**
	 * If the target is readonly.
	 */
	readonly readonly?: boolean;
}

export interface IResolvedFileStat extends IFileStat {

	/**
	 * The name of the target.
	 */
	readonly name: string;

	/**
	 * The {@link URI} of the target.
	 */
	readonly uri: URI;

	/**
	 * If the target is readonly.
	 */
	readonly readonly: boolean;

	/**
	 * The direct children of the target.
	 */
	readonly children?: Iterable<IResolvedFileStat>;
}

/** @description the base interface for any other FileSystemProvider. */
export interface IFileSystemProvider extends IDisposable {

	readonly capabilities: FileSystemProviderCapability;
	readonly onDidResourceChange: Register<IRawResourceChangeEvents>;
	readonly onDidResourceClose: Register<URI>;

	watch(uri: URI, opts?: IWatchOptions): Promise<IDisposable>;

	stat(uri: URI): Promise<IFileStat>;
	mkdir(uri: URI): Promise<void>;
	readdir(uri: URI): Promise<[string, FileType][]>;
	delete(uri: URI, opts: IDeleteFileOptions): Promise<void>;

	rename(from: URI, to: URI, opts: IOverwriteFileOptions): Promise<void>;
	copy?(from: URI, to: URI, opts: IOverwriteFileOptions): Promise<void>;

	readFile?(uri: URI): Promise<Uint8Array>;
	writeFile?(uri: URI, content: Uint8Array, opts: IWriteFileOptions): Promise<void>;

	readFileStream?(uri: URI, opt?: IReadFileOptions): IReadyReadableStream<Uint8Array>;

	open?(uri: URI, opts?: IOpenFileOptions): Promise<number>;
	close?(fd: number): Promise<void>;
	read?(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;
	write?(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;
}

/*******************************************************************************
 * FileSystemProviders Types
 ******************************************************************************/

export const enum FileSystemProviderCapability {
	/** Provider supports unbuffered read/write. */
	FileReadWrite = 1 << 1,

	/** Provider supports open/read/write/close low level file operations. */
	FileOpenReadWriteClose = 1 << 2,

	/** Provider supports copy operation. */
	FileFolderCopy = 1 << 3,

	/** Provider is path case sensitive. */
	PathCaseSensitive = 1 << 4,

	/** Provider supports stream based reading. */
	ReadFileStream = 1 << 5,

	/** Provider only supports reading. */
	Readonly = 1 << 6,
}

/*******************************************************************************
 * Specific FileSystemProviders
 ******************************************************************************/

/** @readonly Corresponds to FileSystemProviderCapability.FileReadWrite */
export interface IFileSystemProviderWithFileReadWrite extends IFileSystemProvider {
	readFile(uri: URI): Promise<Uint8Array>;
	writeFile(uri: URI, content: Uint8Array, opts: IWriteFileOptions): Promise<void>;
}

/** @readonly Corresponds to FileSystemProviderCapability.FileOpenReadWriteClose */
export interface IFileSystemProviderWithOpenReadWriteClose extends IFileSystemProvider {
	open(uri: URI, opts: IOpenFileOptions): Promise<number>;
	close(fd: number): Promise<void>;
	read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;
	write(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;
}

/** @readonly Corresponds to FileSystemProviderCapability.FileFolderCopy */
export interface IFileSystemProviderWithCopy extends IFileSystemProvider {
	copy(from: URI, to: URI, opts: IOverwriteFileOptions): Promise<void>;
}

export interface IFileSystemProviderWithReadFileStream extends IFileSystemProvider {
	readFileStream(uri: URI, opt?: IReadFileOptions): IReadyReadableStream<Uint8Array>;
}

export type FileSystemProviderAbleToRead =
	IFileSystemProviderWithFileReadWrite |
	IFileSystemProviderWithOpenReadWriteClose;

/*******************************************************************************
 * FileSystemProvider Capability Validation Helper Functions
 ******************************************************************************/

export function hasReadWriteCapability(provider: IFileSystemProvider): provider is IFileSystemProviderWithFileReadWrite {
	return !!(provider.capabilities & FileSystemProviderCapability.FileReadWrite);
}

export function hasOpenReadWriteCloseCapability(provider: IFileSystemProvider): provider is IFileSystemProviderWithOpenReadWriteClose {
	return !!(provider.capabilities & FileSystemProviderCapability.FileOpenReadWriteClose);
}

export function hasCopyCapability(provider: IFileSystemProvider): provider is IFileSystemProviderWithCopy {
	return !!(provider.capabilities & FileSystemProviderCapability.FileFolderCopy);
}

export function hasReadFileStreamCapability(provider: IFileSystemProvider): provider is IFileSystemProviderWithReadFileStream {
	return !!(provider.capabilities & FileSystemProviderCapability.ReadFileStream);
}

/*******************************************************************************
 * Options
 ******************************************************************************/

export interface IOpenFileOptions {
	/**
	 * false: file should be opened for reading.
	 * true:file should be opened for reading and writing.
	 */
	readonly create: boolean;

	/**
	 * Set to `true` to try to remove any write locks the file might
	 * have. A file that is write locked will throw an error for any
	 * attempt to write to unless `unlock: true` is provided.
	 */
	readonly unlock?: boolean;
}

export interface IReadFileOptions {
	/**
	 * Is an integer specifying where to begin reading from in the file. If 
	 * position is undefined, data will be read from the current file position.
	 */
	readonly position?: number;

	/**
	 * Is an integer specifying how many bytes to read from the file. By default, 
	 * all bytes will be read.
	 */
	readonly length?: number;

	/**
	 * If provided, the size of the file will be checked against the limits.
	 */
	limits?: {
		readonly size?: number;
		readonly memory?: number;
	};
}

export interface IOverwriteFileOptions {
	/**
	 * Set to `true` to overwrite a file if it exists. Will
	 * throw an error otherwise if the file does exist.
	 * @default false
	 */
	readonly overwrite?: boolean;
}

export interface ICreateFileOptions extends Partial<IOverwriteFileOptions> { }

export interface IWriteFileOptions extends IOverwriteFileOptions {
	/**
	 * Set to `true` to create a file when it does not exist. Will
	 * throw an error otherwise if the file does not exist.
	 */
	readonly create: boolean;

	/**
	 * Set to `true` to try to remove any write locks the file might
	 * have. A file that is write locked will throw an error for any
	 * attempt to write to unless `unlock: true` is provided.
	 */
	readonly unlock?: boolean;
}

export interface IDeleteFileOptions {
	/**
	 * Set to `true` to recursively delete any children of the file. This
	 * only applies to folders and can lead to an error unless provided
	 * if the folder is not empty.
	 */
	readonly recursive?: boolean;

	/**
	 * Set to `true` to attempt to move the file to trash
	 * instead of deleting it permanently from disk. This
	 * option maybe not be supported on all providers.
	 */
	readonly useTrash?: boolean;
}

export interface ICreateReadStreamOptions extends IReadFileOptions {
	/**
	 * The size of the buffer to use before sending to the stream.
	 */
	bufferSize: number;
}

export interface IWatchOptions {
	/**
	 * Watch the target recursively if it is a directory.
	 */
	readonly recursive?: boolean;

	/**
	 * A set of glob patterns or paths to exclude from watching.
	 */
	readonly exclude?: RegExp[];
}

export interface IResolveStatOptions {

	/**
	 * Resolves the stat of the direct children.
	 * @default false
	 */
	readonly resolveChildren?: boolean;

	/**
	 * Resolves the stat of all the descendants.
	 * @default false
	 */
	readonly resolveChildrenRecursive?: boolean;
}

/*******************************************************************************
 * Error Handling
 ******************************************************************************/

export const enum FileOperationErrorType {
	FILE_EXCEEDS_MEMORY_LIMIT,
	FILE_TOO_LARGE,
	FILE_EXISTS,
	FILE_NOT_FOUND,
	FILE_IS_DIRECTORY,
	FILE_IS_NOT_DIRECTORY,
	FILE_INVALID_PATH,
	FILE_READONLY,
	NO_PERMISSIONS,
	UNKNOWN,
	OTHERS,
}

function convertFileOperationErrorToString(type: FileOperationErrorType): string {
	switch (type) {
		case FileOperationErrorType.FILE_EXCEEDS_MEMORY_LIMIT: return 'FILE_EXCEEDS_MEMORY_LIMIT';
		case FileOperationErrorType.FILE_TOO_LARGE: return 'FILE_TOO_LARGE';
		case FileOperationErrorType.FILE_EXISTS: return 'FILE_EXISTS';
		case FileOperationErrorType.FILE_NOT_FOUND: return 'FILE_NOT_FOUND';
		case FileOperationErrorType.FILE_IS_DIRECTORY: return 'FILE_IS_DIRECTORY';
		case FileOperationErrorType.FILE_IS_NOT_DIRECTORY: return 'FILE_IS_NOT_DIRECTORY';
		case FileOperationErrorType.FILE_INVALID_PATH: return 'FILE_INVALID_PATH';
		case FileOperationErrorType.FILE_READONLY: return 'FILE_READONLY';
		case FileOperationErrorType.UNKNOWN: return 'UNKNOWN';
		default: return 'UNKNOWN';
	}
}

export class FileSystemProviderError extends Error {
	public readonly operation: string;
	constructor(
		message: string,
		public readonly code: FileOperationErrorType,
	) {
		super(message);
		this.operation = convertFileOperationErrorToString(code);
	}
}

export class FileOperationError extends Error {
	public readonly operation: string;
	constructor(
		message: string,
		public readonly code: FileOperationErrorType,
		public readonly nestedError?: unknown
	) {
		super(message);
		this.operation = convertFileOperationErrorToString(code);
	}
}

