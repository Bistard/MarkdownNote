
/**
 * @description Provides utilities to temporarily replace the global console 
 * object with a "fake" version. This can be useful in testing scenarios where 
 * you want to intercept console log calls or control logging behavior without 
 * affecting the real console.
 */
export namespace FakeConsole {

    export function enable(options: IFakeConsoleOptions): void {
        if (!(options.enable ?? true)) {
            return;
        }

        // customized console log
        console.log = (message?: any, ...optionalParams: any[]) => {
            
            // simply console log to the screen
            if (!options.onLog) {
                trueConsole.log(message, ...optionalParams);
                return;
            }

            // callback
            options.onLog(message);
        };
    }

    export function disable(): void {
        Object.assign(console, trueConsole);
    }
}

export interface IFakeConsoleOptions {

    /**
     * If enable fake console.
     * @default true
     */
    readonly enable?: boolean;

    /**
     * Callback to recieve the log message.
     * @param message the log message.
     */
    readonly onLog?: (message: string) => void;
}

const trueConsole = {
	log: console.log.bind(console),
};
