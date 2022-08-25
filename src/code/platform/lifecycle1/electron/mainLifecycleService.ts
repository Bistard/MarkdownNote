import { app, BrowserWindow } from "electron";
import { ILogService } from "src/base/common/logger";
import { IS_MAC } from "src/base/common/platform";
import { Blocker, delayFor } from "src/base/common/util/async";
import { createDecorator } from "src/code/platform/instantiation/common/decorator";
import { AbstractLifecycleService } from "src/code/platform/lifecycle1/common/abstractLifecycleService";
import { ILifecycleService } from "src/code/platform/lifecycle1/common/lifecycle";

export const IMainLifecycleService = createDecorator<IMainLifecycleService>('life-cycle-service');

/**
 * Represents the different phases of the whole application. Notices that the
 * phse cannot go BACKWARDS.
 */
export const enum LifecyclePhase {
    /**
     * The starting phase of the application (services are not ready).
     */
    Starting = 0,

    /**
     * First window is about to open (services are ready).
     */
    Ready = 1,

    /**
     * After the window has opened. 
     * @note This is usually used when starting services that do not require 
     * the window to be opened.
     */
    Idle = 2,
}

export const enum QuitReason {
    /**
     * The application quit normally.
     */
    Quit,

    /**
     * The application exit abnormally and killed with an exit code.
     */
    Kill,
}

export interface IBeforeQuitEvent<Reason extends number> {
    /**
     * The reason of the quit event.
     */
    readonly reason: Reason;

    /**
     * A method that allows the listener to join the whole process.
     */
    readonly join: (participant: Promise<void>) => void;
}

/**
 * An interface only for {@link MainLifecycleService}.
 */
export interface IMainLifecycleService extends ILifecycleService<LifecyclePhase, QuitReason> {
    /**
     * @description Kill the application with the given exitcode. Different than
     * `this.quit()`, it will try to destroy every window within a second, than 
     * invoke `app.exit()`.
     * @param exitcode The exiting code.
     * @default exitcode 1
     */
    kill(exitcode?: number): Promise<void>;
}

/**
 * @class A class used in main process to control the lifecycle of the whole 
 * application (including all the registered windows).
 */
export class MainLifecycleService extends AbstractLifecycleService<LifecyclePhase, QuitReason> implements IMainLifecycleService {

    // [field]

    /** prevent calling `this.quit()` twice. */
    private _pendingQuitBlocker?: Blocker<void>;

    /** The application is being requested to quit. This may be canceled. */
    private _requestQuit: boolean = false;
    private _ongoingBeforeQuitPromise?: Promise<void>;

    private _windowCount: number = 0;

    // [constructor]

    constructor(@ILogService logService: ILogService) {
        super('Main', LifecyclePhase.Starting, parsePhaseString, logService);
        this.when(LifecyclePhase.Ready).then(() => this.__registerListeners());
    }

    public override async quit(): Promise<void> {
        if (this._pendingQuitBlocker) {
            return this._pendingQuitBlocker.waiting();
        }
        
        this.logService.trace('Main#LifecycleService#quit()');
        this._pendingQuitBlocker = new Blocker<void>();
        
        this.logService.trace('Main#LifecycleService#app.quit()');
        app.quit();

        return this._pendingQuitBlocker.waiting();
    }

    public async kill(exitcode: number = 1): Promise<void> {
        this.logService.trace('Main#LifecycleService#kill()');

        // Give the other services a chance to be notified and complete their job.
        await this.__fireOnBeforeQuit(QuitReason.Kill);

        await Promise.race([
            // ensure wait no more than 1s.
            delayFor(1000),
            // try to kill all the windows
            (async () => {
				for (const window of BrowserWindow.getAllWindows()) {
					if (window && !window.isDestroyed()) {
						let closingPromise: Promise<void>;
						if (window.webContents && !window.webContents.isDestroyed()) {
							closingPromise = new Promise(resolve => window.once('closed', resolve));
						} else {
							closingPromise = Promise.resolve();
						}
						window.destroy();
						await closingPromise;
					}
				}
			})()
        ]);
        
        // quit immediately without asking the user.
        app.exit(exitcode);
    }

    // [private helper methods]

