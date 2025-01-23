import * as electron from 'electron';
import * as net from 'net';
import { mkdir, unlink } from 'fs/promises';
import { ErrorHandler, ExpectedError, isExpectedError, tryOrDefault } from 'src/base/common/error';
import { Event } from 'src/base/common/event';
import { Schemas, URI } from 'src/base/common/files/uri';
import { BufferLogger, ILogService, LogLevel, PipelineLogger } from 'src/base/common/logger';
import { Strings } from 'src/base/common/utilities/string';
import { DiskFileSystemProvider } from 'src/platform/files/node/diskFileSystemProvider';
import { FileService, IFileService } from 'src/platform/files/common/fileService';
import { IInstantiationService, InstantiationService, IServiceProvider } from 'src/platform/instantiation/common/instantiation';
import { ServiceCollection } from 'src/platform/instantiation/common/serviceCollection';
import { ILoggerService } from 'src/platform/logger/common/abstractLoggerService';
import { ConsoleLogger } from 'src/platform/logger/common/consoleLoggerService';
import { FileLoggerService } from 'src/platform/logger/common/fileLoggerService';
import { ApplicationInstance } from 'src/code/electron/app';
import { ApplicationMode, IEnvironmentOpts, IEnvironmentService, IMainEnvironmentService } from 'src/platform/environment/common/environment';
import { MainEnvironmentService } from 'src/platform/environment/electron/mainEnvironmentService';
import { IMainLifecycleService, MainLifecycleService } from 'src/platform/lifecycle/electron/mainLifecycleService';
import { IMainStatusService, MainStatusService } from 'src/platform/status/electron/mainStatusService';
import { ICLIArguments } from 'src/platform/environment/common/argument';
import { ProcessKey } from 'src/base/common/process';
import { getFormatCurrTimeStamp } from 'src/base/common/date';
import { Blocker, EventBlocker } from 'src/base/common/utilities/async';
import { APP_CONFIG_NAME, IConfigurationService } from 'src/platform/configuration/common/configuration';
import { IProductService, ProductService } from 'src/platform/product/common/productService';
import { MainConfigurationService } from 'src/platform/configuration/electron/mainConfigurationService';
import { IRegistrantService, RegistrantService } from 'src/platform/registrant/common/registrantService';
import { ConfigurationRegistrant } from 'src/platform/configuration/common/configurationRegistrant';
import { ReviverRegistrant } from 'src/platform/ipc/common/revive';
import { panic } from "src/base/common/utilities/panic";
import { IS_WINDOWS } from 'src/base/common/platform';
import { DiagnosticsService } from 'src/platform/diagnostics/electron/diagnosticsService';
import { IDiagnosticsService } from 'src/platform/diagnostics/common/diagnostics';
import { toBoolean } from 'src/base/common/utilities/type';
import { Disposable, monitorDisposableLeak } from 'src/base/common/dispose';

interface IMainProcess {
    start(argv: ICLIArguments): Promise<void>;
}

/**
 * @class The first entry of the application (except `main.js`). Responsible for 
 * three things:
 *      1. Initializations on core microservices of the application.
 *      2. Important disk directory preparation.
 *      3. Ensuring that this process is the only one running. If not, it 
 *         terminates as expected.
 */
