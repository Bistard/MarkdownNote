import "src/styles/index.scss";
import { Workbench } from "src/workbench/workbench";
import { IInstantiationService, IServiceProvider, InstantiationService } from "src/platform/instantiation/common/instantiation";
import { getSingletonServiceDescriptors, registerService, ServiceCollection } from "src/platform/instantiation/common/serviceCollection";
import { waitDomToBeLoad } from "src/base/browser/basic/dom";
import { Disposable, monitorDisposableLeak } from "src/base/common/dispose";
import { ServiceDescriptor } from "src/platform/instantiation/common/descriptor";
import { initExposedElectronAPIs, WIN_CONFIGURATION } from "src/platform/electron/browser/global";
import { IIpcService, IpcService } from "src/platform/ipc/browser/ipcService";
import { BrowserLoggerChannel } from "src/platform/logger/common/loggerChannel";
import { BufferLogger, ILogService, LogLevel, PipelineLogger } from "src/base/common/logger";
import { ILoggerService } from "src/platform/logger/common/abstractLoggerService";
import { IFileService } from "src/platform/files/common/fileService";
import { BrowserEnvironmentService } from "src/platform/environment/browser/browserEnvironmentService";
import { BrowserFileChannel } from "src/platform/files/browser/fileChannel";
import { ErrorHandler } from "src/base/common/error";
import { ApplicationMode, IBrowserEnvironmentService } from "src/platform/environment/common/environment";
import { ConsoleLogger } from "src/platform/logger/common/consoleLoggerService";
import { getFormatCurrTimeStamp } from "src/base/common/date";
import { ProxyChannel } from "src/platform/ipc/common/proxy";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { IHostService } from "src/platform/host/common/hostService";
import { IBrowserHostService } from "src/platform/host/browser/browserHostService";
import { BrowserLifecycleService, ILifecycleService } from "src/platform/lifecycle/browser/browserLifecycleService";
import { BrowserInstance } from "src/code/browser/browser";
import { APP_CONFIG_NAME, IConfigurationService } from "src/platform/configuration/common/configuration";
import { IProductService, ProductService } from "src/platform/product/common/productService";
import { BrowserConfigurationService } from "src/platform/configuration/browser/browserConfigurationService";
import { URI } from "src/base/common/files/uri";
import { IRegistrantService, RegistrantService } from "src/platform/registrant/common/registrantService";
import { ConfigurationRegistrant } from "src/platform/configuration/common/configurationRegistrant";
import { CommandRegistrant } from "src/platform/command/common/commandRegistrant";
import { ShortcutRegistrant } from "src/workbench/services/shortcut/shortcutRegistrant";
import { ReviverRegistrant } from "src/platform/ipc/common/revive";
import { ICommandService, CommandService } from "src/platform/command/common/commandService";
import { IContextService, ContextService } from "src/platform/context/common/contextService";
import { IDialogService, BrowserDialogService } from "src/platform/dialog/browser/browserDialogService";
import { Workspace } from "src/workbench/parts/workspace/workspace";
import { IWorkspaceService } from 'src/workbench/parts/workspace/workspaceService';
import { IContextMenuService, ContextMenuService } from "src/workbench/services/contextMenu/contextMenuService";
import { IKeyboardScreenCastService, KeyboardScreenCastService } from "src/workbench/services/keyboard/keyboardScreenCastService";
import { IKeyboardService, KeyboardService } from "src/workbench/services/keyboard/keyboardService";
import { ILayoutService, LayoutService } from "src/workbench/services/layout/layoutService";
import { INotificationService, NotificationService } from "src/workbench/services/notification/notificationService";
import { IShortcutService, ShortcutService } from "src/workbench/services/shortcut/shortcutService";
import { IThemeService, ThemeService } from "src/workbench/services/theme/themeService";
import { rendererTitleBarFileCommandRegister, rendererWorkbenchCommandRegister } from "src/workbench/services/workbench/command.register";
import { FileTreeService } from "src/workbench/services/fileTree/fileTreeService";
import { IFileTreeMetadataService, IFileTreeService } from "src/workbench/services/fileTree/treeService";
import { IClipboardService } from "src/platform/clipboard/common/clipboard";
import { BrowserClipboardService } from "src/platform/clipboard/browser/clipboardService";
import { ColorRegistrant } from "src/workbench/services/theme/colorRegistrant";
import { INavigationBarService, NavigationBar } from "src/workbench/parts/navigationPanel/navigationBar/navigationBar";
import { INavigationViewService, NavigationView } from "src/workbench/parts/navigationPanel/navigationView/navigationView";
import { IFunctionBarService, FunctionBar } from "src/workbench/parts/navigationPanel/functionBar/functionBar";
import { INavigationPanelService, NavigationPanel } from "src/workbench/parts/navigationPanel/navigationPanel";
import { IQuickAccessBarService, QuickAccessBar } from "src/workbench/parts/navigationPanel/navigationBar/quickAccessBar/quickAccessBar";
import { IToolBarService, ToolBar } from "src/workbench/parts/navigationPanel/navigationBar/toolBar/toolBar";
import { ActionBar, IActionBarService } from "src/workbench/parts/navigationPanel/navigationBar/toolBar/actionBar";
import { FilterBar, IFilterBarService } from "src/workbench/parts/navigationPanel/navigationBar/toolBar/filterBar";
import { toBoolean } from "src/base/common/utilities/type";
import { BrowserZoomService, IBrowserZoomService } from "src/workbench/services/zoom/zoomService";
import { IBrowserService, initGlobalErrorHandler } from "src/code/browser/common/renderer.common";
import { BrowserInspectorService } from "src/platform/inspector/browser/browserInspectorService";
import { IBrowserInspectorService } from "src/platform/inspector/common/inspector";
import { MenuRegistrant } from "src/platform/menu/browser/menuRegistrant";
import { I18nService, II18nService } from "src/platform/i18n/browser/i18nService";
import { IRecentOpenService, RecentOpenService } from "src/platform/app/browser/recentOpenService";
import { EditorPaneRegistrant } from "src/workbench/services/editorPane/editorPaneRegistrant";

