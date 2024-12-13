import { app, BrowserWindow } from "electron";
import { Disposable } from "src/base/common/dispose";
import { Emitter, Event, Register } from "src/base/common/event";
import { ILogService } from "src/base/common/logger";
import { isDefined, isNumber, Mutable } from "src/base/common/utilities/type";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { IEnvironmentService, IMainEnvironmentService } from "src/platform/environment/common/environment";
import { ToOpenType, IUriToOpenConfiguration, IWindowCreationOptions, DEFAULT_HTML, defaultDisplayState, INlsConfiguration } from "src/platform/window/common/window";
import { IWindowInstance, WindowInstance } from "src/platform/window/electron/windowInstance";
import { URI } from "src/base/common/files/uri";
import { UUID } from "src/base/common/utilities/string";
import { mixin } from "src/base/common/utilities/object";
import { IScreenMonitorService } from "src/platform/screen/electron/screenMonitorService";
import { IProductService } from "src/platform/product/common/productService";
import { panic } from "src/base/common/utilities/panic";
import { Arrays } from "src/base/common/utilities/array";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { WorkbenchConfiguration } from "src/workbench/services/workbench/configuration.register";

export const IMainWindowService = createService<IMainWindowService>('main-window-service');

/**
 * An interface only for {@link MainWindowService}.
 */
export interface IMainWindowService extends Disposable, IService {

    readonly onDidOpenWindow: Register<IWindowInstance>;
    readonly onDidCloseWindow: Register<IWindowInstance>;

    /**
     * @description Construct and open a brand new renderer window.
     */
    open(optionalConfiguration: Partial<IWindowCreationOptions>): Promise<IWindowInstance>;

    /**
     * @description Returns all the running windows.
     */
    windows(): ReadonlyArray<IWindowInstance>;

    /**
     * @description Returns the opened window by the given id.
     */
    getWindowByID(id: number): IWindowInstance | undefined;

    /**
     * @description Returns the current focused window.
     */
    getFocusedWindow(): IWindowInstance | undefined;

    /**
     * @description Get the previous focused window.
     */
    getPrevFocusedWindow(): IWindowInstance | undefined;

    /**
     * @description Closes the window with corresponding ID.
     */
    closeWindowByID(id: number): void;

    /**
     * @description Returns the number of running window.
     */
    windowCount(): number;
}

/**
 * @class Window service has ability to create windows based on different 
 * configurations. It also tracks all the life cycles of every 
 * {@link IWindowInstance}.
 */
export class MainWindowService extends Disposable implements IMainWindowService {

    declare _serviceMarker: undefined;

    // [fields]

    private readonly _windows: IWindowInstance[] = [];

    // [event]

    private readonly _onDidOpenWindow = this.__register(new Emitter<IWindowInstance>());
    public readonly onDidOpenWindow = this._onDidOpenWindow.registerListener;

    private readonly _onDidCloseWindow = this.__register(new Emitter<IWindowInstance>());
    public readonly onDidCloseWindow = this._onDidCloseWindow.registerListener;

    // [constructor]

    constructor(
        private readonly machineID: UUID,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @ILogService private readonly logService: ILogService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @IEnvironmentService private readonly environmentService: IMainEnvironmentService,
        @IScreenMonitorService private readonly screenMonitorService: IScreenMonitorService,
        @IProductService private readonly productService: IProductService,
    ) {
        super();
        this.registerListeners();
        this.logService.debug('MainWindowService', 'MainWindowService constructed.');
    }

    // [getter / setter]

    public windows(): readonly IWindowInstance[] {
        return this._windows;
    }

    public getWindowByID(id: number): IWindowInstance | undefined {
        for (const window of this._windows) {
            if (window.id === id) {
                return window;
            }
        }
        return undefined;
    }

    public getFocusedWindow(): IWindowInstance | undefined {
        const window = BrowserWindow.getFocusedWindow();
		if (window) {
			return this.getWindowByID(window.id);
		}
		return undefined;
    }

    public getPrevFocusedWindow(): IWindowInstance | undefined {
        const windows = this.windows();

        let prevFocusedWindow: IWindowInstance | undefined = undefined;
        let maxPrevFocusedTime = Number.MIN_VALUE;

        for (const window of windows) {
            if (window.lastFocusedTime > maxPrevFocusedTime) {
                maxPrevFocusedTime = window.lastFocusedTime;
                prevFocusedWindow = window;
            }
        }

        return prevFocusedWindow;
    }

    // [public methods]

