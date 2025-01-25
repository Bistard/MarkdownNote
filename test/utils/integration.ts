import { Schemas, URI } from "src/base/common/files/uri";
import { ILogService } from "src/base/common/logger";
import { IRecentOpenService, RecentOpenService } from "src/platform/app/browser/recentOpenService";
import { CommandRegistrant } from "src/platform/command/common/commandRegistrant";
import { CommandService, ICommandService } from "src/platform/command/common/commandService";
import { BrowserConfigurationService } from "src/platform/configuration/browser/browserConfigurationService";
import { APP_CONFIG_NAME, IConfigurationService } from "src/platform/configuration/common/configuration";
import { ConfigurationRegistrant } from "src/platform/configuration/common/configurationRegistrant";
import { ContextService, IContextService } from "src/platform/context/common/contextService";
import { IBrowserEnvironmentService, IEnvironmentService } from "src/platform/environment/common/environment";
import { FileService, IFileService } from "src/platform/files/common/fileService";
import { InMemoryFileSystemProvider } from "src/platform/files/common/inMemoryFileSystemProvider";
import { DiskFileSystemProvider } from "src/platform/files/node/diskFileSystemProvider";
import { IHostService } from "src/platform/host/common/hostService";
import { I18nService, II18nService } from "src/platform/i18n/browser/i18nService";
import { IInstantiationService, InstantiationService } from "src/platform/instantiation/common/instantiation";
import { ReviverRegistrant } from "src/platform/ipc/common/revive";
import { ILifecycleService } from "src/platform/lifecycle/browser/browserLifecycleService";
import { IMainLifecycleService } from "src/platform/lifecycle/electron/mainLifecycleService";
import { MenuRegistrant } from "src/platform/menu/browser/menuRegistrant";
import { ProductService, IProductService } from "src/platform/product/common/productService";
import { RegistrantType } from "src/platform/registrant/common/registrant";
import { RegistrantService, IRegistrantService } from "src/platform/registrant/common/registrantService";
import { MainStatusService, IMainStatusService } from "src/platform/status/electron/mainStatusService";
import { KeyboardService, IKeyboardService } from "src/workbench/services/keyboard/keyboardService";
import { ILayoutService } from "src/workbench/services/layout/layoutService";
import { INotificationService } from "src/workbench/services/notification/notification";
import { ShortcutRegistrant } from "src/workbench/services/shortcut/shortcutRegistrant";
import { ShortcutService, IShortcutService } from "src/workbench/services/shortcut/shortcutService";
import { ColorRegistrant } from "src/workbench/services/theme/colorRegistrant";
import { ThemeService, IThemeService } from "src/workbench/services/theme/themeService";
import { nullObject } from "test/utils/helpers";
import { NullLogger, NullLifecycleService, NullBrowserEnvironmentService, NullHostService, TestURI } from "test/utils/testService";

/**
 * Only used in the function: {@link createIntegration}. 
 *  1. Determines what micro-services are used in the integration tests.
 *  2. If that service is not required, that service will be replaced with a 
 *     mock object and registered into DI.
 *  3. If that service is required, that service will be constructed normally 
 *     and registered into DI.
 *  4. If that service is not required, but is dependent by other required 
 *     services, this service will be considered as required.
 *  5. If that service cannot work in test environment, a mock object will be 
 *     injected.
 */
export interface IIntegrationOptions {
    readonly logService?: boolean;
    readonly configurationService?: boolean;
    readonly statusService?: boolean;
    readonly hostService?: boolean;
    readonly contextService?: boolean;
    readonly registrantService?: RegistrantType[];
    readonly environmentService?: boolean;
    readonly lifecycleService?: boolean;
    readonly fileService?: 'auto' | 'inMemory' | 'diskFile';
    readonly productService?: boolean;
    readonly i18nService?: boolean;
    readonly commandService?: boolean;
    readonly themeService?: boolean;
    readonly keyboardService?: boolean;
    readonly shortcutService?: boolean;
    readonly recentOpenService?: boolean;
}

