import type { IWindowRunRendererCommandRequest, WindowInstanceIPCMessageMap } from "src/platform/window/common/window";
import { ILogService } from "src/base/common/logger";
import { IShortcutService } from "src/workbench/services/shortcut/shortcutService";
import { IFileService } from "src/platform/files/common/fileService";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { IBrowserLifecycleService, ILifecycleService, LifecyclePhase } from "src/platform/lifecycle/browser/browserLifecycleService";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { Disposable } from "src/base/common/dispose";
import { IWorkbenchService } from "src/workbench/services/workbench/workbenchService";
import { delayFor } from "src/base/common/utilities/async";
import { Time } from "src/base/common/date";
import { IHostService } from "src/platform/host/common/hostService";
import { StatusKey } from "src/platform/status/common/status";
import { ipcRenderer, webFrame } from "src/platform/electron/browser/global";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { ICommandService } from "src/platform/command/common/commandService";
import { AllCommands } from "src/workbench/services/workbench/commandList";
import { ErrorHandler } from "src/base/common/error";

export interface IBrowser {
    init(): void;
}

export class BrowserInstance extends Disposable implements IBrowser {

    // [constructor]

    constructor(
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @ILifecycleService private readonly lifecycleService: IBrowserLifecycleService,
        @IFileService private readonly fileService: IFileService,
        @ILogService private readonly logService: ILogService,
        @IShortcutService private readonly shortcutService: IShortcutService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @IWorkbenchService private readonly workbenchService: IWorkbenchService,
        @IHostService private readonly hostService: IHostService,
        @ICommandService private readonly commandService: ICommandService,
    ) {
        super();
        logService.debug('BrowserInstance', 'BrowserInstance constructed.');
    }

    // [public methods]

    public init(): void {
        this.registerListeners();
        this.setBrowserPhase();

        // notify the main process we are ready.
        this.hostService.setWindowAsRendererReady();
    }

    // [private helper methods]

    private async registerListeners(): Promise<void> {
        await this.lifecycleService.when(LifecyclePhase.Displayed);
        
        // save user configurations on quit
        this.__register(this.lifecycleService.onWillQuit(e => 
            e.join(this.configurationService.save())
        ));

        this.__register(this.lifecycleService.onWillQuit(e => 
            e.join(this.hostService.setApplicationStatus(StatusKey.WindowZoomLevel, webFrame.getZoomLevel()))
        ));

        // alert error from main process
        onMainProcess(ipcRenderer, IpcChannel.rendererAlertError, error => {
            ErrorHandler.onUnexpectedError(error);
        });

        // execute command request from main process
        onMainProcess(ipcRenderer, IpcChannel.rendererRunCommand, async request => {
            try {
                await this.commandService.executeCommand(request.commandID, ...request.args);
            } catch (error) {
                this.commandService.executeCommand(AllCommands.alertError, 'BrowserInstance', error);
            }
        });
    }

    private setBrowserPhase(): void {
        this.lifecycleService.setPhase(LifecyclePhase.Displayed);
        const workbenchWhenReady = Promise.resolve(); // TODO: should wait for the editor restores to the original state

       /**
         * Initiates the `Restored` phase once the layout is restored, using 
         * `Promise.race` to balance performance between fast and slow editor 
         * restorations. The workbench remains functional, allowing `Restored` 
         * phase extensions to proceed even if the editor is not yet visible.
         */
        Promise.race([
            workbenchWhenReady,
            delayFor(Time.sec(2)),
        ])
        .finally(() => {
            this.lifecycleService.setPhase(LifecyclePhase.Restored);
            delayFor(Time.sec(2.5), () => {
                this.lifecycleService.setPhase(LifecyclePhase.Idle);
            });
        });
    }
}

/**
 * Listens IPC message from the main process.
 */
function onMainProcess<TChannel extends string>(listener: NodeJS.EventEmitter, channel: TChannel, callback: (...args: WindowInstanceIPCMessageMap[TChannel]) => void): void {
    listener.on(channel, (_e, ...args) => {
        callback(...args);
    });
}