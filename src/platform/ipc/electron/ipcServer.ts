import { IpcMainEvent, WebContents } from "electron";
import { asGlobalDisposable, DisposableBucket, IDisposable, toDisposable, untrackDisposable } from "src/base/common/dispose";
import { Emitter, Event, NodeEventEmitter, Register, SignalEmitter } from "src/base/common/event";
import { DataBuffer } from "src/base/common/files/buffer";
import { ILogService } from "src/base/common/logger";
import { noop } from "src/base/common/performance";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { IClientConnectEvent, ServerBase } from "src/platform/ipc/common/net";
import { IpcProtocol } from "src/platform/ipc/common/protocol";
import { SafeIpcMain } from "src/platform/ipc/electron/safeIpcMain";

/**
 * @class Represents a server that manages IPC (Inter-Process Communication) 
 * connections in Electron's main process. It utilizes {@link SafeIpcMain} for 
 * secure communication between the main process and renderer processes.
 * 
 * @note An implementation of {@link ServerBase} that wraps the {@link SafeIpcMain}
 * as the protocol communication.
 * @note Should be used only in the main process side.
 */
export class IpcServer extends ServerBase {

    // [field]

    /**
     * Activated clients managed by the server, keyed by their unique ID.
     */
    private static readonly _activatedClients = new Map<number, IDisposable>();
    private static readonly _disposable = asGlobalDisposable(new DisposableBucket());

    // [constructor]

    constructor(logService: ILogService) {
        logService.debug('IPCServer', 'IPCServer constructing...');
        super(IpcServer.__createOnClientConnect(), logService);
        logService.debug('IPCServer', 'IPCServer constructed.');
    }

    // [public methods]

    public override dispose(): void {
        IpcServer._disposable.dispose();
        for (const [id, client] of IpcServer._activatedClients) {
            client.dispose();
        }
        super.dispose();
    }

    // [private helper methods]

    /**
     * @description Creates a function to handle new client connections by 
     * setting up event listeners for data and disconnection events, and 
     * managing client lifecycle.
     * @returns A register to register as a client connect event listener.
     */
    private static __createOnClientConnect(): Register<IClientConnectEvent> {
        const onRawConnect = new NodeEventEmitter<IpcMainEvent>(SafeIpcMain.instance, IpcChannel.Connect);
        IpcServer._disposable.register(onRawConnect);

        return Event.map<IpcMainEvent, IClientConnectEvent>(onRawConnect.registerListener, (event) => {
            const client = event.sender;
            const clientID = client.id;

            const handle = IpcServer._activatedClients.get(clientID);
            handle?.dispose();

            const onClientReconnect = untrackDisposable(new Emitter<void>());
            IpcServer._activatedClients.set(clientID, untrackDisposable(toDisposable(() => {
                onClientReconnect.fire();
                onClientReconnect.dispose();
            })));

            const [onDataDisposable      , onDataRegister]       = scopedOnDataEvent(IpcChannel.DataChannel, clientID);
            const [onDisconnectDisposable, onDisconnectRegister] = scopedOnDataEvent(IpcChannel.Disconnect, clientID);
            const onDisconnect = new SignalEmitter([onDisconnectRegister], noop);

            IpcServer._disposable.register(onDataDisposable);
            IpcServer._disposable.register(onDisconnectDisposable);
            IpcServer._disposable.register(onDisconnect);
            
            return {
                clientID: clientID,
                protocol: new IpcProtocol(client, onDataRegister),
                onClientDisconnect: Event.any([onDisconnect.registerListener, onClientReconnect.registerListener]),
            };
        });
    }
}

interface IIpcEvent {
    event: { sender: WebContents; };
    data: Buffer | null;
}

function scopedOnDataEvent(eventName: string, filterID: number): [IDisposable, Register<DataBuffer>] {
    const onDataEmitter = new NodeEventEmitter<IIpcEvent>(
        SafeIpcMain.instance,
        eventName,
        (event, data) => ({ event, data }),
    );
    const onDataFromID = Event.filter(onDataEmitter.registerListener, ({ event }) => {
        return event.sender.id === filterID;
    });
    return [onDataEmitter, Event.map(onDataFromID, ({ data }) => data ? DataBuffer.wrap(data) : DataBuffer.alloc(0))];
}