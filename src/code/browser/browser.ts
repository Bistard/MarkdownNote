import "src/code/browser/registrant";
import { Workbench } from "src/code/browser/workbench/workbench";
import { IInstantiationService, InstantiationService } from "src/code/platform/instantiation/common/instantiation";
import { getSingletonServiceDescriptors, ServiceCollection } from "src/code/platform/instantiation/common/serviceCollection";
import { waitDomToBeLoad } from "src/base/common/dom";
import { ComponentService, IComponentService } from "src/code/browser/service/componentService";
import { Disposable } from "src/base/common/dispose";
import { ServiceDescriptor } from "src/code/platform/instantiation/common/descriptor";
import { initExposedElectronAPIs } from "src/code/platform/electron/browser/global";
import { IIpcService, IpcService } from "src/code/platform/ipc/browser/ipcService";
import { BrowserLoggerChannel } from "src/code/platform/logger/common/loggerChannel";
import { BufferLogger, ILogService, LogLevel, PipelineLogger } from "src/base/common/logger";
import { ILoggerService } from "src/code/platform/logger/common/abstractLoggerService";
import { IFileService } from "src/code/platform/files/common/fileService";
import { BrowserEnvironmentService } from "src/code/platform/environment/browser/browserEnvironmentService";
import { BrowserFileChannel } from "src/code/platform/files/common/fileChannel";
import { ErrorHandler } from "src/base/common/error";
import { ApplicationMode, IBrowserEnvironmentService } from "src/code/platform/environment/common/environment";
import { ConsoleLogger } from "src/code/platform/logger/common/consoleLoggerService";
import { getFormatCurrTimeStamp } from "src/base/common/date";
import { IConfigService } from "src/code/platform/configuration/common/abstractConfigService";
import { BrowserConfigService } from "src/code/platform/configuration/browser/browserConfigService";
import { ProxyChannel } from "src/code/platform/ipc/common/proxy";
import { IpcChannel } from "src/code/platform/ipc/common/channel";
import { IHostService } from "src/code/platform/host/common/hostService";

/**
 * @class This is the main entry of the renderer process.
 */
export class Browser extends Disposable {

    // [constructor]

    constructor() {
        super();
        this.run();
    }
    
    // [private methods]

    private async run(): Promise<void> {
        ErrorHandler.setUnexpectedErrorExternalCallback((error: any) => console.error(error));

        try {
            initExposedElectronAPIs();

            const instantiaionService = this.createCoreServices();

            await Promise.all([
                this.initServices(instantiaionService),
                waitDomToBeLoad(),
            ]);
        } catch (error) {
            ErrorHandler.onUnexpectedError(error);
        }

        // TODO: workbench

        this.registerListeners();
    }

    private createCoreServices(): IInstantiationService {
        
        // instantiation-service (Dependency Injection)
        const serviceCollection = new ServiceCollection();
        const instantiationService = new InstantiationService(serviceCollection);

        // instantiation-service (itself)
        instantiationService.register(IInstantiationService, instantiationService);

        // log-service
        const logService = new BufferLogger();
        instantiationService.register(ILogService, logService);

        // environment-service
        const environmentService = new BrowserEnvironmentService(logService);
        instantiationService.register(IBrowserEnvironmentService, environmentService);
        
        // ipc-service
        const ipcService = new IpcService(environmentService.windowID);
        instantiationService.register(IIpcService, ipcService);

        // host-service
        const hostService = ProxyChannel.unwrapChannel<IHostService>(ipcService.getChannel(IpcChannel.Host));
        instantiationService.register(IHostService, hostService);

        // file-logger-service
        const loggerService = new BrowserLoggerChannel(ipcService, environmentService.logLevel);
        instantiationService.register(ILoggerService, loggerService);

        // logger
        const logger = new PipelineLogger([
            // console-logger
            new ConsoleLogger(environmentService.mode === ApplicationMode.DEVELOP ? environmentService.logLevel : LogLevel.WARN),
            // file-logger
            loggerService.createLogger(environmentService.logPath, { 
                name: `wind-${environmentService.windowID}-${getFormatCurrTimeStamp()}.txt`,
                description: `renderer`,
            }),
        ]);
        logService.setLogger(logger);
        
        // file-service
        // FIX: readFileStream does not work
        const fileService = new BrowserFileChannel(ipcService);
        instantiationService.register(IFileService, fileService);
 
        // browser-configuration-service
        const configService = new BrowserConfigService(environmentService, fileService, logService);
        instantiationService.register(IConfigService, configService);
        
        // component-service
        instantiationService.register(IComponentService, new ServiceDescriptor(ComponentService));

        // singleton initialization
        for (const [serviceIdentifer, serviceDescriptor] of getSingletonServiceDescriptors()) {
			instantiationService.register(serviceIdentifer, serviceDescriptor);
		}

        return instantiationService;
    }

    private async initServices(instantiaionService: IInstantiationService): Promise<any> {
        const environmentService = instantiaionService.getService(IBrowserEnvironmentService)
        const configService = instantiaionService.getService(IConfigService);

        return Promise.all<any>([
            configService.init(environmentService.logLevel),
        ]);
    }

    private registerListeners(): void {
        // empty for now
    }

}

new Browser();