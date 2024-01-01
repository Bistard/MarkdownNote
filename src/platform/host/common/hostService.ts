import { IDisposable } from "src/base/common/dispose";
import { AsyncResult } from "src/base/common/error";
import { Register } from "src/base/common/event";
import { FileOperationError } from "src/base/common/files/file";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { StatusKey } from "src/platform/status/common/status";

export const IHostService = createService<IHostService>('host-service');

/**
 * SHOULD ONLY contains promise methods or event registrations.
 */
export interface IHostService extends IService {

    // window-instance
    readonly onDidMaximizeWindow: Register<number>;
    readonly onDidUnmaximizeWindow: Register<number>;
    readonly onDidFocusWindow: Register<number>;
    readonly onDidBlurWindow: Register<number>;
    readonly onDidOpenWindow: Register<number>;

    // window-service
    focusWindow(id?: number): Promise<void>;
    maximizeWindow(id?: number): Promise<void>;
    minimizeWindow(id?: number): Promise<void>;
    unmaximizeWindow(id?: number): Promise<void>;
    toggleMaximizeWindow(id?: number): Promise<void>;
    toggleFullScreenWindow(id?: number): Promise<void>;
    closeWindow(id?: number): Promise<void>;

    // dialog-service
    showOpenDialog(opts: Electron.OpenDialogOptions, id?: number): Promise<Electron.OpenDialogReturnValue>;
    showSaveDialog(opts: Electron.SaveDialogOptions, id?: number): Promise<Electron.SaveDialogReturnValue>;
    showMessageBox(opts: Electron.MessageBoxOptions, id?: number): Promise<Electron.MessageBoxReturnValue>;
    openFileDialogAndOpen(opts: Electron.OpenDialogOptions, id?: number): Promise<void>;
    openDirectoryDialogAndOpen(opts: Electron.OpenDialogOptions, id?: number): Promise<void>;
    openFileOrDirectoryDialogAndOpen(opts: Electron.OpenDialogOptions, id?: number): Promise<void>;

    // dev-tools
    openDevTools(options?: Electron.OpenDevToolsOptions, id?: number): Promise<void>;
    closeDevTools(id?: number): Promise<void>;
    toggleDevTools(id?: number): Promise<void>;
    reloadWebPage(id?: number): Promise<void>;

    // status-service
    setApplicationStatus(key: StatusKey, val: any): AsyncResult<void, FileOperationError>;
    setApplicationStatusLot(items: readonly { key: StatusKey, val: any; }[]): AsyncResult<void, FileOperationError>;
    deleteApplicationStatus(key: StatusKey): AsyncResult<boolean, FileOperationError>;
}

export interface IIpcAccessible<T> extends IDisposable {
    /**
     * A string that a renderer process can use it to access the object in main 
     * process via `ipcRenderer.invoke(resource)`.
     */
    readonly resource: string;

    /**
     * A method used in main process to update the data to be returned after a
     * {@link IIpcAccessible} has been created.
     */
    updateData(data: T): void;

    /**
     * Make the resource unaccessible.
     */
    dispose(): void;
}