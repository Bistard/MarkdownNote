import type { IWindowInstance } from "src/platform/window/electron/windowInstance";
import { SafeIpcMain } from "src/platform/ipc/electron/safeIpcMain";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { DisposableManager } from "src/base/common/dispose";
import { ILogService } from "src/base/common/logger";
import { IMainWindowService } from "src/platform/window/electron/mainWindowService";
import { IMainInspectorService, InspectorDataEvent } from "src/platform/inspector/common/inspector";

export class MainInspectorService implements IMainInspectorService {

    declare _serviceMarker: undefined;

    // [field]

    private readonly _inspectorLifeCycles: Map<number, DisposableManager>;
    private readonly _activeInspectors: number[];

    // [constructor]

    constructor(
        @ILogService private readonly logService: ILogService,
        @IMainWindowService mainWindowService: IMainWindowService,
    ) {
        this._inspectorLifeCycles = new Map();
        this._activeInspectors = [];

        // notify READY to the associated render process
        SafeIpcMain.instance.on(IpcChannel.InspectorReady, (e, inspectorID: number) => {
            const inspectorWindow = mainWindowService.getWindowByID(inspectorID)!;
            const ownerWindow = mainWindowService.getWindowByID(inspectorWindow.configuration.ownerWindow!)!;
            ownerWindow.sendIPCMessage(IpcChannel.InspectorReady);
        });

        // notify CLOSE to the associated render process
        SafeIpcMain.instance.on(IpcChannel.InspectorClose, (e, inspectorID: number) => {
            const inspectorWindow = mainWindowService.getWindowByID(inspectorID)!;
            const ownerWindow = mainWindowService.getWindowByID(inspectorWindow.configuration.ownerWindow!)!;
            ownerWindow.sendIPCMessage(IpcChannel.InspectorClose);
        });

        // receive DATA from the renderer process
        SafeIpcMain.instance.on(IpcChannel.InspectorDataSync, (e, ownerID: number, dataEvent: InspectorDataEvent) => {
            const ownerWindow = mainWindowService.getWindowByID(ownerID)!;
            const inspectorWindow = mainWindowService.getInspectorWindowByOwnerID(ownerWindow.id);
            
            /**
             * No inspectors but we still received IPC message somehow, we tell 
             * the owner to stop doing it.
             */
            if (!inspectorWindow) {
                ownerWindow.sendIPCMessage(IpcChannel.InspectorClose);
                return;
            }

            // transfer the latest data to the inspector window
            inspectorWindow.sendIPCMessage(IpcChannel.InspectorDataSync, dataEvent);
        });
    }

    // [public methods]

    public start(window: IWindowInstance): void {
        if (this._inspectorLifeCycles.get(window.id)) {
            this.logService.warn('MainInspectorService', `Cannot start inspector window (${window.id}) twice.`);
            return;
        }

        this._activeInspectors.push(window.id);
    }

    public stop(window: IWindowInstance): void {

    }

    // [private methods]

}