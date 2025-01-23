import * as assert from 'assert';
import { before } from 'mocha';
import { INSTANT_TIME } from 'src/base/common/date';
import { Schemas, URI } from 'src/base/common/files/uri';
import { LogLevel, parseToLogLevel } from 'src/base/common/logger';
import { delayFor } from 'src/base/common/utilities/async';
import { FileService, IFileService } from 'src/platform/files/common/fileService';
import { InMemoryFileSystemProvider } from 'src/platform/files/common/inMemoryFileSystemProvider';
import { IInstantiationService, InstantiationService } from 'src/platform/instantiation/common/instantiation';
import { IpcChannel } from 'src/platform/ipc/common/channel';
import { IpcServer } from 'src/platform/ipc/electron/ipcServer';
import { ILoggerService } from 'src/platform/logger/common/abstractLoggerService';
import { FileLoggerService } from 'src/platform/logger/common/fileLoggerService';
import { BrowserLoggerChannel, MainLoggerChannel } from 'src/platform/logger/common/loggerChannel';
import { NullLogger, TestIPC } from 'test/utils/testService';

suite('LoggerService', () => {

    function splitLogString(log: string): string[] {
        const parts: string[] = [];
        let temp = "";

        for (let i = 0; i < log.length; i++) {
            if (log[i] === '[') {
                i++;  // Skip the '[' character
                while (log[i] !== ']') {
                    temp += log[i];
                    i++;
                }
                parts.push(temp);
                temp = "";
            }
        }

        // Get the message part after the last ']' 
        const lastBracketPosition = log.lastIndexOf(']');
        if (lastBracketPosition !== -1 && lastBracketPosition < log.length - 1) {
            const customMessage = log.slice(lastBracketPosition + 1).trim();
            if (customMessage.length > 0) {
                parts.push(customMessage);
            }
        }

        return parts;
    }

    function createAssertLogMessage(fileService: IFileService, uri: URI, loggerLogLevel: LogLevel) {

        return async (actualLogLevel: LogLevel, actualReporter: string, message: string): Promise<void> => {
            const raw = ((await fileService.readFile(uri).unwrap())).toString();
            const line = raw.split('\n').slice(-2, -1)[0]!; // retrieve the last line

            const splitted = splitLogString(line);
            splitted.splice(1, 1); // remove timestamp


            const [contentLevel, loggerName, reporter, contentMessage] = splitted;
            assert.strictEqual(loggerName, URI.basename(uri));
            assert.strictEqual(actualReporter, reporter);
            assert.strictEqual(parseToLogLevel(contentLevel?.trim()), actualLogLevel);
            assert.strictEqual(contentMessage, message);
        };
    }

    suite('FileLoggerService', async function () {

        let instantiationService: IInstantiationService;
        let fileService: IFileService;
        let loggerService: FileLoggerService;
        let assertLastLineLogMessage: (actualLogLevel: LogLevel, reporter: string, message: string) => Promise<void>;

        before(async () => {
            instantiationService = new InstantiationService();

            fileService = new FileService(new NullLogger());
            fileService.registerProvider(Schemas.FILE, new InMemoryFileSystemProvider());

            instantiationService.store(IFileService, fileService);

            loggerService = new FileLoggerService(LogLevel.INFO, instantiationService);
            assertLastLineLogMessage = createAssertLogMessage(fileService, URI.fromFile('base/test.log'), LogLevel.INFO);
        });

        test('basics', async () => {
            const logger = loggerService.createLogger(
                URI.join(URI.fromFile('base'), 'test.log'), 
                { description: 'test.log' }
            );
            await logger.waitInitialize();
            assert.ok(await fileService.exist(URI.fromFile('base/test.log')).unwrap());

            await logger.info('info', 'hello');
            await assertLastLineLogMessage(LogLevel.INFO, 'info', 'hello');

            await logger.trace('trace', 'world');
            await assertLastLineLogMessage(LogLevel.INFO, 'info', 'hello');

            await logger.debug('debug', 'world');
            await assertLastLineLogMessage(LogLevel.INFO, 'info', 'hello');

            await logger.warn('warn', 'world');
            await assertLastLineLogMessage(LogLevel.WARN, 'warn', 'world');

            await logger.fatal('fatal', 'again');
            await assertLastLineLogMessage(LogLevel.FATAL, 'fatal', 'again');
        });
    });

    suite('MainLoggerChannel & BrowserLoggerChannel', async () => {

        let instantiationService: IInstantiationService;
        let fileService: IFileService;

        let loggerService: FileLoggerService;
        let browserLoggerService: ILoggerService;
        let assertLastLineLogMessage: (actualLogLevel: LogLevel, reporter: string, message: string) => Promise<void>;

        let server: IpcServer;

        before(async () => {
            instantiationService = new InstantiationService();

            fileService = new FileService(new NullLogger());
            fileService.registerProvider(Schemas.FILE, new InMemoryFileSystemProvider());
            instantiationService.store(IFileService, fileService);
            loggerService = new FileLoggerService(LogLevel.INFO, instantiationService);

            const testServer = new TestIPC.IpcServer();
            server = testServer;
            server.registerChannel(IpcChannel.Logger, new MainLoggerChannel(loggerService));

            const client = testServer.createConnection('client1');
            browserLoggerService = new BrowserLoggerChannel(client.getChannel(IpcChannel.Logger), LogLevel.INFO);

            assertLastLineLogMessage = createAssertLogMessage(fileService, URI.fromFile('base/test.log'), LogLevel.INFO);
        });

        test('basics', async () => {

            // construct logger from client side
            const browserLogger = browserLoggerService.createLogger(
                URI.join(URI.fromFile('base'), 'test.log'), 
                { description: 'test.log' }
            );
            await delayFor(INSTANT_TIME);
            assert.ok((await fileService.exist(URI.fromFile('base/test.log')).unwrap()));
            const mainLogger = loggerService.getLogger(URI.fromFile('base/test.log'));
            assert.ok(mainLogger);

            // log from client side
            browserLogger.info('info', 'hello world');
            await delayFor(INSTANT_TIME);
            await assertLastLineLogMessage(LogLevel.INFO, 'info', 'hello world');

            // ignore log from client side
            browserLogger.trace('trace', 'hello world again');
            await delayFor(INSTANT_TIME);
            await assertLastLineLogMessage(LogLevel.INFO, 'info', 'hello world');
        });
    });
});