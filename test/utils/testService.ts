/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { tmpdir } from "os";
import { Emitter, Register } from "src/base/common/event";
import { DataBuffer } from "src/base/common/files/buffer";
import { join } from "src/base/common/files/path";
import { Schemas, URI } from "src/base/common/files/uri";
import { IStandardKeyboardEvent } from "src/base/common/keyboard";
import { AbstractLogger, ILogService } from "src/base/common/logger";
import { IKeyboardService } from "src/workbench/services/keyboard/keyboardService";
import { ContextService } from "src/platform/context/common/contextService";
import { DiskEnvironmentService } from "src/platform/environment/common/diskEnvironmentService";
import { IBrowserEnvironmentService, IEnvironmentService, IMainEnvironmentService } from "src/platform/environment/common/environment";
import { ClientBase, IClientConnectEvent, ServerBase } from "src/platform/ipc/common/net";
import { IProtocol } from "src/platform/ipc/common/protocol";
import { AbstractLifecycleService } from "src/platform/lifecycle/common/abstractLifecycleService";
import { IWindowConfiguration, IWindowCreationOptions } from "src/platform/window/common/window";
import { nullObject } from "test/utils/helpers";
import { IHostService } from "src/platform/host/common/hostService";
import { Dictionary } from "src/base/common/utilities/type";
import { StatusKey } from "src/platform/status/common/status";
import { panic } from "src/base/common/utilities/panic";
import { IMainStatusService, MainStatusService } from "src/platform/status/electron/mainStatusService";
import { IMainLifecycleService } from "src/platform/lifecycle/electron/mainLifecycleService";
import { FileService, IFileService } from "src/platform/files/common/fileService";
import { InMemoryFileSystemProvider } from "src/platform/files/common/inMemoryFileSystemProvider";
import { QuitReason } from "src/platform/lifecycle/browser/browserLifecycleService";
import { APP_CONFIG_NAME, IConfigurationService } from "src/platform/configuration/common/configuration";
import { BrowserConfigurationService } from "src/platform/configuration/browser/browserConfigurationService";
import { IInstantiationService, InstantiationService } from "src/platform/instantiation/common/instantiation";
import { IRegistrantService, RegistrantService } from "src/platform/registrant/common/registrantService";
import { ConfigurationRegistrant } from "src/platform/configuration/common/configurationRegistrant";
import { ConsoleLogger } from "src/platform/logger/common/consoleLoggerService";

export const NotaName = 'nota';
export const TestDirName = 'tests';
export const TestPath = URI.toFsPath(URI.fromFile(join(tmpdir(), NotaName, TestDirName))); // make sure the disk schema is lowercase.
export const TestURI = URI.fromFile(TestPath);
export const APP_FILE_ROOT_URI = URI.fromFile(globalThis.APP_FILE_ROOT);

export namespace TestIPC {

    export class IpcServer extends ServerBase {

        private readonly _onDidClientConnect: Emitter<IClientConnectEvent>;

        constructor() {
            const onDidClientConnect = new Emitter<IClientConnectEvent>();
            super(onDidClientConnect.registerListener, new NullLogger());
            this._onDidClientConnect = onDidClientConnect;
            this.__register(onDidClientConnect);
        }

        public createConnection(id: string): ClientBase {
            const [pc, ps] = __createProtocolPair();
            const client = new IpcClient(pc, id);

            this._onDidClientConnect.fire({
                clientID: id,
                protocol: ps,
                onClientDisconnect: client.onDidDisconnect
            });

            return client;
        }
    }

    class IpcClient extends ClientBase {

        private readonly _onDidDisconnect = new Emitter<void>();
        public readonly onDidDisconnect = this._onDidDisconnect.registerListener;

        constructor(protocol: IProtocol, id: string) {
            super(protocol, id, () => { });
        }

        public override dispose(): void {
            this._onDidDisconnect.fire();
            super.dispose();
        }
    }

    class QueueProtocol implements IProtocol {

        // [event]

        private readonly _onMessage = new Emitter<DataBuffer>({
            onFirstListenerDidAdd: () => {
                // only fire the events when there is a listener, in case fires in advance.
                for (const buffer of this._buffers) {
                    this._onMessage.fire(buffer);
                }
                this._buffers = [];
                this._buffering = false;
            },
            onLastListenerDidRemove: () => {
                this._buffering = true;
            }
        });
        
