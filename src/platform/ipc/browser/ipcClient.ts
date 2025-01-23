import { asGlobalDisposable, DisposableBucket } from "src/base/common/dispose";
import { NodeEventEmitter } from "src/base/common/event";
import { DataBuffer } from "src/base/common/files/buffer";
import { ipcRenderer } from "src/platform/electron/browser/global";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { ClientBase } from "src/platform/ipc/common/net";
import { IpcProtocol } from "src/platform/ipc/common/protocol";

/**
 * @class An implementation of {@link ClientBase} that wraps the {@link ipcRenderer}
 * as the protocol communication.
 * @note Should be used in renderer process side.
 */
export class IpcClient extends ClientBase {

    // [field]

    private static readonly _disposable = asGlobalDisposable(new DisposableBucket());

    // [constructor]

    constructor(id: string) {
        const onConnect = () => ipcRenderer.send(IpcChannel.Connect);
        super(IpcClient.__createProtocol(), id, onConnect);
    }

    public override dispose(): void {
        super.dispose();
        IpcClient._disposable.dispose();
    }

    // [private helper methods]

    private static __createProtocol(): IpcProtocol {
        /**
         * We register a channel listener on {@link IpcChannel.DataChannel} into
         * our own {@link ipcRenderer} and every time we receive data we wrap it 
         * with data buffer.
         */
        const nodeEmitter = new NodeEventEmitter<DataBuffer>(
            ipcRenderer,
            IpcChannel.DataChannel,
            (event, data) => DataBuffer.wrap(data),
        );

        IpcClient._disposable.register(nodeEmitter);
        return new IpcProtocol(ipcRenderer, nodeEmitter.registerListener);
    }
}
