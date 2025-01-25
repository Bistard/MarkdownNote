import type { IpcRenderer } from "electron";
import type { Mutable } from "src/base/common/utilities/type";
import type { ISandboxProcess, IWebFrame } from "src/platform/electron/common/electronType";
import type { IWindowConfiguration, WindowInstanceIPCMessageMap } from "src/platform/window/common/window";
import { executeOnce } from "src/base/common/utilities/function";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { ErrorHandler } from "src/base/common/error";

/**
 * Expose APIs from the main process at `preload.js`.
 * 
 * // REVIEW: perf - we may load all the files that renderer required at later time.
 * Since we are loading every files in the beginning of the application, thus
 * we cannot access the properties of `globalThis.nota` since `preload.js` have not
 * been loaded and expose the APIs yet.
 * 
 * The trick to fix this is by using a init function.
 */

export let ipcRenderer: IpcRenderer = <any>{};
export let process: ISandboxProcess = <any>{};
export let webFrame: IWebFrame = <any>{};
export let WIN_CONFIGURATION: IWindowConfiguration = <any>{};

/**
 * @description Once renderer process starts, we need to retrieve the APIs that
 * are exposed through the `preload.js`.
 */
export const initExposedElectronAPIs = executeOnce(function () {
    (<Mutable<IpcRenderer>>ipcRenderer) = globalThis.nota.ipcRenderer;
    (<Mutable<ISandboxProcess>>process) = globalThis.nota.process;
    (<Mutable<IWebFrame>>webFrame) = globalThis.nota.webFrame;
    (<Mutable<IWindowConfiguration>>WIN_CONFIGURATION) = globalThis.nota.WIN_CONFIGURATION;
});

/**
 * @description Safely attaches a listener to a specified IPC channel using 
 * Electron's `ipcRenderer`. The listener is invoked whenever a message is 
 * received on the given channel.
 *
 * @note Able to handle async listener too.
 * @note This is function is helpful to catch the error at the renderer process 
 * instead of `preload.js`. See: https://github.com/electron/electron/issues/43705
 * @note This function should only be used in the renderer process.
 */
export function safeIpcRendererOn<TChannel extends string>(channel: TChannel, listener: (event: Electron.IpcRendererEvent, ...args: WindowInstanceIPCMessageMap[TChannel]) => void | Promise<void>): void {
    ipcRenderer.on(channel, async (e, ...args) => {
        try {
            await listener(e, ...args);
        } catch (error) {
            ErrorHandler.onUnexpectedError(error);
        }
    });
}