        public readonly onData = this._onMessage.registerListener;

        // [fields]

        private _buffering = true;
        private _buffers: DataBuffer[] = [];
        public other!: QueueProtocol;

        // [methods]

        public send(buffer: DataBuffer): void {
            this.other.receive(buffer);
        }

        protected receive(buffer: DataBuffer): void {
            if (this._buffering) {
                this._buffers.push(buffer);
            } else {
                this._onMessage.fire(buffer);
            }
        }
    }

    /**
     * @internal
     */
    export function __createProtocolPair(): [IProtocol, IProtocol] {
        const one = new QueueProtocol();
        const other = new QueueProtocol();
        one.other = other;
        other.other = one;
        return [one, other];
    }
}

export class NullLifecycleService extends AbstractLifecycleService<number, number> {

    constructor() {
        super('Test', 0, () => '', new NullLogger());
    }

    public override async quit(): Promise<void> {
        this._onBeforeQuit.fire({ reason: QuitReason.Quit, veto: () => {} });
        this._onWillQuit.fire({ reason: 1, join: () => { } });
    }

    public async kill() {}
}
export class NullMainLifecycleService extends AbstractLifecycleService<number, number> implements IMainLifecycleService {

    constructor() {
        super('Test', 0, () => '', new NullLogger());
    }

    public override async quit(): Promise<void> {
        this._onBeforeQuit.fire({ reason: QuitReason.Quit, veto: () => {} });
        this._onWillQuit.fire({ reason: 1, join: () => { } });
    }

    public async kill(exitcode?: number): Promise<void> {
        return;
    }
}

export class NullEnvironmentService extends DiskEnvironmentService implements IEnvironmentService {
    constructor() {
        super({
            _: [],
        }, {
            appRootPath: 'temp/',
            isPackaged: false,
            tmpDirPath: 'temp/',
            userDataPath: 'temp/',
            userHomePath: 'temp/',
        },
        new NullLogger(),
        );
    }
}

export class NullMainEnvironmentService extends DiskEnvironmentService implements IMainEnvironmentService {
    constructor() {
        super({
            _: [],
        }, {
            appRootPath: 'temp/',
            isPackaged: false,
            tmpDirPath: 'temp/',
            userDataPath: 'temp/',
            userHomePath: 'temp/',
        },
        new NullLogger(),
        );
    }

    get mainIpcHandle(): string { return 'temp/pipe/main.sock'; }
}

export class NullBrowserEnvironmentService extends DiskEnvironmentService implements IBrowserEnvironmentService {

    constructor() {
        super({
            _: []
        }, {
            appRootPath: 'temp/',
            isPackaged: false,
            tmpDirPath: 'temp/',
            userDataPath: 'temp/',
            userHomePath: 'temp/',
        },
        new NullLogger(),
        );
    }

    get machineID(): string {
        return 'unknown';
    }

    get windowID(): number {
        return NaN;
    }

    get configuration(): IWindowConfiguration {
        return nullObject();
    }
}

export class NullLogger extends AbstractLogger implements ILogService {
    constructor() {
        super();
    }
    public trace(message: string, ...args: any[]): void { }
    public debug(message: string, ...args: any[]): void { }
    public info(message: string, ...args: any[]): void { }
    public warn(message: string, ...args: any[]): void { }
    public error(message: string | Error, ...args: any[]): void { }
    public fatal(message: string | Error, ...args: any[]): void { }
    public async flush(): Promise<void> { }
}

export class SimpleLogger extends AbstractLogger implements ILogService {
    constructor() {
        super();
    }
    public trace(message: string, ...args: any[]): void { console.log(...arguments); }
    public debug(message: string, ...args: any[]): void { console.log(...arguments); }
    public info(message: string, ...args: any[]): void { console.log(...arguments); }
    public warn(message: string, ...args: any[]): void { console.log(...arguments); }
    public error(message: string | Error, ...args: any[]): void { console.log(...arguments); }
    public fatal(message: string | Error, ...args: any[]): void { console.log(...arguments); }
    public async flush(): Promise<void> { console.log(...arguments); }
}

export class NullContextService extends ContextService { }

export class TestKeyboardService implements IKeyboardService {

