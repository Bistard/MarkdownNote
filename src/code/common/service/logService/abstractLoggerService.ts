import { Disposable } from "src/base/common/dispose";
import { URI } from "src/base/common/file/uri";
import { DEFAULT_LEVEL, ILogger, ILoggerOpts, LogLevel } from "src/base/common/logger";
import { createDecorator } from "src/code/common/service/instantiationService/decorator";

export const ILoggerService = createDecorator<ILoggerService>('logger-service');

/**
 * A {@link ILoggerService} provides ability to create or get {@link ILogger}
 * which has the actual ability to log messages.
 */
export interface ILoggerService {

    /**
     * @description Create a new {@link ILogger}. It overrides the previous 
     * logger if already existed.
     * @param uri The linked {@link URI} for the logger.
     * @param opts The option for construction of the logger.
     */
    createLogger(uri: URI, opts: ILoggerOpts): ILogger;

    /**
     * @description Get an existed {@link ILogger} if any.
     */
    getLogger(uri: URI): ILogger | undefined;
}

/**
 * @class The base class for each {@link ILoggerService}. The default log level
 * is {@link DEFAULT_LEVEL}.
 */
export abstract class AbstractLoggerService extends Disposable implements ILoggerService {

    // [field]

    /** determines the log level of the created logger. */
    private _level: LogLevel;
    private _loggers: Map<string, ILogger>;

    // [constructor]

    constructor(level: LogLevel = DEFAULT_LEVEL) {
        super();
        this._level = level;
        this._loggers = new Map();
    }

    // [abstract method]

    protected abstract __doCreateLogger(uri: URI, level: LogLevel, opts: ILoggerOpts): ILogger;

    // [public methods]

    public createLogger(uri: URI, opts: ILoggerOpts): ILogger {
        const newLogger = this.__doCreateLogger(uri, opts.alwaysLog ? LogLevel.TRACE : this._level, opts);
        const oldLogger = this.getLogger(uri);
        if (oldLogger) {
            oldLogger.dispose();
        }

        this._loggers.set(uri.toString(), newLogger);
        return newLogger;
    }

    public getLogger(uri: URI): ILogger | undefined {
        return this._loggers.get(uri.toString());
    } 

    public override dispose(): void {
        for (const [uri, logger] of this._loggers) {
            logger.dispose();
        }
        this._loggers.clear();
        super.dispose();
    }
}