    /**
     * @description Register these listeners: 
     *      - app.on('before-quit'),
     *      - app.on('window-all-closed'),
     *      - app.once('will-quit').
     */
    private __registerListeners(): void {
        this.logService.trace(`Main#LifecycleService#registerListeners()`);
        
        let onWindowAllClosed: () => void;
        let onBeforeQuitAnyWindows: () => void;

        /**
         * Once {@link app.quit} is invoked, electron will emit 'before-quit' 
         * first, then all the windows are closed properly, 'will-quit' will be 
         * emitted. Since it is a 'once' registration, we prevent electron to 
         * terminate the application at the first time so that we can notify
         * the other services before we actual invoke the second {@link app.quit}
         * which will not be prevented and will quit normally.
         */
        app.once('will-quit', (event: Electron.Event) => {
            this.logService.trace('Main#LifecycleService#app.once("will-quit")');

            // Prevent the quit until the promise was resolved
			event.preventDefault();

			this.__fireOnBeforeQuit(QuitReason.Quit)
            .finally(() => {
                this.logService.trace('Main#LifecycleService#application is about to quiting...');

                if (this._pendingQuitBlocker) {
                    this._pendingQuitBlocker.resolve();
                    this._pendingQuitBlocker = undefined;
                }

                /**
                 * We remove all the old listeners so that when we quit again
                 * we will not prevent the next time by calling 'preventDefault()'.
                 */
				app.removeListener('window-all-closed', onWindowAllClosed);
                app.removeListener('before-quit', onBeforeQuitAnyWindows);
				app.quit();
			});
        });

        /**
         * Once we subscribe this, we have the control on whether to quit the 
         * application once all the windows are closed.
         * 
         * @example When user press `cmd + Q` in a electron window or the 
         * function `app.quit()` is invoked, electron will first try to close 
         * all the windows and then emit the `will-quit` event. In this case,
         * 'window-all-closed' will not emit.
         */
        onWindowAllClosed = () => {
            this.logService.trace('Main#LifecycleService#app.addListener("window-all-closed")');
            // mac: only quit when requested
            if (IS_MAC && this._requestQuit) {
                app.quit();
                return;
            }
            // win / linux: quit when all window are all closed
            app.quit();
        };
        app.addListener('window-all-closed', onWindowAllClosed);

        /**
         * Fires if the application quit is requested but before any windows is 
         * closed. Will reached when `app.quit()` was invoked. We need to mark
         * as quit requested for Macintosh optimization purpose.
         */
        onBeforeQuitAnyWindows = () => {
            if (this._requestQuit) {
                return;
            }

            this.logService.trace('Main#LifecycleService#app.addListener("before-quit")');
            this._requestQuit = true;
            
            this.logService.trace('Main#LifecycleService#onBeforeQuit.fire()')
            this._onBeforeQuit.fire();

            /**
             * mac: can run without any window open. in that case we fire the 
             * onWillQuit() event directly because there is no veto to be 
             * expected.
             */
			if (IS_MAC && !this._windowCount) {
				this.__fireOnBeforeQuit(QuitReason.Quit);
			}
        };
        app.addListener('before-quit', onBeforeQuitAnyWindows);
    }

    /**
     * @description We need to notify the other services and give them a chance 
     * to do things before we actual start to quit.
     * @param reason The reason of the quitting.
     * @returns A promise to be wait until all the other listeners are completed.
     */
    private __fireOnBeforeQuit(reason: QuitReason): Promise<void> {

        if (this._ongoingBeforeQuitPromise) {
            return this._ongoingBeforeQuitPromise;
        }

        // notify all listeners
        const participants: Promise<void>[] = [];
        this._onWillQuit.fire({
            reason: reason,
            join: participant => participants.push(participant),
        });

        this._ongoingBeforeQuitPromise = (async () => {
            // we need to ensure all the participants have completed their jobs.
            try {
                await Promise.allSettled(participants);
            } catch (err: any) {
                this.logService.error(err);
            }
        })();

        return this._ongoingBeforeQuitPromise.then(() => this._ongoingBeforeQuitPromise = undefined);
    }
}

function parsePhaseString(phase: LifecyclePhase): string {
    switch (phase) {
        case LifecyclePhase.Starting: return 'Starting';
        case LifecyclePhase.Ready: return 'Ready';
        case LifecyclePhase.Idle: return 'Idle';
    }
}