import * as fs from 'fs';
import { after } from "mocha";
import { TestPath } from "test/utils/utility";
import { fileExists } from "src/base/node/io";

/**
 * The file will be attached before mocha runs the unit tests.
 */

(() => {
    console.log(`[Global Hooks] Global hooks are attached.`);

    /**
     * cleanup after all the unit tests are finished.
     */
    after(async () => {
        console.log(`[Global Hooks] cleanning up unit test resources...`);

        await cleanTestDirectory();

        console.log(`[Global Hooks] cleanning finished.`);
    });
})();

async function cleanTestDirectory() {
    if (fileExists(TestPath)) {
        await fs.promises.rm(TestPath, { maxRetries: 3, retryDelay: 100, force: true, recursive: true });
    }
}