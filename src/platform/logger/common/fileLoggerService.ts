import { getCurrTimeStamp } from "src/base/common/date";
import { DataBuffer } from "src/base/common/files/buffer";
import { ByteSize, FileOperationError, FileOperationErrorType } from "src/base/common/files/file";
import { basename, join, parse } from "src/base/common/files/path";
import { URI } from "src/base/common/files/uri";
import { AbstractLogger, ILogger, ILoggerOpts, LogLevel, parseLogLevel } from "src/base/common/logger";
import { AsyncQueue, Blocker } from "src/base/common/utilities/async";
import { Strings } from "src/base/common/utilities/string";
import { IFileService } from "src/platform/files/common/fileService";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { AbstractLoggerService } from "src/platform/logger/common/abstractLoggerService";

/**
 * @class The logger service that able to create a {@link FileLogger} which has
 * ability to write messages into disk.
 */
export class FileLoggerService extends AbstractLoggerService<FileLogger> {

    constructor(
        level: LogLevel,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
    ) {
        super(level);
    }

    protected override __doCreateLogger(uri: URI, level: LogLevel, opts: ILoggerOpts): FileLogger {
        const name = opts.name ?? basename(URI.toString(uri));
        const logger = this.instantiationService.createInstance(
            FileLogger,
            URI.join(uri, name),
            opts.description ?? opts.name ?? 'No Description',
            level,
            opts.noFormatter ?? false
        );
        return logger;
    }
}

export const MAX_LOG_SIZE = 5 * ByteSize.MB;

/**
 * @class The logger has ability to write log into disk. The log writing process
 * is asynchronous and guarantees each log is written in succession.
 * 
 * @note Once the logger created, the corresponding URI will be created into the 
 * disk first.
 * 
 * @note Once the corresponding URI exceeds {@link MAX_LOG_SIZE}, the current
 * content will be rewritten into a new backup URI under the same directory.
 * It is repeatable by incrementing the basename of the URI.
 * 
 * @note Once the application lifecycle ends, the increment on the backup URI 
 * will be reset.
 */
export class FileLogger extends AbstractLogger implements ILogger {

    // [field]

    private readonly _description: string;
    private readonly _uri: URI;
    private readonly _queue: AsyncQueue<void>;
    private readonly _initializing: Blocker<void>;

    private _backupCnt: number;
    private _backupExt: string;
    private readonly _noFormatter: boolean;

    // [cosntructor]

    constructor(
        uri: URI,
        description: string,
        level: LogLevel,
        noFormatter: boolean,
        @IFileService private readonly fileService: IFileService
    ) {
        super(level);
        this._description = description;
        this._uri = uri;

        this._queue = new AsyncQueue();
        this._initializing = new Blocker();

        this._backupCnt = 1;
        this._backupExt = '';
        this._noFormatter = noFormatter;

        const intialize = async () => {
            const result = await this.fileService.createFile(uri, DataBuffer.alloc(0), { overwrite: false });
            if (result.isErr()) {
                // only ignores when the file already exists
                if (result.error.code !== FileOperationErrorType.FILE_EXISTS) {
                    this._initializing.reject(result.error);
                    return;
                }
            }
            
            this._initializing.resolve();
        };

        intialize();
    }

    // [public methods]

    public async waitInitialize(): Promise<void> {
        return this._initializing.waiting();
    }

    public async trace(message: string, ...args: any[]): Promise<void> {
        if (this.getLevel() <= LogLevel.TRACE) {
            return this.__log(LogLevel.TRACE, Strings.stringify(message, ...args));
        }
    }

    public async debug(message: string, ...args: any[]): Promise<void> {
        if (this.getLevel() <= LogLevel.DEBUG) {
            return this.__log(LogLevel.DEBUG, Strings.stringify(message, ...args));
        }
    }

    public async info(message: string, ...args: any[]): Promise<void> {
        if (this.getLevel() <= LogLevel.INFO) {
            return this.__log(LogLevel.INFO, Strings.stringify(message, ...args));
        }
    }

    public async warn(message: string, ...args: any[]): Promise<void> {
        if (this.getLevel() <= LogLevel.WARN) {
            return this.__log(LogLevel.WARN, Strings.stringify(message, ...args));
        }
    }

    public async error(message: string | Error, ...args: any[]): Promise<void> {
        if (this.getLevel() <= LogLevel.ERROR) {
            if (message instanceof Error) {
                message = message.stack!;
                return this.__log(LogLevel.ERROR, Strings.stringify(message, ...args));
            } else {
                return this.__log(LogLevel.ERROR, Strings.stringify(message, ...args));
            }
        }
    }

    public async fatal(message: string | Error, ...args: any[]): Promise<void> {
        if (this.getLevel() <= LogLevel.FATAL) {
            if (message instanceof Error) {
                message = message.stack!;
                return this.__log(LogLevel.FATAL, Strings.stringify(message, ...args));
            } else {
                return this.__log(LogLevel.FATAL, Strings.stringify(message, ...args));
            }
        }
    }

    public async flush(): Promise<void> {
        if (this._queue.size === 0) {
            return;
        }
        const blocker = new Blocker<void>();
        this._queue.onDidFlush(() => blocker.resolve());
        return blocker.waiting();
    }

    // [private helper methods]

    /**
     * @description Logs the given message asynchronously and guarantees process
     * each log in succession.
     * @param level The level of the message.
     * @param message The raw message in string.
     */
    private async __log(level: LogLevel, message: string): Promise<void> {

        // Queue the log asynchronously
        return this._queue.queue(async () => {

            await this._initializing.waiting();

            if (this._noFormatter === false) {
                message = `[${getCurrTimeStamp()}] [${this._description}] [${parseLogLevel(level)}] ${message}\n`;
            }

            let content = ((await this.fileService.readFile(this._uri).unwrap())).toString();
            if (content.length >= MAX_LOG_SIZE) {
                (await this.fileService.writeFile(this.__getBackupURI(), DataBuffer.fromString(content), { create: true, overwrite: true, unlock: true }).unwrap());
                content = '';
            }

            content += message;
            (await this.fileService.writeFile(this._uri, DataBuffer.fromString(content), { create: false, overwrite: true, unlock: true }).unwrap());
        })
        /**
         * If pass the error into the `ErrorHandler`, the error will eventually
         * re-enter this code section since the program will log the error and
         * causes circular calling.
         * 
         * The best way I can think of is to `console.error` out the error.
         */
        .catch(err => {
            console.error(err);
        });
    }

    private __getBackupURI(): URI {
        if (this._backupCnt > 10) {
            this._backupCnt = 1;
            this._backupExt += `_${10}`;
        }

        const oldURI = URI.toFsPath(this._uri);
        const result = parse(oldURI);
        const newURI = URI.fromFile(join(result.dir, `${result.name}${this._backupExt}_${this._backupCnt}${result.ext}`));

        this._backupCnt++;
        return newURI;
    }
}
