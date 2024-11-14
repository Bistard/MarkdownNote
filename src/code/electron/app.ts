import * as electron from "electron";
import type { IWindowInstance } from "src/platform/window/electron/windowInstance";
import { Disposable } from "src/base/common/dispose";
import { ErrorHandler } from "src/base/common/error";
import { Event } from "src/base/common/event";
import { ILogService } from "src/base/common/logger";
import { getUUID } from "src/base/node/uuid";
import { IFileService } from "src/platform/files/common/fileService";
import { ServiceDescriptor } from "src/platform/instantiation/common/descriptor";
import { IInstantiationService, IServiceProvider } from "src/platform/instantiation/common/instantiation";
import { IEnvironmentService, IMainEnvironmentService } from "src/platform/environment/common/environment";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { ProxyChannel } from "src/platform/ipc/common/proxy";
import { IMainLifecycleService, LifecyclePhase } from "src/platform/lifecycle/electron/mainLifecycleService";
import { StatusKey } from "src/platform/status/common/status";
import { IMainStatusService } from "src/platform/status/electron/mainStatusService";
import { IMainWindowService, MainWindowService } from "src/platform/window/electron/mainWindowService";
import { ILoggerService } from "src/platform/logger/common/abstractLoggerService";
import { MainLoggerChannel } from "src/platform/logger/common/loggerChannel";
import { IMainDialogService, MainDialogService } from "src/platform/dialog/electron/mainDialogService";
import { MainHostService } from "src/platform/host/electron/mainHostService";
import { IHostService } from "src/platform/host/common/hostService";
import { DEFAULT_HTML } from "src/platform/window/common/window";
import { URI } from "src/base/common/files/uri";
import { MainFileChannel } from "src/platform/files/electron/mainFileChannel";
import { UUID } from "src/base/common/utilities/string";
import { IpcServer } from "src/platform/ipc/electron/ipcServer";
import { IRegistrantService } from "src/platform/registrant/common/registrantService";
import { IScreenMonitorService, ScreenMonitorService } from "src/platform/screen/electron/screenMonitorService";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { WorkbenchConfiguration } from "src/workbench/services/workbench/configuration.register";
import { toBoolean } from "src/base/common/utilities/type";
import { IProductService } from "src/platform/product/common/productService";

/**
 * An interface only for {@link ApplicationInstance}
 */
export interface IApplicationInstance {
    run(): Promise<void>;
}

/**
 * @class The main class of the application. It handles the core business of the 
 * application.
 */
export class ApplicationInstance extends Disposable implements IApplicationInstance {

    // [fields]

    private readonly mainWindowService?: IMainWindowService;

    // [constructor]

    constructor(
        @IInstantiationService private readonly mainInstantiationService: IInstantiationService,
        @IEnvironmentService private readonly environmentService: IMainEnvironmentService,
        @IMainLifecycleService private readonly lifecycleService: IMainLifecycleService,
        @ILogService private readonly logService: ILogService,
        @IFileService private readonly fileService: IFileService,
        @IMainStatusService private readonly statusService: IMainStatusService,
        @IRegistrantService private readonly registrantService: IRegistrantService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @IProductService private readonly productService: IProductService,
    ) {
        super();
        this.registerListeners();
    }

    // [public methods]

    public async run(): Promise<void> {
        this.logService.debug('App', `application starting at '${URI.toString(this.environmentService.appRootPath, true)}'...`);

        // machine ID
        const machineID = this.__getMachineID();
        this.logService.debug('App', `Resolved machine ID (${machineID}).`);

        // application service initialization
        const appInstantiationService = await this.createServices(machineID);

        // create IPC server in the main process
        const ipcServer = this.__register(new IpcServer(this.logService));

        // IPC channel initialization
        this.registerChannels(appInstantiationService, ipcServer);

        // life-cycle-service: READY
        this.lifecycleService.setPhase(LifecyclePhase.Ready);

        // open first window
        const firstWindow = this.openFirstWindow(appInstantiationService);

        // post work
        this.afterFirstWindow(appInstantiationService, firstWindow.id);
    }

    // [private methods]