/**
 * @class This is the main entry of the renderer process.
 */
const renderer = new class extends class RendererInstance extends Disposable {

    // [fields]

    private readonly logService!: ILogService;

    // [constructor]

    constructor() {
        super();
    }

    // [public method]

    public async run(): Promise<void> {
        let instantiationService: IInstantiationService | undefined;

        try {
            // retrieve the exposed APIs from preload.js
            initExposedElectronAPIs();
            monitorDisposableLeak(toBoolean(WIN_CONFIGURATION.disposableLeakWarning));
            
            // ensure we handle almost every errors properly
            initGlobalErrorHandler(() => this.logService, WIN_CONFIGURATION);

            // register microservices
            this.rendererServiceRegistrations();

            // core service construction
            instantiationService = this.createCoreServices();

            // service initialization
            await Promise.all([
                this.initServices(instantiationService),
                waitDomToBeLoad().then(() => this.logService.info('renderer', 'Web environment (DOM content) has been loaded.')),
            ]);

            // create workbench UI
            const workbench = this.__register(instantiationService.createInstance(Workbench));
            workbench.init();
            
            // browser monitor
            const browser = instantiationService.createInstance(BrowserInstance);
            instantiationService.store(IBrowserService, browser);
            browser.init();
        }
        catch (error: any) {
            ErrorHandler.onUnexpectedError(error);
        }
    }

    // [end]

    // [services initialization]

    private createCoreServices(): IInstantiationService {

        // instantiation-service (Dependency Injection)
        const instantiationService = this.__register(new InstantiationService(new ServiceCollection()));
        instantiationService.store(IInstantiationService, instantiationService);

        // log-service
        const logService = new BufferLogger();
        instantiationService.store(ILogService, logService);
        (<any>this.logService) = logService;

        // context-service
        const contextService = new ContextService();
        instantiationService.store(IContextService, contextService);

        // registrant-service
        const registrantService = instantiationService.createInstance(RegistrantService);
        instantiationService.store(IRegistrantService, registrantService);
        this.initRegistrant(instantiationService, registrantService);

        // environment-service
        const environmentService = new BrowserEnvironmentService(logService);
        instantiationService.store(IBrowserEnvironmentService, environmentService);

        // ipc-service
        const ipcService = new IpcService(environmentService.windowID, logService);
        instantiationService.store(IIpcService, ipcService);

        // host-service
        const hostService = ProxyChannel.unwrapChannel<IBrowserHostService>(ipcService.getChannel(IpcChannel.Host), { context: environmentService.windowID });
        instantiationService.store(IHostService, hostService);

        // lifecycle-service
        const lifecycleService = instantiationService.createInstance(BrowserLifecycleService);
        instantiationService.store(ILifecycleService, lifecycleService);

        // file-logger-service
        const loggerService = new BrowserLoggerChannel(ipcService.getChannel(IpcChannel.Logger), environmentService.logLevel);
        instantiationService.store(ILoggerService, loggerService);

        // logger
        const logger = new PipelineLogger([
            // console-logger
            new ConsoleLogger(environmentService.mode === ApplicationMode.DEVELOP ? environmentService.logLevel : LogLevel.WARN),
            // file-logger
            loggerService.createLogger(
                URI.join(environmentService.logPath, `window-${environmentService.windowID}-${getFormatCurrTimeStamp()}.txt`), 
                {
                    description: `renderer`,
                }),
        ]);
        logService.setLogger(logger);

        // file-service
        const fileService = instantiationService.createInstance(BrowserFileChannel);
        instantiationService.store(IFileService, fileService);

        // product-service
        const productService = new ProductService(fileService, logService);
        instantiationService.store(IProductService, productService);

        // configuration-service
        const configurationService = instantiationService.createInstance(
            BrowserConfigurationService,
            { 
                appConfiguration: { 
                    path: URI.join(environmentService.appConfigurationPath, APP_CONFIG_NAME), 
                } 
            },
        );
        instantiationService.store(IConfigurationService, configurationService);

        // i18n-service
        const i18nService = instantiationService.createInstance(I18nService, 
            WIN_CONFIGURATION.nlsConfiguration, 
            URI.join(environmentService.appRootPath, 'assets', 'locale'),
        );
        instantiationService.store(II18nService, i18nService);

        // singleton initializations
        logService.debug('renderer', 'Registering singleton services descriptors...');
        for (const [serviceIdentifier, serviceDescriptor] of getSingletonServiceDescriptors()) {
            logService.trace('renderer', `Registering singleton service descriptor: '${serviceIdentifier.toString()}'.`);
            instantiationService.store(serviceIdentifier, serviceDescriptor);
        }

        logService.debug('renderer', 'All core renderer services are constructed.');
        return instantiationService;
    }

    private async initServices(instantiationService: IInstantiationService): Promise<any> {
        this.logService.debug('renderer', 'Start initializing core renderer services...');

        const configurationService = instantiationService.getService(IConfigurationService);
        const environmentService   = instantiationService.getService(IBrowserEnvironmentService);
        const i18nService          = instantiationService.getService(II18nService);
        const productService       = instantiationService.getService(IProductService);
        const themeService         = instantiationService.getOrCreateService(IThemeService);

        await configurationService.init()
            .andThen(() => i18nService.init())
            .andThen(() => productService.init(environmentService.productProfilePath))
            .andThen(() => themeService.init())
            .unwrap();

        this.logService.debug('renderer', 'All core renderer services are initialized successfully.');
    }

    private rendererServiceRegistrations(): void {

        // registration
        registerService(IKeyboardService          , new ServiceDescriptor(KeyboardService          , []));
        registerService(IShortcutService          , new ServiceDescriptor(ShortcutService          , []));
        registerService(ICommandService           , new ServiceDescriptor(CommandService           , []));
    
        // User Interface
        registerService(ILayoutService            , new ServiceDescriptor(LayoutService            , []));
        registerService(INavigationBarService     , new ServiceDescriptor(NavigationBar            , []));
        registerService(IQuickAccessBarService    , new ServiceDescriptor(QuickAccessBar           , []));
        registerService(IToolBarService           , new ServiceDescriptor(ToolBar                  , []));
        registerService(IActionBarService         , new ServiceDescriptor(ActionBar                , []));
        registerService(IFilterBarService         , new ServiceDescriptor(FilterBar                , []));
        registerService(INavigationViewService    , new ServiceDescriptor(NavigationView           , []));
        registerService(IFunctionBarService       , new ServiceDescriptor(FunctionBar              , []));
        registerService(INavigationPanelService   , new ServiceDescriptor(NavigationPanel          , []));
        registerService(IWorkspaceService         , new ServiceDescriptor(Workspace                , []));
        registerService(IKeyboardScreenCastService, new ServiceDescriptor(KeyboardScreenCastService, []));
        registerService(IThemeService             , new ServiceDescriptor(ThemeService             , []));
        registerService(IFileTreeService          , new ServiceDescriptor(FileTreeService          , []));
        registerService(IFileTreeMetadataService  , new ServiceDescriptor(FileTreeService          , []));
        registerService(IContextMenuService       , new ServiceDescriptor(ContextMenuService       , []));
    
        // utilities && tools
        registerService(INotificationService      , new ServiceDescriptor(NotificationService      , []));
        registerService(IDialogService            , new ServiceDescriptor(BrowserDialogService     , []));
        registerService(IClipboardService         , new ServiceDescriptor(BrowserClipboardService  , []));
        registerService(IBrowserZoomService       , new ServiceDescriptor(BrowserZoomService       , []));
        registerService(IBrowserInspectorService  , new ServiceDescriptor(BrowserInspectorService  , []));
        registerService(IRecentOpenService        , new ServiceDescriptor(RecentOpenService        , []));
    }

    // [end]

    // [registrant initialization]

    private initRegistrant(service: IInstantiationService, registrant: IRegistrantService): void {
        
        /**
         * DO NOT change the registration orders, orders does matter here.
         */
        registrant.registerRegistrant(this.initConfigurationRegistrant(service));
        registrant.registerRegistrant(service.createInstance(ShortcutRegistrant));
        registrant.registerRegistrant(this.initCommandRegistrant(service));
        registrant.registerRegistrant(service.createInstance(ReviverRegistrant));
        registrant.registerRegistrant(service.createInstance(ColorRegistrant));
        registrant.registerRegistrant(service.createInstance(MenuRegistrant));
        registrant.registerRegistrant(service.createInstance(EditorPaneRegistrant));

        // initialize all the registrations
        registrant.init(service);
    }

    private initConfigurationRegistrant(service: IInstantiationService): ConfigurationRegistrant {
        class BrowserConfigurationRegistrant extends ConfigurationRegistrant {
            public override initRegistrations(provider: IServiceProvider): void {
                super.initRegistrations(provider);
                // no op for now
            }
        }

        return service.createInstance(BrowserConfigurationRegistrant);
    }
    
    private initCommandRegistrant(service: IInstantiationService): CommandRegistrant {
        class BrowserCommandRegistrant extends CommandRegistrant {
            public override initRegistrations(provider: IServiceProvider): void {
                super.initRegistrations(provider);
                [
                    rendererWorkbenchCommandRegister,
                    rendererTitleBarFileCommandRegister,
                ]
                .forEach(register => register(provider));
            }
        }
        
        return service.createInstance(BrowserCommandRegistrant);
    }

    // [end]
}
{ };

renderer.run();