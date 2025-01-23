import { Disposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";

export const ILogService = createService<ILogService>('log-service');
export const DEFAULT_LOG_LEVEL = LogLevel.INFO;

export interface ILogEvent {
    readonly level: LogLevel;
    readonly message: string;
    readonly error?: Error;
    readonly additional?: Additional;
}

/**
 * A function type that mock the logger.
 */
export type ILog = (level: LogLevel, reporter: string, message: string, error?: any, additional?: Additional) => void;

/**
 * Representing the maximum logging level of a {@link ILoggerService} or
 * {@link ILogger}.
 */
export const enum LogLevel {
    /**
     * The most fine-grained information only used in rare cases where you need 
     * the full visibility of what is happening in your application and inside 
     * the third-party libraries that you use. You can expect the TRACE logging 
     * level to be very verbose.
     */
    TRACE = 0,

    /**
     * Less granular compared to the TRACE level, but it is more than you will 
     * need in everyday use. The DEBUG log level should be used for information 
     * that may be needed for diagnosing issues and troubleshooting or when 
     * running application in the test environment for the purpose of making 
     * sure everything is running correctly.
     */
    DEBUG = 1,

    /**
     * The standard log level indicating that something happened, such as the 
     * application entered a certain state. The information logged using the 
     * INFO log level should be purely informative and not looking into them on 
     * a regular basis should not result in missing any important information.
     */
    INFO = 2,

    /**
     * The log level that indicates some unexpected things happened somewhere in 
     * the application that might disturb one of the functionality. But that 
     * does not mean that the application failed. The WARN level should be used 
     * in situations that are unexpected, but the code may still the work.
     */
    WARN = 3,

    /**
     * The log level should be used when the application hits an issue that 
     * prevents one or more functionalities from properly functioning, but it 
     * either has other options to fix such failure or, the fundamental and 
     * basic functionalities of the application can still work.
     */
    ERROR = 4,

    /**
     * One or more key functionalities are not working and the whole system 
     * does not achieve the basic requirement to run as normal. Application may
     * crash in any seconds.
     */
    FATAL = 5
}

export interface ILoggable {
    log(message: string, ...args: any[]): void;
}

/**
 * A {@link IAbstractLogger} provides ability to set the current {@link LogLevel}
 * of this logger.
 */
export interface IAbstractLogger extends Disposable {
    /**
     * Fires when the level of the logger changes.
     */
    readonly onDidChangeLevel: Register<LogLevel>;

    /**
     * @description Sets the current {@link LogLevel}.
     */
    setLevel(level: LogLevel): void;

    /**
     * @description Returns the current log level.
     */
    getLevel(): LogLevel;
}

/**
 * @class The base class of each {@link ILogger}. Provides functionalities 
 * relates to log level.
 * 
 * @default level {@link DEFAULT_LOG_LEVEL}.
 */
export abstract class AbstractLogger extends Disposable implements IAbstractLogger {

    declare _serviceMarker: undefined;
    private _level!: LogLevel;

    private readonly _emitter = this.__register(new Emitter<LogLevel>());
    public readonly onDidChangeLevel = this._emitter.registerListener;

    constructor(level: LogLevel = DEFAULT_LOG_LEVEL) {
        super();
        this.setLevel(level);
    }

    public setLevel(level: LogLevel): void {
        if (this._level !== level) {
            this._level = level;
            this._emitter.fire(level);
        }
    }

    public getLevel(): LogLevel {
        return this._level;
    }
}

/**
 * {@link ILogger} prints those data types in a prettier way.
 */
export type PrettyTypes = string | boolean | number | null | undefined | object | Array<any> | Error;
export type Additional = {
    [key: string]: PrettyTypes;
};

/**
 * A {@link ILogger} is an instance that able to handle a series of incoming 
 * logging messages. 
 * 
 * @note Generally created by a {@link ILoggerService}.
 * @note Any logging level BELOW the current level will be ignored.
 */
export interface ILogger extends IAbstractLogger {

    /**
     * @description Provides a collections of logging ways.
     * @param reporter The name of the reporter (module or component) generating the log.
     * @param message The message for logging.
     * @param additional Additional data to log, formatted prettily.
     */
    trace(reporter: string, message: string, additional?: Additional): void;
    debug(reporter: string, message: string, additional?: Additional): void;
    info(reporter: string, message: string, additional?: Additional): void;
    warn(reporter: string, message: string, additional?: Additional): void;
    error(reporter: string, message: string, error?: any, additional?: Additional): void;
    fatal(reporter: string, message: string, error?: any, additional?: Additional): void;
    flush(): Promise<void>;
}

/** 
 * Alias for a {@link ILogger}. May be registered into a {@link IInstantiationService}.
 */
export interface ILogService extends ILogger, IService { }

/**
 * An option for constructing {@link ILogger}.
 */
export interface ILoggerOpts {

    /**
     * The description of the logger.
     */
    readonly description?: string;

    /**
     * Always log the messages and will ignore {@link LogLevel}.
     */
    readonly alwaysLog?: boolean;
}

export function parseLogLevel(level: LogLevel): string {
    switch (level) {
        case LogLevel.FATAL: return 'FATAL';
        case LogLevel.ERROR: return 'ERROR';
        case LogLevel.WARN: return 'WARN';
        case LogLevel.INFO: return 'INFO';
        case LogLevel.DEBUG: return 'DEBUG';
        case LogLevel.TRACE: return 'TRACE';
    }
}

export function parseToLogLevel(str?: string): LogLevel {
    if (!str) {
        return LogLevel.INFO;
    }

    switch (str.toUpperCase()) {
        case 'FATAL': return LogLevel.FATAL;
        case 'ERROR': return LogLevel.ERROR;
        case 'WARN': return LogLevel.WARN;
        case 'INFO': return LogLevel.INFO;
        case 'DEBUG': return LogLevel.DEBUG;
        case 'TRACE': return LogLevel.TRACE;
        default: return LogLevel.INFO;
    }
}

/**
 * @class A simple integrated {@link ILogger} that combines the other loggers
 * into a integrated version. The loggers will be invoked by their adding 
 * order.
 */
export class PipelineLogger extends AbstractLogger implements ILogService {

    private readonly _loggers: ILogger[];

    constructor(loggers: ILogger[]) {
        super();

        this._loggers = loggers;
        for (const logger of loggers) {
            this.__register(logger);
        }
    }

    public add(logger: ILogger): void {
        this._loggers.push(logger);
    }

    public trace(reporter: string, message: string, additional?: Additional): void {
        for (const logger of this._loggers) {
            logger.trace(reporter, message, additional);
        }
    }

    public debug(reporter: string, message: string, additional?: Additional): void {
        for (const logger of this._loggers) {
            logger.debug(reporter, message, additional);
        }
    }

    public info(reporter: string, message: string, additional?: Additional): void {
        for (const logger of this._loggers) {
            logger.info(reporter, message, additional);
        }
    }

    public warn(reporter: string, message: string, additional?: Additional): void {
        for (const logger of this._loggers) {
            logger.warn(reporter, message, additional);
        }
    }

    public error(reporter: string, message: string, error?: any, additional?: Additional): void {
        for (const logger of this._loggers) {
            logger.error(reporter, message, error, additional);
        }
    }

    public fatal(reporter: string, message: string, error?: any, additional?: Additional): void {
        for (const logger of this._loggers) {
            logger.fatal(reporter, message, error, additional);
        }
    }

    public async flush(): Promise<void> {
        for (const logger of this._loggers) {
            await logger.flush();
        }
    }
}

export type BufferLoggerBufferType = { level: LogLevel, reporter: string, message: string, error?: any, additional?: Additional; };

/**
 * @description Buffer logger may wraps another {@link ILogger} at anytime. If
 * there is no provided logger, the logging message will be stored in the buffer
 * and will be flushed once there is a logger has been set.
 */
export class BufferLogger extends AbstractLogger implements ILogService {

    protected readonly _buffer: BufferLoggerBufferType[] = [];
    private _logger?: ILogger;

    constructor() {
        super();
    }

    public setLogger(logger: ILogger): void {
        if (this._logger) {
            this.release(this._logger);
        }
        this._logger = this.__register(logger);
        this.__tryFlushBuffer();
    }

    public getLogger(): ILogger | undefined {
        return this._logger;
    }

    public trace(reporter: string, message: string, additional?: Additional): void {
        this.__log(LogLevel.TRACE, reporter, message, undefined, additional);
    }

    public debug(reporter: string, message: string, additional?: Additional): void {
        this.__log(LogLevel.DEBUG, reporter, message, undefined, additional);
    }

    public info(reporter: string, message: string, additional?: Additional): void {
        this.__log(LogLevel.INFO, reporter, message, undefined, additional);
    }

    public warn(reporter: string, message: string, additional?: Additional): void {
        this.__log(LogLevel.WARN, reporter, message, undefined, additional);
    }

    public error(reporter: string, message: string, error?: any, additional?: Additional): void {
        this.__log(LogLevel.ERROR, reporter, message, error, additional);
    }

    public fatal(reporter: string, message: string, error?: any, additional?: Additional): void {
        this.__log(LogLevel.FATAL, reporter, message, error, additional);
    }

    public async flush(): Promise<void> {
        this.__tryFlushBuffer();
        return this._logger?.flush();
    }

    // [protected helper methods]

    protected __log(level: LogLevel, reporter: string, message: string, error?: any, additional?: Additional): void {
        this._buffer.push({ level: level, reporter, message, error, additional });
        this.__tryFlushBuffer();
    }

    protected __tryFlushBuffer(): void {
        const logger = this._logger;
        if (!logger) {
            return;
        }
        
        for (const { level, reporter, message, error, additional } of this._buffer) {
            defaultLog(logger, level, reporter, message, error, additional);
        }
        this._buffer.length = 0;
    }
}

export function defaultLog(logger: ILogger, level: LogLevel, reporter: string, message: string, error?: any, additional?: Additional): void {
    switch (level) {
        case LogLevel.TRACE:
            logger.trace(reporter, message, additional);
            break;
        case LogLevel.DEBUG:
            logger.debug(reporter, message, additional);
            break;
        case LogLevel.INFO:
            logger.info(reporter, message, additional);
            break;
        case LogLevel.WARN:
            logger.warn(reporter, message, additional);
            break;
        case LogLevel.ERROR:
            logger.error(reporter, message, error, additional);
            break;
        case LogLevel.FATAL:
            logger.fatal(reporter, message, error, additional);
            break;
    }
}