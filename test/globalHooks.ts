import * as fs from 'fs';
import * as os from 'os';
import * as mocha from "mocha";
import { TestPath } from "test/utils/testService";
import { fileExists } from "src/base/node/io";
import { ASNIForegroundColor, TextColors } from 'src/base/common/color';
import { Pair } from 'src/base/common/utilities/type';
import { errorToMessage } from 'src/base/common/utilities/panic';
import { initGlobalCssVariables } from 'src/base/browser/basic/dom';

/**
 * This file will be attached before mocha runs the unit tests.
 */

interface IUnhandled {
    readonly testName: string;
    readonly error: unknown;
}

const hook = new class extends class GlobalHooks {

    // [fields]

    private readonly _unhandled: { readonly exceptions: IUnhandled[]; readonly rejections: IUnhandled[]; };
    private _currentTest: Mocha.Test | undefined;

    // [constructor]

    constructor() {
        this._unhandled = { exceptions: [], rejections: [] };
        this._currentTest = undefined;

        initGlobalCssVariables();
    }

    // [public methods]

    /**
     * @description Attach the hook to the global environment of Mocha.
     */
    public attach(): void {
        
        // beginning text
        console.log(TextColors.setANSIColor(`[Global Hook]`, { fgColor: ASNIForegroundColor.Green }), `Global hook are attached on the environment '${os.platform()}'`);
        mocha.before(() => this.__cleanup());

        // register listeners
        this.__registerMochaListeners();
        this.__registerProcessListeners();

        // set `after` hook
        mocha.after(() => this.__onAllTestsComplete());
    }

    // [private methods]

    private __registerMochaListeners(): void {
        const setCurrentTest = (test?: Mocha.Test) => { this._currentTest = test; };

        mocha.beforeEach(function () {
            setCurrentTest(this.currentTest);
        });
        
        mocha.afterEach(function () {
            setCurrentTest(undefined);
        });
    }

    private __registerProcessListeners(): void {
        process.on('uncaughtException', err => {
            const fullTestName = this._currentTest?.titlePath().join(' -> ') || 'Unknown';
            const testName = this._currentTest?.title || 'Unknown';

            console.log(TextColors.setANSIColor(`[Global Hooks]`, { fgColor: ASNIForegroundColor.Red }), `Detect uncaughtException (${testName}): '${errorToMessage(err)}'`);
            this._unhandled.exceptions.push({ testName: fullTestName, error: err });
        });
    
        process.on('unhandledRejection', reason => {
            const fullTestName = this._currentTest?.titlePath().join(' -> ') || 'Unknown';
            const testName = this._currentTest?.title || 'Unknown';

            console.log(TextColors.setANSIColor(`[Global Hooks]`, { fgColor: ASNIForegroundColor.Red }), `Detect unhandledRejection (${testName}): '${errorToMessage(reason)}'`);
            this._unhandled.rejections.push({ testName: fullTestName, error: reason });
        });
    }

    private async __onAllTestsComplete(): Promise<void> {
        this.__resolveUnhandled();
        this.__cleanup();
    }

    private __resolveUnhandled(): void {
        
        // no exceptions and rejections
        if (!this._unhandled.exceptions.length && !this._unhandled.rejections.length) {
            return;
        }

        (<Pair<string, IUnhandled[]>[]>[
            ['Exceptions', this._unhandled.exceptions],
            ['Rejections', this._unhandled.rejections],
        ])
        .forEach(([type, unHandled]) => {
            if (!unHandled.length) {
                return;
            }
            
            console.log(TextColors.setANSIColor(`[Global Hook]`, { fgColor: ASNIForegroundColor.Red }), `Detected unhandled${type}: ${unHandled.length}`);
            unHandled.forEach((unhandled, index) => {
                console.log(TextColors.setANSIColor(`${index + 1}. "${unhandled.testName}"`, { fgColor: ASNIForegroundColor.Red }));
            });
        });
    }

    private async __cleanup(): Promise<void> {
        console.log(TextColors.setANSIColor(`[Global Hook]`, { fgColor: ASNIForegroundColor.Yellow }), 'cleaning up unit test resources...');
        
        try {
            await this.__cleanTestDirectory();
            console.log(TextColors.setANSIColor(`[Global Hook]`, { fgColor: ASNIForegroundColor.Green }), `cleaning finished`);
        } catch (err) {
            console.log(TextColors.setANSIColor(`[Global Hook]`, { fgColor: ASNIForegroundColor.Red }), `cleaning process encounters an error: '${errorToMessage(err)}'`);
        }
    }

    private async __cleanTestDirectory(): Promise<void> {
        if (await fileExists(TestPath)) {
            await fs.promises.rm(TestPath, { maxRetries: 3, retryDelay: 100, force: true, recursive: true });
        }
    }
    
} {};

hook.attach();
