import * as electron from "electron";
import { Disposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { join, resolve } from "src/base/common/files/path";
import { ILogService } from "src/base/common/logger";
import { IWindowConfiguration, IWindowDisplayOpts, WindowDisplayMode, WINDOW_MINIMUM_STATE, IWindowCreationOptions, WindowInstanceArgumentKey, shouldUseWindowControlOverlay, resolveWindowControlOverlayOptions, WindowInstancePhase, WindowInstanceIPCMessageMap } from "src/platform/window/common/window";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { IIpcAccessible } from "src/platform/host/common/hostService";
import { getUUID } from "src/base/node/uuid";
import { SafeIpcMain } from "src/platform/ipc/electron/safeIpcMain";
import { Callable, isDefined } from "src/base/common/utilities/type";
import { IMainStatusService } from "src/platform/status/electron/mainStatusService";
import { StatusKey } from "src/platform/status/common/status";
import { IScreenMonitorService } from "src/platform/screen/electron/screenMonitorService";

/**
 * @description A helper function to help renderer process can have access to
 * and only to the specified data by invoking `ipcRenderer.invoke(resource)`.
 * @returns a {@link IIpcAccessible} object.
 * @note Can only be invoked in main process and pass the resource to the 
 * renderer process.
 */
function createIpcAccessible<T>(): IIpcAccessible<T> {
    let data: T;
    let disposed = false;
    const resource = `nota:${getUUID()}`;
    SafeIpcMain.instance.handle(resource, async () => data);

    return {
        resource: resource,
        updateData: (newData: T) => data = newData,
        dispose: () => {
            if (disposed) {
                return;
            }
            SafeIpcMain.instance.removeHandler(resource);
            disposed = true;
        },
    };
}

/**
 * An interface only for {@link WindowInstance}.
 */
export interface IWindowInstance extends Disposable {

    readonly id: number;
    readonly browserWindow: electron.BrowserWindow;

    readonly onDidLoad: Register<void>;
    readonly onDidClose: Register<void>;

    /**
     * Fires whenever the renderer process of this window is ready.
     */
    readonly onRendererReady: Register<void>;

    load(configuration: IWindowConfiguration): Promise<void>;
    close(): void;
    isClosed(): boolean;

    /**
     * Notify the main process that the renderer process is ready. This will
     * trigger firing event {@link IWindowInstance['onRendererReady']}.
     */
    setAsRendererReady(): void;
    whenRendererReady(): Promise<void>;
    isRendererReady(): boolean;

    /**
     * Send IPC message to the renderer process. The message either send 
     * immediately or wait until the renderer process is ready.
     * @param channel The channel name.
     * @param args The arguments.
     */
    sendIPCMessage<TChannel extends string>(channel: TChannel, ...args: WindowInstanceIPCMessageMap[TChannel]): void;

    toggleFullScreen(force?: boolean): void;
}

/**
 * @class A window instance is a wrapper class of {@link BrowserWindow} that
 * will be used in the main process.
 */
export class WindowInstance extends Disposable implements IWindowInstance {

    // [event]

    private readonly _onDidLoad = this.__register(new Emitter<void>());
    public readonly onDidLoad = this._onDidLoad.registerListener;

    private readonly _onDidClose = this.__register(new Emitter<void>());
    public readonly onDidClose = this._onDidClose.registerListener;

    private readonly _onRendererReady = this.__register(new Emitter<void>());
    public readonly onRendererReady = this._onRendererReady.registerListener;

    // [field]

    private readonly _window: electron.BrowserWindow;
    private readonly _id: number;

    /**
     * It is still required for potential reloading request so that it cannot
     * be disposed after loading.
     */
    private readonly _configurationIpcAccessible = createIpcAccessible<IWindowConfiguration>();
    private _phase: WindowInstancePhase;
    private readonly _onRendererReadyCallbacks: (Callable<[], void>)[];

    // [constructor]

    constructor(
        private readonly configuration: IWindowCreationOptions,
        @ILogService private readonly logService: ILogService,
        @IMainStatusService private readonly mainStatusService: IMainStatusService,
        @IScreenMonitorService private readonly screenMonitorService: IScreenMonitorService,
    ) {
        super();
        logService.debug('WindowInstance', 'Constructing a window with the configuration...', { configuration });
        
        this._phase = WindowInstancePhase.Initializing;
        this._onRendererReadyCallbacks = [];
        const displayOptions = configuration.displayOptions;

        this._window = this.doCreateWindow(displayOptions);
        this._id = this._window.id;
        
        if (configuration["open-devtools"] === true) {
            this._window.webContents.openDevTools({ mode: 'detach', activate: true });
        }
        
        this.registerListeners();
    }

    // [getter / setter]

    get id(): number {
        return this._id;
    }

    get browserWindow(): electron.BrowserWindow {
        return this._window;
    }

    // [public methods]

    public async load(configuration: IWindowConfiguration): Promise<void> {
        this.logService.debug('WindowInstance', `(Window ID: ${this._id}) Loading window...`);
        this.logService.debug('MainWindowService', 'Primary monitor information:', { information: this.screenMonitorService.getPrimaryMonitorInfo() });

        this._configurationIpcAccessible.updateData(configuration);

        // loading page
        const htmlFile = this.configuration.loadFile;
        this.logService.debug('WindowInstance', `(Window ID: ${this._id}) Loading HTML file...`);

        await this._window.loadFile(htmlFile);
    }

    public toggleFullScreen(force?: boolean): void {
        if (isDefined(force)) {
            this._window.setFullScreen(force);
            return;
        }

        if (this._window.isFullScreen()) {
            this._window.setFullScreen(false);
        } else {
            this._window.setFullScreen(true);
        }
    }

    public updateTitleBarOptions(options: Electron.TitleBarOverlayOptions): void {
        if (shouldUseWindowControlOverlay()) {
            this._window.setTitleBarOverlay(resolveWindowControlOverlayOptions(options));
        }
    }

    public close(): void {
        this._window.webContents.close();
    }

    public isClosed(): boolean {
        return this._phase === WindowInstancePhase.Closed;
    }

    public setAsRendererReady(): void {
        if (this._phase >= WindowInstancePhase.RendererReady) {
            return;
        }
        this._phase = WindowInstancePhase.RendererReady;

        // notify these who are waiting for
        for (const callback of this._onRendererReadyCallbacks) {
            callback();
        }
        this._onRendererReadyCallbacks.length = 0;

        // notify outgoing event
        this._onRendererReady.fire();
    }

    public whenRendererReady(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.isRendererReady()) {
                resolve();
            }
            this._onRendererReadyCallbacks.push(resolve);
        });
    }

    public isRendererReady(): boolean {
        return this._phase === WindowInstancePhase.RendererReady;
    }

    public sendIPCMessage<TChannel extends string>(channel: TChannel, ...args: WindowInstanceIPCMessageMap[TChannel]): void {
        if (this._phase === WindowInstancePhase.Closed) {
            this.logService.warn('WindowInstance', `Cannot send IPC message to channel (${channel}) with window id (${this.id}) because it is already closed.`);
            return;
        }

        if (this._phase === WindowInstancePhase.Initializing) {
            this.whenRendererReady().then(() => {
                this.__doSendIPC(channel, ...args);
            });
        }

        if (this._phase === WindowInstancePhase.RendererReady) {
            this.__doSendIPC(channel, ...args);
        }
    }

    // [private methods]

    private doCreateWindow(displayOpts: IWindowDisplayOpts): electron.BrowserWindow {
        this.logService.debug('WindowInstance', 'Constructing window...');
        const additionalArguments = [
            `--${WindowInstanceArgumentKey.configuration}=${this._configurationIpcAccessible.resource}`,
            `--${WindowInstanceArgumentKey.zoomLevel}=${this.mainStatusService.get<number>(StatusKey.WindowZoomLevel) ?? 0}`
        ];

        const ifMaxOrFullscreen = (displayOpts.mode === WindowDisplayMode.Fullscreen) || (displayOpts.mode === WindowDisplayMode.Maximized);
        const browserOption: electron.BrowserWindowConstructorOptions = {
            title: this.configuration.applicationName,
            height: displayOpts.height,
            width: displayOpts.width,
            x: displayOpts.x,
            y: displayOpts.y,
            minHeight: displayOpts.minHeight ?? WINDOW_MINIMUM_STATE.height,
            minWidth: displayOpts.minWidth ?? WINDOW_MINIMUM_STATE.width,
            webPreferences: {
                preload: resolve(join(__dirname, 'preload.js')),

                /**
                 * false: Node.js is only available in main / preload process.
                 * true:  Node.js will also be available in the renderer process.
                 *          Thus a preload.js is needed.
                 */
                nodeIntegration: false,

                /**
                 * Context Isolation is a feature that ensures that both 
                 * your preload scripts and Electron's internal logic run in 
                 * a separate context to the website you load in 
                 * a webContents. This is important for security purposes as 
                 * it helps prevent the website from accessing Electron 
                 * internals or the powerful APIs your preload script has 
                 * access to.
                 * 
                 * This means that the (eg. window / document) object the 
                 * preload script has access to is actually a different 
                 * object than the website would have access to.
                 */
                contextIsolation: true,

                /**
                 * Pass any arguments use the following pattern:
                 *      --ArgName=argInString
                 */
                additionalArguments: additionalArguments,

                spellcheck: false,
                enableWebSQL: false,
                backgroundThrottling: false,
            },
            show: false, // to prevent flicker, we will show it later.
            resizable: displayOpts.resizable ?? true,
            frame: !displayOpts.frameless,
            alwaysOnTop: displayOpts.alwaysOnTop ?? false,
        };

        // title bar configuration
        if (browserOption.frame === false) {
            browserOption.titleBarStyle = 'hidden';

            if (shouldUseWindowControlOverlay()) {
                browserOption.titleBarOverlay = resolveWindowControlOverlayOptions({});
            }
        }

        // window construction
        const window = new electron.BrowserWindow(browserOption);

        // removes default menu and shortcuts like reload and developer-tool.
        window.setMenu(null);

        if (ifMaxOrFullscreen) {
            window.maximize();
            if (displayOpts.mode === WindowDisplayMode.Fullscreen) {
                window.setSimpleFullScreen(true);
                window.webContents.focus();
            }
            window.show();
        }

        return window;
    }

    private registerListeners(): void {

        this._window.webContents.once('did-fail-load', (e, errCode, errMsg) => {
            this.logService.error('WindowInstance', `(Window ID: ${this._id}) Loading page failed.`, new Error(), { errCode, errMsg });
        });
        
        this._window.webContents.once('did-finish-load', () => {
            this.logService.debug('WindowInstance', `(Window ID: ${this._id}) Page loaded successfully.`);
            this._window.show();
            this._onDidLoad.fire();
        });

        // window closed
        this._window.on('closed', () => {
            this._phase = WindowInstancePhase.Closed;
            this._onDidClose.fire();
            this.dispose();
        });

        this._window.on('focus', (e: Event) => {
            electron.app.emit(IpcChannel.WindowFocused, e, this._window);
        });

        this._window.on('blur', (e: Event) => {
            electron.app.emit(IpcChannel.WindowBlurred, e, this._window);
        });

        this._window.on('maximize', (e: Event) => {
            electron.app.emit(IpcChannel.WindowMaximized, e, this._window);
        });

        this._window.on('unmaximize', (e: Event) => {
            electron.app.emit(IpcChannel.WindowUnMaximized, e, this._window);
        });
        
        this._window.on('enter-full-screen', (e: Event) => {
            electron.app.emit(IpcChannel.WindowEnterFullScreen, e, this._window);
        });
        
        this._window.on('leave-full-screen', (e: Event) => {
            electron.app.emit(IpcChannel.WindowLeaveFullScreen, e, this._window);
        });
    }

    private __doSendIPC(channel: string, ...args: any[]): void {
        try {
            this._window.webContents.send(channel, ...args);
        } catch (error) {
            this.logService.error('WindowInstance', `Error sending IPC message to channel (${channel}) with window id (${this.id})`, error);
        }
    }
}