    public windowCount(): number {
        return this._windows.length;
    }

    public async open(optionalConfiguration: Partial<IWindowCreationOptions>): Promise<IWindowInstance> {
        this.logService.debug('MainWindowService', 'trying to open a window...');

        const ownerID = optionalConfiguration.ownerWindow;
        if (isDefined(ownerID) && !this.getWindowByID(ownerID)) {
            panic(`Cannot open a window (${optionalConfiguration.applicationName ?? 'unknown name'}) under the owner window (id: ${ownerID}) which is already destroyed.`);
        }
        
        const newWindow = await this.doOpen(optionalConfiguration);
        
        // If provided, this new window's lifecycle will bind with the given window id.
        if (ownerID) {
            this.__bindWindowLifecycle(newWindow, ownerID);
        }

        return newWindow;
    }

    public closeWindowByID(id: number): void {
        const window = this.getWindowByID(id);
        if (!window) {
            return;
        }

        window.close();
    }

    // [private methods]

    private registerListeners(): void {
        // noop
    }

    private async doOpen(optionalConfiguration: Partial<IWindowCreationOptions>): Promise<IWindowInstance> {
        let window: IWindowInstance | undefined = undefined;
        
        const nlsConfiguration = LocaleResolver.resolveNlsConfiguration(this.configurationService);

        // get opening URIs configuration
        let uriToOpenConfiguration: IUriToOpenConfiguration = {};
        if (optionalConfiguration.uriToOpen) {
            uriToOpenConfiguration = UriToOpenResolver.resolve(
                optionalConfiguration.uriToOpen,
                errorMessage => this.logService.error('MainWindowService', errorMessage),
            );
        }

        const defaultConfiguration: IWindowCreationOptions = {
            /** part: {@link ICLIArguments} */
            _: this.environmentService.CLIArguments._,
            log: this.environmentService.CLIArguments.log,
            'open-devtools': this.environmentService.CLIArguments['open-devtools'],
            inspector: undefined,
            ListenerGCedWarning: this.environmentService.CLIArguments.ListenerGCedWarning,

            /** part: {@link IEnvironmentOpts} */
            isPackaged: this.environmentService.isPackaged,
            appRootPath: this.environmentService.appRootPath,
            tmpDirPath: this.environmentService.tmpDirPath,
            userDataPath: this.environmentService.userDataPath,
            userHomePath: this.environmentService.userHomePath,

            /** part: {@link IWindowConfiguration} */
            applicationName: this.productService.profile.applicationName,
            machineID: this.machineID,
            windowID: -1, // will be update once window is loaded
            uriOpenConfiguration: uriToOpenConfiguration,
            hostWindow: -1,
            nlsConfiguration: nlsConfiguration,

            /** part: {@link IWindowCreationOptions} */
            loadFile: DEFAULT_HTML,
            CLIArgv: this.environmentService.CLIArguments,
            displayOptions: defaultDisplayState(this.screenMonitorService.getPrimaryMonitorInfo()),
            uriToOpen: [],
            forceNewWindow: false,
            ownerWindow: undefined,
        };

        /**
         * Important window configuration that relies on previous state of the 
         * application (provided opts, app config, environment and so on). This
         * configuration will be passed when creating a `BrowserWindow`.
         */
        const configuration = mixin<Mutable<IWindowCreationOptions>>(defaultConfiguration, optionalConfiguration, true);

        // open a new window instance
        window = this.__openInNewWindow(configuration);
        configuration.windowID = window.id;

        // load window
        // TODO: only pass the `IWindowConfiguration` part, we are currently passing into everything.
        window.load(configuration);

        return window;
    }

    // [private helper methods]

    private __openInNewWindow(configuration: IWindowCreationOptions): IWindowInstance {
        const newWindow = this.instantiationService.createInstance(WindowInstance, configuration);

        this._windows.push(newWindow);
        this._onDidOpenWindow.fire(newWindow);

        // newly window listeners
        Event.once(newWindow.onDidClose)(() => this.__onWindowDidClose(newWindow));

        return newWindow;
    }

    private __onWindowDidClose(window: IWindowInstance): void {
        Arrays.remove(this._windows, window);
        this._onDidCloseWindow.fire(window);
    }

    private __bindWindowLifecycle(newWindow: IWindowInstance, ownerID: number): void {
        const ownerWindow = this.getWindowByID(ownerID);
        if (!ownerWindow) {
            this.logService.warn('MainWindowService', `Cannot bind the lifecycle to the window (${ownerID}) because it is already destroyed.`);
            return;
        }

        // binding lifecycle
        Event.once(ownerWindow.onDidClose)(() => {
            if (newWindow.isClosed() === false) {
                newWindow.close();
            }
        });
    }
}

