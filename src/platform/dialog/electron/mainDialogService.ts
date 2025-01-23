import * as fs from "fs";
import { BrowserWindow, dialog } from "electron";
import { ILogService } from "src/base/common/logger";
import { IS_MAC } from "src/base/common/platform";
import { AsyncQueue } from "src/base/common/utilities/async";
import { nullToUndefined } from "src/base/common/utilities/type";
import { IDialogService, IInternalOpenDialogOptions, IOpenDialogOptions } from "src/platform/dialog/common/dialog";
import { createService } from "src/platform/instantiation/common/decorator";
import { Disposable } from "src/base/common/dispose";

export const IMainDialogService = createService<IMainDialogService>('main-dialog-service');

/**
 * An interface only for {@link MainDialogService}.
 */
export interface IMainDialogService extends IDialogService { }

type ElectronDialogReturnType = Electron.MessageBoxReturnValue | Electron.SaveDialogReturnValue | Electron.OpenDialogReturnValue;

/**
 * @class A wrapper service built on top of {@link Electron.dialog}. Except for 
 * the three vanilla APIs from electron, dialog-service also provides three 
 * extra APIs for opening different type of 'open-dialog's.
 */
export class MainDialogService extends Disposable implements IMainDialogService {

    declare _serviceMarker: undefined;

    // [field]

    /** 
     * Each {@link BrowserWindow} has its own dialog box queue to ensure does 
     * not exist two boxes at the same time.
     * @note -1 is the queue that contains all the dialogs with no bonded 
     *       BrowserWindow.
     */
    private readonly _dialogQueues = new Map<number, AsyncQueue<ElectronDialogReturnType>>();

    // [constructor]

    constructor(
        @ILogService private readonly logService: ILogService,
    ) {
        super();
    }

    // [public methods]

    public openFileOrDirectoryDialog(opts: IOpenDialogOptions, window?: BrowserWindow): Promise<string[]> {
        return this.__open({ ...opts, openDirectory: true, openFile: true }, window);
    }

    public openFileDialog(opts: IOpenDialogOptions, window?: BrowserWindow): Promise<string[]> {
        return this.__open({ ...opts, openDirectory: false, openFile: true }, window);
    }

    public openDirectoryDialog(opts: IOpenDialogOptions, window?: BrowserWindow): Promise<string[]> {
        return this.__open({ ...opts, openDirectory: true, openFile: false }, window);
    }

    public async showOpenDialog(opts: Electron.OpenDialogOptions, window?: BrowserWindow): Promise<Electron.OpenDialogReturnValue> {
        this.__resolveDefaultPath(opts);

        return this.__getDialogQueue<Electron.OpenDialogReturnValue>(window).queue(async () => {
            let dialogResult: Electron.OpenDialogReturnValue;

            if (window) {
                this.logService.debug('MainDialogService', `showing open dialog with window ID: ${window.id}...`);
                dialogResult = await dialog.showOpenDialog(window, opts);
            } else {
                this.logService.debug('MainDialogService', `showing open dialog...`);
                dialogResult = await dialog.showOpenDialog(opts);
            }

            return dialogResult;
        });
    }

    public async showSaveDialog(opts: Electron.SaveDialogOptions, window?: BrowserWindow): Promise<Electron.SaveDialogReturnValue> {
        this.__resolveDefaultPath(opts);

        return this.__getDialogQueue<Electron.SaveDialogReturnValue>(window).queue(async () => {
            let dialogResult: Electron.SaveDialogReturnValue;
            if (window) {
                this.logService.debug('MainDialogService', `showing save dialog with window ID: ${window.id}...`);
                dialogResult = await dialog.showSaveDialog(window, opts);
            } else {
                this.logService.debug('MainDialogService', `showing save dialog...`);
                dialogResult = await dialog.showSaveDialog(opts);
            }

            return dialogResult;
        });
    }

    public async showMessageBox(opts: Electron.MessageBoxOptions, window?: BrowserWindow): Promise<Electron.MessageBoxReturnValue> {
        return this.__getDialogQueue<Electron.MessageBoxReturnValue>(window).queue(async () => {
            if (window) {
                this.logService.debug('MainDialogService', `showing message dialog with window ID: ${window.id}...`);
                return dialog.showMessageBox(window, opts);
            }
            this.logService.debug('MainDialogService', `showing message dialog...`);
            return dialog.showMessageBox(opts);
        });
    }

    // [private helper methods]

    private async __open(opts: IInternalOpenDialogOptions, window?: BrowserWindow): Promise<string[]> {

        // building up the actual dialog option
        const dialogOption: Electron.OpenDialogOptions = {
            title: opts.title,
            buttonLabel: opts.buttonLabel,
            defaultPath: opts.defaultPath,
        };

        // determine property of the dialog
        if (typeof opts.openFile === 'boolean' || typeof opts.openDirectory === 'boolean') {
            dialogOption.properties = undefined; // let it override based on the booleans

            if (opts.openFile && opts.openDirectory) {
                dialogOption.properties = ['multiSelections', 'openDirectory', 'openFile', 'createDirectory'];
            }
        }

        if (!dialogOption.properties) {
            dialogOption.properties = ['multiSelections', opts.openDirectory ? 'openDirectory' : 'openFile', 'createDirectory'];
        }

        if (IS_MAC) {
            dialogOption.properties.push('treatPackageAsDirectory');
        }

        const win = nullToUndefined(window ?? BrowserWindow.getFocusedWindow());
        const openedResult = await this.showOpenDialog(dialogOption, win);
        return openedResult.filePaths;
    }

    private __getDialogQueue<T>(window?: BrowserWindow): AsyncQueue<T> {
        let queue: AsyncQueue<any> | undefined;

        if (!window) {
            queue = this._dialogQueues.get(-1);
            if (!queue) {
                queue = this.__register(new AsyncQueue());
                this._dialogQueues.set(-1, queue);
            }
        }
        else {
            queue = this._dialogQueues.get(window.id);
            if (!queue) {
                queue = this.__register(new AsyncQueue());
                this._dialogQueues.set(window.id, queue);
            }
        }

        return queue;
    }

    private async __resolveDefaultPath(opts: { defaultPath?: string; }): Promise<void> {
        if (opts.defaultPath) {
            try {
                await fs.promises.stat(opts.defaultPath);
            } catch {
                opts.defaultPath = undefined;
            }
        }
    }

}