/**
 * @description A very powerful function to build testing environments for 
 * integration tests.
 */
export async function createIntegration(options: IIntegrationOptions): Promise<IInstantiationService> {
    const di = new InstantiationService();
    di.store(IInstantiationService, di);

    const logService = new NullLogger();
    di.store(ILogService, logService);

    const fileService = new FileService(logService);
    di.store(IFileService, fileService);
    if (options.fileService === 'auto' || options.fileService === 'inMemory') fileService.registerProvider(Schemas.FILE, new InMemoryFileSystemProvider());
    if (options.fileService === 'diskFile') fileService.registerProvider(Schemas.FILE, new DiskFileSystemProvider(logService));

    const productService = new ProductService(fileService, logService);
    di.store(IProductService, productService);
    
    const contextService = new ContextService();
    di.store(IContextService, contextService);

    const browserEnvironmentService = new NullBrowserEnvironmentService();
    di.store(IEnvironmentService, browserEnvironmentService);
    di.store(IBrowserEnvironmentService, browserEnvironmentService);

    const registrantService = new RegistrantService(logService);
    di.store(IRegistrantService, registrantService);
    if (options.registrantService?.includes(RegistrantType.Command)) { registrantService.registerRegistrant(di.createInstance(CommandRegistrant)); }
    if (options.registrantService?.includes(RegistrantType.Color)) { registrantService.registerRegistrant(di.createInstance(ColorRegistrant)); }
    if (options.registrantService?.includes(RegistrantType.Configuration)) { registrantService.registerRegistrant(di.createInstance(ConfigurationRegistrant)); }
    if (options.registrantService?.includes(RegistrantType.Menu)) { registrantService.registerRegistrant(di.createInstance(MenuRegistrant)); }
    if (options.registrantService?.includes(RegistrantType.Reviver)) { registrantService.registerRegistrant(di.createInstance(ReviverRegistrant)); }
    if (options.registrantService?.includes(RegistrantType.Shortcut)) { registrantService.registerRegistrant(di.createInstance(ShortcutRegistrant)); }
    registrantService.init(di);

    const configurationService = options.configurationService
        ? di.createInstance(BrowserConfigurationService, { appConfiguration: { path: URI.join(URI.parse('file:///temp'), APP_CONFIG_NAME) } })
        : nullObject<BrowserConfigurationService>();
    di.store(IConfigurationService, configurationService);
    if (options.configurationService) {
        await configurationService.init().unwrap();
    }

    const lifecycleService = new NullLifecycleService();
    di.store(ILifecycleService, lifecycleService);
    di.store(IMainLifecycleService, lifecycleService);

    const statusService = (options.statusService || options.hostService)
        ? di.createInstance(MainStatusService)
        : nullObject();
    di.store(IMainStatusService, statusService);

    const hostService = di.createInstance(NullHostService);
    di.store(IHostService, hostService);

    const commandService = options.commandService
        ? di.createInstance(CommandService)
        : nullObject();
    di.store(ICommandService, commandService);
    
    const layoutService = nullObject();
    di.store(ILayoutService, layoutService);

    const keyboardService = options.keyboardService
        ? di.createInstance(KeyboardService)
        : nullObject();
    di.store(IKeyboardService, keyboardService);
    
    const shortcutService = options.shortcutService
        ? di.createInstance(ShortcutService)
        : nullObject();
    di.store(IShortcutService, shortcutService);

    const notificationService = nullObject();
    di.store(INotificationService, notificationService);

    const themeService = options.themeService
        ? di.createInstance(ThemeService)
        : nullObject();
    di.store(IThemeService, themeService);
    
    const i18nService = options.i18nService
        ? di.createInstance(I18nService, { osLocale: 'en', resolvedLanguage: 'en', userLocale: 'en' }, URI.join(TestURI, 'locales'))
        : nullObject<I18nService>();
    di.store(II18nService, i18nService);

    const recentOpenService = options.recentOpenService
        ? di.createInstance(RecentOpenService)
        : nullObject();
    di.store(IRecentOpenService, recentOpenService);

    return di;
}