namespace UriToOpenResolver {

    export function resolve(uriToOpen: URI[], onError: (message: string) => void): IUriToOpenConfiguration {
        const resolveResult = __parse(uriToOpen);
        const uriToOpenConfiguration = resolveResult[0];

        // logging any errored opening URIs
        const errorURIs = resolveResult[1];
        if (errorURIs.length) {
            let message = 'Invalid URI when opening in windows. Format should be `path|directory/workspace/file(|<gotoLine>)`. The erroring URIs are: ';
            for (const uri of errorURIs) {
                message += '\n\t' + URI.toString(uri);
            }
            onError(message);
        }

        return uriToOpenConfiguration;
    }

    /**
     * @description Given an array of URIs, resolves the ones that follow the
     * following parsing rule.
     * ```txt
     * Parsing rule:
     *      Directory - directory_path|directory
     *      Workspace - workspace_path|workspace
     *      File      - file_path|file(|gotoLine)
     * ```
     */
    function __parse(uris: URI[]): [IUriToOpenConfiguration, URI[]] {
        const config: Mutable<IUriToOpenConfiguration> = {};
        const errorURIs: URI[] = [];

        for (const uri of uris) {
            const parseResult = __parseURI(uri);

            // the parsing fails, we record this URI and continue.
            if (parseResult.fail) {
                errorURIs.push(uri);
                continue;
            }

            if (parseResult.type === ToOpenType.Directory) {
                config.directory = URI.fromFile(parseResult.resource);
            }
            else if (parseResult.type === ToOpenType.File) {
                if (!config.filesToOpen) {
                    config.filesToOpen = [];
                }
                config.filesToOpen.push({
                    uri: URI.fromFile(parseResult.resource),
                    gotoLine: parseResult.gotoLine
                });
            }
        }

        return [config, errorURIs];
    }

    // [private helper methods]

    function __parseURI(uri: URI): { resource: string, type: ToOpenType, gotoLine?: number, fail?: boolean; } {
        const sections = URI.toFsPath(uri).split('|');

        const resource = sections[0];
        const type = sections[1];
        const gotoLine = isNumber(sections[2]) ? Number(sections[2]) : undefined;
        let fail: boolean | undefined;

        if (!resource || !type) {
            fail = true;
        }

        const isDir =  (type === 'directory') ? ToOpenType.Directory : ToOpenType.Unknown;
        const isFile = (type === 'file')      ? ToOpenType.File      : ToOpenType.Unknown;

        if (isDir === ToOpenType.Unknown && isFile === ToOpenType.Unknown) {
            fail = true;
        }

        return {
            resource: resource!,
            type: isDir | isFile,
            gotoLine: gotoLine,
            fail: fail,
        };
    }
}

namespace LocaleResolver {

    // [public]

    export function resolveNlsConfiguration(configurationService: IConfigurationService): INlsConfiguration {
        const userLocale = __getUserLocale(configurationService);
        const osLocale = __getOSLocale();
        const resolvedLocale = userLocale || osLocale || 'en';
        const nlsConfiguration: INlsConfiguration = {
            userLocale: userLocale,
            osLocale: osLocale,
            resolvedLanguage: resolvedLocale,
        };
        return nlsConfiguration;
    }

    // [private]

    function __getOSLocale(): string {
        const osLocale = app.getPreferredSystemLanguages()?.[0] || 'en';
        if (osLocale.startsWith('zh')) {
            const region = osLocale.split('-')[1]!;
            /**
             * On Windows and macOS, Chinese languages returned by
             * app.getPreferredSystemLanguages() start with zh-hans
             * for Simplified Chinese or zh-hant for Traditional Chinese,
             * so we can easily determine whether to use Simplified or Traditional.
             * However, on Linux, Chinese languages returned by that same API
             * are of the form zh-XY, where XY is a country code.
             * For China (CN), Singapore (SG), and Malaysia (MY)
             * country codes, assume they use Simplified Chinese.
             * For other cases, assume they use Traditional.
             */
            if (['hans', 'cn', 'sg', 'my'].includes(region)) {
                return 'zh-cn';
            }
            return 'zh-tw';
        }
        return osLocale;
    }

    function __getUserLocale(configurationService: IConfigurationService): string {
        return configurationService.get<string>(WorkbenchConfiguration.DisplayLanguage);
    }
}