    private registerListeners(): void {
        Event.once(this.lifecycleService.onWillQuit)(() => this.dispose());

        // interrupt unexpected errors so that the error will not go back to `main.ts`
        process.on('uncaughtException', err => ErrorHandler.onUnexpectedError(err));
        process.on('unhandledRejection', reason => ErrorHandler.onUnexpectedError(reason));
        ErrorHandler.setUnexpectedErrorExternalCallback(err => this.__onUnexpectedError(err));

        electron.app.on('open-file', (event, path) => {
            this.logService.debug('App', `open-file: ${path}`);
            // REVIEW
        });

        electron.app.on('new-window-for-tab', () => {
            // REVIEW
            // this.mainWindowService?.open();
        });
    }

    private async createServices(machineID: UUID): Promise<IInstantiationService> {
        this.logService.debug('App', 'constructing application services...');

        // main-window-service
        this.mainInstantiationService.register(IMainWindowService, new ServiceDescriptor(MainWindowService, [machineID]));

        // dialog-service
        this.mainInstantiationService.register(IMainDialogService, new ServiceDescriptor(MainDialogService, []));

        // host-service
        this.mainInstantiationService.register(IHostService, new ServiceDescriptor(MainHostService, []));

        // screen-monitor-service
        this.mainInstantiationService.register(IScreenMonitorService, new ServiceDescriptor(ScreenMonitorService, []));

        this.logService.debug('App', 'Application services constructed.');
        return this.mainInstantiationService;
    }

    private registerChannels(provider: IServiceProvider, server: Readonly<IpcServer>): void {
        this.logService.debug('App', 'Registering IPC channels...');

        // file-service-channel
        const diskFileChannel = new MainFileChannel(this.logService, this.fileService, this.registrantService);
        server.registerChannel(IpcChannel.DiskFile, diskFileChannel);

        // logger-service-channel
        const loggerService = provider.getService(ILoggerService);
        const loggerChannel = new MainLoggerChannel(loggerService);
        server.registerChannel(IpcChannel.Logger, loggerChannel);

        // host-service-channel
        const hostService = provider.getOrCreateService(IHostService);
        const hostChannel = ProxyChannel.wrapService(hostService);
        server.registerChannel(IpcChannel.Host, hostChannel);

        // dialog-service-channel
        const dialogService = provider.getService(IMainDialogService);
        const dialogChannel = ProxyChannel.wrapService(dialogService);
        server.registerChannel(IpcChannel.Dialog, dialogChannel);

        // ai-service-channel


        this.logService.debug('App', 'IPC channels registered successfully.');
    }

    private openFirstWindow(provider: IServiceProvider): IWindowInstance {
        this.logService.debug('App', 'Opening the first window...');
        const mainWindowService = provider.getOrCreateService(IMainWindowService);

        // retrieve last saved opened window status
        const uriToOpen: URI[] = [];
        const shouldRestore = this.configurationService.get<boolean>(WorkbenchConfiguration.RestorePrevious);
        if (shouldRestore) {
            const lastOpened = this.statusService.get<string>(StatusKey.LastOpenedWorkspace);
            if (lastOpened) {
                uriToOpen.push(URI.parse(lastOpened));
            }
        }

        // open the first window
        const window: IWindowInstance = mainWindowService.open({
            applicationName: this.productService.profile.applicationName,
            CLIArgv: this.environmentService.CLIArguments,
            loadFile: DEFAULT_HTML,
            uriToOpen: uriToOpen,
            displayOptions: {
                frameless: true,
            },
        });

        return window;
    }

    private afterFirstWindow(provider: IServiceProvider, firstWindowID: number): void {
        
        // inspector mode
        if (toBoolean(this.environmentService.CLIArguments.inspector)) {
            this.mainWindowService?.openInspector(firstWindowID);
        }
    }

    // [private helper methods]

    private __getMachineID(): UUID {
        let id = this.statusService.get<string>(StatusKey.MachineIdKey);
        if (!id) {
            id = getUUID();
            this.statusService.set(StatusKey.MachineIdKey, id).unwrap();
        }
        return id;
    }

    private __onUnexpectedError(error: any): void {
        this.logService.error('App', `Uncaught exception occurred.`, error);
    }
}