    declare _serviceMarker: undefined;

    private readonly _emitter: Emitter<IStandardKeyboardEvent> = new Emitter();
    private readonly _emitter2: Emitter<CompositionEvent> = new Emitter();

    constructor() { }

    public fire(event: IStandardKeyboardEvent): void {
        this._emitter.fire(event);
    }

    public fireComposition(event: CompositionEvent): void {
        this._emitter2.fire(event);
    }

    get onKeydown() {
        return this._emitter.registerListener;
    }

    get onKeyup() {
        return this._emitter.registerListener;
    }

    get onKeypress() {
        return this._emitter.registerListener;
    }
    
    get onCompositionStart() {
        return this._emitter2.registerListener;
    }
    
    get onCompositionUpdate() {
        return this._emitter2.registerListener;
    }
    
    get onCompositionEnd() {
        return this._emitter2.registerListener;
    }

    public dispose(): void {
        this._emitter.dispose();
    }
}

export class NullHostService implements IHostService {
    
    public declare _serviceMarker: undefined;
    
    constructor(
        @IMainStatusService private readonly statusService: IMainStatusService,
    ) {}

    public readonly onDidMaximizeWindow: Register<number> = undefined!;
    public readonly onDidUnMaximizeWindow: Register<number> = undefined!;
    public readonly onDidFocusWindow: Register<number> = undefined!;
    public readonly onDidBlurWindow: Register<number> = undefined!;
    public readonly onDidOpenWindow: Register<number> = undefined!;
    public readonly onDidEnterFullScreenWindow: Register<number> = undefined!;
    public readonly onDidLeaveFullScreenWindow: Register<number> = undefined!;

    public async setWindowAsRendererReady(id?: number): Promise<void> { panic("Method not implemented."); }
    public async focusWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async maximizeWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async minimizeWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async unMaximizeWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async toggleMaximizeWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async toggleFullScreenWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async closeWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async reloadWindow(optionalConfiguration: Partial<IWindowCreationOptions>, id?: number): Promise<void> { panic("Method not implemented."); }
    public async showOpenDialog(opts: Electron.OpenDialogOptions, id?: number): Promise<Electron.OpenDialogReturnValue> { panic("Method not implemented."); }
    public async showSaveDialog(opts: Electron.SaveDialogOptions, id?: number): Promise<Electron.SaveDialogReturnValue> { panic("Method not implemented."); }
    public async showMessageBox(opts: Electron.MessageBoxOptions, id?: number): Promise<Electron.MessageBoxReturnValue> { panic("Method not implemented."); }
    public async openFileDialogAndOpen(opts: Electron.OpenDialogOptions, id?: number): Promise<void> { panic("Method not implemented."); }
    public async openDirectoryDialogAndOpen(opts: Electron.OpenDialogOptions, id?: number): Promise<void> { panic("Method not implemented."); }
    public async openFileOrDirectoryDialogAndOpen(opts: Electron.OpenDialogOptions, id?: number): Promise<void> { panic("Method not implemented."); }
    public async openDevTools(options?: Electron.OpenDevToolsOptions, id?: number): Promise<void> { panic("Method not implemented."); }
    public async closeDevTools(id?: number): Promise<void> { panic("Method not implemented."); }
    public async toggleDevTools(id?: number): Promise<void> { panic("Method not implemented."); }
    public async reloadWebPage(id?: number): Promise<void> { panic("Method not implemented."); }
    public async toggleInspectorWindow(id?: number): Promise<void> { panic("Method not implemented."); }
    public async getApplicationStatus<T>(key: StatusKey): Promise<T | undefined> { return this.statusService.get(key); }
    public async setApplicationStatus(key: StatusKey, val: any): Promise<void> { return this.statusService.set(key, val).unwrap(); }
    public async setApplicationStatusLot(items: readonly { key: StatusKey; val: any; }[]): Promise<void> { return this.statusService.setLot(items).unwrap(); }
    public async deleteApplicationStatus(key: StatusKey): Promise<boolean> { return this.statusService.delete(key).unwrap(); }
    public async getAllApplicationStatus(): Promise<Dictionary<string, any>> { panic("Method not implemented."); }
    public async showItemInFolder(path: string): Promise<void> { panic("Method not implemented."); }
}