const main = new class extends class MainProcess extends Disposable implements IMainProcess {

    // [field]

    private readonly instantiationService!: IInstantiationService;
    private readonly environmentService!: IMainEnvironmentService;
    private readonly fileService!: IFileService;
    private readonly productService!: IProductService;
    private readonly configurationService!: IConfigurationService;
    private readonly logService!: ILogService;
    private readonly lifecycleService!: IMainLifecycleService;
    private readonly statusService!: IMainStatusService;
    private readonly diagnosticsService!: IDiagnosticsService;
    private readonly CLIArgv!: ICLIArguments;

    // [constructor]

    constructor() {
        super();
    }

    // [public methods]

    public async start(argv: ICLIArguments): Promise<void> {
        (<any>this.CLIArgv) = this.__parseCLIArgv(argv);
        try {
            ErrorHandler.setUnexpectedErrorExternalCallback(err => console.error(err));
            await this.run();
        } catch (unexpectedError: any) {
            console.error(unexpectedError, unexpectedError.message ?? 'unknown error message');
            electron.app.exit(1);
        }
    }

    // [private methods]

    private async run(): Promise<void> {

        /**
         * No error tolerance at this stage since all the work here is 
         * necessary for future works.
         */

        monitorDisposableLeak(toBoolean(this.CLIArgv.disposableLeakWarning));

        // core services
        this.createCoreServices();

        try {

            // initialization
            try {
                await this.initServices();
            } catch (error) {
                // FIX: could be errors other than directory-related
                this.__showDirectoryErrorDialog(error);
                panic(error);
            }

            // application run
            {
                Event.onceSafe(this.lifecycleService.onWillQuit)(e => {
                    // release all the watching resources
                    e.join(new EventBlocker(this.fileService.onDidAllResourceClosed).waiting());
                    this.fileService.dispose();
                });

                await this.resolveSingleApplication(true);

                const instance = this.__register(this.instantiationService.createInstance(ApplicationInstance));
                await instance.run();
            }
        }
        catch (error: any) {
            this.kill(error);
        }
    }

    /**
     * @description The very basic services that need to be created before 
     * everything.
     */
    private createCoreServices(): void {

        // dependency injection (DI)
        const instantiationService = this.__register(new InstantiationService(new ServiceCollection(), undefined));
        instantiationService.store(IInstantiationService, instantiationService);

        // log-service
        const logService = new BufferLogger();
        instantiationService.store(ILogService, logService);

        logService.debug('MainProcess', 'Start constructing core services...');
        logService.info('MainProcess', 'Command line arguments:', { CLI: this.CLIArgv });

        // registrant-service
        const registrantService = instantiationService.createInstance(RegistrantService);
        instantiationService.store(IRegistrantService, registrantService);

        this.initRegistrant(instantiationService, registrantService);

        // file-service
        const fileService = new FileService(logService);
        fileService.registerProvider(Schemas.FILE, new DiskFileSystemProvider(logService));
        instantiationService.store(IFileService, fileService);

        // product-service
        const productService = new ProductService(fileService, logService);
        instantiationService.store(IProductService, productService);

        // diagnostics-service
        const diagnosticsService = new DiagnosticsService(productService);
        instantiationService.store(IDiagnosticsService, diagnosticsService);

        // environment-service
        const environmentService = new MainEnvironmentService(this.CLIArgv, this.__getEnvInfo(), logService, productService);
        instantiationService.store(IEnvironmentService, environmentService);

        // logger-service
        const fileLoggerService = new FileLoggerService(environmentService.logLevel, instantiationService);
        instantiationService.store(ILoggerService, fileLoggerService);

        // pipeline-logger
        const pipelineLogger = new PipelineLogger([
            // console-logger
            new ConsoleLogger(environmentService.mode === ApplicationMode.DEVELOP ? environmentService.logLevel : LogLevel.WARN),
            // file-logger
            fileLoggerService.createLogger(
                URI.join(environmentService.logPath, `main-${getFormatCurrTimeStamp()}.txt`), 
                { 
                    description: 'main'
                }
            ),
        ]);
        logService.setLogger(pipelineLogger);

        // life-cycle-service
        const lifecycleService = new MainLifecycleService(logService);
        instantiationService.store(IMainLifecycleService, lifecycleService);

        // main-configuration-service
        const configurationService = instantiationService.createInstance(
            MainConfigurationService,
            { 
                appConfiguration: { 
                    path: URI.join(environmentService.appConfigurationPath, APP_CONFIG_NAME), 
                } 
            },
        );
        instantiationService.store(IConfigurationService, configurationService);

        // status-service
        const statusService = new MainStatusService(fileService, logService, environmentService, lifecycleService);
        instantiationService.store(IMainStatusService, statusService);

        (<any>this.instantiationService) = instantiationService;
        (<any>this.environmentService) = environmentService;
        (<any>this.fileService) = fileService;
        (<any>this.productService) = productService;
        (<any>this.configurationService) = configurationService;
        (<any>this.logService) = logService;
        (<any>this.lifecycleService) = lifecycleService;
        (<any>this.statusService) = statusService;
        (<any>this.diagnosticsService) = diagnosticsService;
        
        this.logService.debug('MainProcess', 'All core services are constructed.');
    }

    /**
     * @description Some services need to be initialized asynchronously once the 
     * services are created.
     */
    private async initServices(): Promise<any> {
        this.logService.debug('MainProcess', 'Start initializing core services...');

        /**
        * At the very beginning state of the program, we need to initialize
        * all the necessary directories first. We need to ensure each one 
        * is created successfully.
        */

        await Promise.all(
           [
               this.environmentService.logPath,
               this.environmentService.appConfigurationPath,
               this.environmentService.userDataPath,
           ]
           .map(path => mkdir(URI.toFsPath(path), { recursive: true })),
       );

        await this.productService.init(this.environmentService.productProfilePath)
            .andThen(() => this.statusService.init())
            .andThen(() => this.configurationService.init())
            .unwrap();

        this.logService.debug('MainProcess', 'All core services are initialized successfully.');
        this.logService.debug('MainProcess', `System Information:`, this.diagnosticsService.getDiagnostics());
        this.logService.debug('DiskEnvironmentService', `Disk Environment loaded.`, this.environmentService.inspect());
    }

    private initRegistrant(service: IInstantiationService, registrant: IRegistrantService): void {
        
        /**
         * DO NOT change the registration orders, orders does matter here.
         */
        registrant.registerRegistrant(service.createInstance(ConfigurationRegistrant));
        registrant.registerRegistrant(service.createInstance(ReviverRegistrant));

        registrant.init(service);
    }

    private async resolveSingleApplication(retry: boolean): Promise<void> {
        this.logService.debug('MainProcess', `Resolving application by listening to pipe (${this.environmentService.mainIpcHandle})...`);

        try {
            /**
             * Every newly opened application will try to listen to the same 
             * socket file or pipe. If an error is caught with code `EADDRINUSE`, 
             * it means there is already an application is running, we should 
             * terminate since we only accept one single application.
             */
            const server = await new Promise<net.Server>((resolve, reject) => {
                const tcpServer = net.createServer();
                tcpServer.on('error', reject);
                tcpServer.listen(this.environmentService.mainIpcHandle, () => {
                    tcpServer.removeListener('error', reject);
                    resolve(tcpServer);
                });
            });
            Event.onceSafe(this.lifecycleService.onWillQuit)(async p => {
                const blocker = new Blocker<void>();
                server.close(() => blocker.resolve());
                p.join(blocker.waiting());
            });
        }
        catch (error: any) {
            // unexpected errors
            if (error.code !== 'EADDRINUSE') {
                this.logService.error('MainProcess', 'unexpected error (expect EADDRINUSE)', error);
                panic(error);
            }

            let socket: net.Socket;
            try {
                socket = await new Promise<net.Socket>((resolve, reject) => {
                    const socket = net.createConnection(this.environmentService.mainIpcHandle, () => {
                        socket.removeListener('error', reject);
                        resolve(socket);
                    });
                    socket.once('error', reject);
                });
            } catch (error: any) {

                // Handle unexpected connection errors by showing a dialog to the user
                if (!retry || IS_WINDOWS || error.code !== 'ECONNREFUSED') {
                    electron.dialog.showMessageBoxSync({
                        title: this.productService.profile.applicationName,
                        message: `Another instance of '${this.productService.profile.applicationName}' is already running as administrator`,
                        detail: 'Please close the other instance and try again.',
                        type: 'warning',
                        buttons: ['close'],
                    });
                    panic(error);
                }

                /**
                 * It happens on Linux and OS X that the pipe is left behind.
                 * Delete it and then retry the whole thing.
                 */
                try {
					await unlink(this.environmentService.mainIpcHandle);
				} catch (error) {
					this.logService.error('Main', 'Could not delete obsolete instance handle.', error);
					panic(error);
				}

                // retry one more time
                return this.resolveSingleApplication(false);
            }

            // cleanup
            socket.end();

            // there is a running application, we stop the current application.
            panic(new ExpectedError('There is an application running, we are terminating...'));
        }

        // we are the first running application under the current version.
        this.logService.debug('MainProcess', 'Window resolved successfully. Running as the first application.');
        process.env[ProcessKey.PID] = String(process.pid);
        return;
    }

    private kill(error: Error): void {
        let code = 0;

        if (isExpectedError(error)) {
            if (error.message) {
                this.logService.debug('MainProcess', `Expected error: ${error.message}`);
            }
        }
        else {
            code = 1;
            if (error.stack) {
                this.logService.fatal('MainProcess', 'Unexpected Error', error);
            } else {
                this.logService.fatal('MainProcess', 'Unexpected Error', new Error(`MainProcess process error: ${error.toString()}`));
            }
        }

        this.lifecycleService.kill(code);
    }

    // [private helper methods]

    private __showDirectoryErrorDialog(error: any): void {
        const dir = [
            URI.toFsPath(this.environmentService.appRootPath),
            URI.toFsPath(this.environmentService.logPath),
        ];

        electron.dialog.showMessageBoxSync({
            title: tryOrDefault('Untitled', () => this.productService.profile.applicationName),
            message: 'Unable to write to directories',
            detail: Strings.format('{0}\n\nPlease make sure the following directories are writeable: \n\n{1}', [error.toString?.() ?? error, dir.join('\n')]),
            type: 'warning',
            buttons: ['close'],
        });
    }

    private __getEnvInfo(): IEnvironmentOpts {
        return {
            isPackaged: electron.app.isPackaged,
            userHomePath: electron.app.getPath('home'),
            tmpDirPath: electron.app.getPath('temp'),
            appRootPath: electron.app.getAppPath(),
            userDataPath: electron.app.getPath('userData'),
        };
    }

    /**
     * @description Convert the CLI constructed by the third-library `minimist` 
     * into our desired ones:
     *      1. Make sure no multiple argument values (only take the last one)
     */
    private __parseCLIArgv(argv: ICLIArguments): ICLIArguments {
        for (const key of Object.keys(argv)) {
            if (key === '_') {
                continue;
            }
            const value = argv[key];
            
            // if multiple arguments is provided, we only take the last one.
            const resolvedValue = Array.isArray(value) 
                ? value.at(-1) 
                : value;
            
            // replace with the last one
            argv[key] = resolvedValue;
        }
        
        return argv;
    }
} { }; /** @readonly ❤hello, world!❤ */

export default main;