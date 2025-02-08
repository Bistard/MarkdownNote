const fs = require('fs');
const path = require('path');
const { log, SmartRegExp } = require('../utility');

/**
 * {@link localizationGenerator}
 * The class encapsulates the logic for scanning source code to extract
 * localization keys, generating English (en) localization files, validating and 
 * adjusting other locale files, and creating lookup tables for each locale.
 * 
 * Key Features:
 * - Recursively scan a specified source directory to find `localize(key, message)` 
 *      calls.
 * - Extract all localization keys and their default English messages, 
 *      organizing them by file path in a hierarchical JSON structure.
 * - Write out the `en.json` localization file, including all extracted messages.
 * - Validate other locale files against `en.json`, ensuring:
 *      * Missing keys are added with placeholder values.
 *      * Extra keys not in `en.json` are removed.
 *      * Non-existent locale files are created with all keys set to placeholders.
 * - Generate lookup table JSON files (`<locale>_lookup_table.json`) that map 
 *      each key to its localized message. These tables facilitate numeric index 
 *      lookups instead of string-based key lookups, reducing bundle size and 
 *      improving performance.
 * 
 * # Workflow
 * The public API `processAllLocalization()` performs all steps in sequence:
 * 1. Build localization data from source code.
 * 2. Write the primary English localization file.
 * 3. Validate and adjust other locale files.
 * 4. Write all lookup tables for `en` and other locales.
 * 
 * This class does not interact directly with Webpack compilation or assets.
 * It focuses solely on file I/O and data transformations.
 * 
 * @param {object} options
 * @param {string} options.sourceCodePath Path to the source directory containing `.ts` files.
 * @param {string} options.localeOutputPath Path to the directory where localization files should be written.
 * @param {string} options.localizationFilePath Absolute path to the primary English localization file (e.g. `en.json`).
 * @param {string} options.localizationFileName The name of the primary English localization file (e.g. `en.json`).
 * @param {string[]} options.otherLocales An array of other locale identifiers (e.g. `['zh-cn', 'zh-tw']`) that need to be validated and possibly created.
 * @param {string[]} options.localizationKeys An initially empty array that will be populated with unique keys extracted from the source code.
 * @param {Object<string,Object<string,string>>} options.localizationData An initially empty object that will store extracted localization data in the form `{ [relativeFilePath]: { [key]: message } }`.
 * @param {Function} options.logError A logging function that accepts a string error message. Used to log errors and warnings.
 * @param {'warn'|'error'} options.logLevel The level of logging. This determines how the plugin will eventually report issues (e.g., as warnings or errors in Webpack).
 * 
 * @example
 * ```ts
 * // src/dir1/file1.ts
 * const name    = localize('displayName', 'default english name');
 * const content = localize('content', 'default english content');
 * 
 * // Generated en.json
 * {
 *     "contents": {
 *         "src/dir1/file1": {
 *             "displayName": "default english name",
 *             "content": "default english content"
 *         }
 *     }
 * }
 * 
 * // Generated en_lookup_table.json
 * [
 *     "default english name",
 *     "default english content"
 * ]
 * ```
 */
class localizationGenerator {
    /**
     * @param {object} options
     * @param {string} options.sourceCodePath
     * @param {string} options.localeOutputPath
     * @param {string} options.localizationFilePath
     * @param {string} options.localizationFileName
     * @param {Array} options.otherLocales
     * @param {Array} options.localizationKeys
     * @param {Object} options.localizationData
     * @param {Function} options.logError A function to log errors (e.g. provided by KeyToIndexTransformPlugin)
     */
    constructor(options) {
        this.sourceCodePath = options.sourceCodePath;
        this.localeOutputPath = options.localeOutputPath;
        this.localizationFilePath = options.localizationFilePath;
        this.localizationFileName = options.localizationFileName;
        this.otherLocales = options.otherLocales;
        this.localizationKeys = options.localizationKeys;
        this.localizationData = options.localizationData;
        this.logError = options.logError;
    }

    /**
     * A single public API that consolidates all steps:
     * 1. Build localization data
     * 2. Write localization file (en.json)
     * 3. Validate other localization files (defined at this.otherLocales)
     * 4. Write all lookup tables
     */
    generateAndValidate() {
        this.#buildLocalizationData();
        this.#writeLocalizationFile();
        this.#validateOtherLocalizationFiles();
        this.#writeAllLookupTables();
    }

    /**
     * Iterates through the source code directory and extracts localization 
     * keys using the `localize(key, message)` pattern. The results are 
     * stored in `this.localizationData` (grouped by file path) and 
     * `this.localizationKeys` (a unique array of all keys with paths).
     */
    #buildLocalizationData() {
        const files = this.#getAllFiles(this.sourceCodePath);

        files.forEach((filePath) => {
            const relativePath = path.relative(this.sourceCodePath, filePath)
                .replace(/\\/g, '/')       // standardize forward slash
                .replace(/\.[^/.]+$/, ''); // remove file extension
            /**
             * Parse the entire file and try to find `localize`.
             */
            const localizedEntries = this.#parseFile(filePath);

            // Only include files with localize calls
            const hasAnyLocalize = Object.keys(localizedEntries).length > 0;
            if (!hasAnyLocalize) {
                return;
            }
            
            this.localizationData[relativePath] = localizedEntries;
            Object.entries(localizedEntries).forEach(([key]) => {
                const uniqueKey = `${relativePath}|${key}`;
                if (!this.localizationKeys.includes(uniqueKey)) {
                    this.localizationKeys.push(uniqueKey);
                }
            });
        });
    }

    /**
     * Writes the localization data (`this.localizationData`) into a JSON file 
     * (`en.json`) in a standardized format.
     * @note This step creates only the English (`en`) version.
     */
    #writeLocalizationFile() {
        this.#ensureDirectoryExists(this.localizationFilePath);
        const enData = {
            "": [
                "--------------------------------------------------------------------------------------------",
                "Copyright (c) Nota. All rights reserved.",
                "--------------------------------------------------------------------------------------------",
                "Do not edit this file. It is machine generated."
            ],
            version: this.#getPackageVersion(),
            contents: this.localizationData,
        };
        
        fs.writeFileSync(this.localizationFilePath, JSON.stringify(enData, null, 4), 'utf-8');
        log('info', `[Localization] file written: Localization JSON (en) at ${this.localizationFilePath}`);
    }

    /**
     * Handles other localization files by validating or creating them.
     * 
     * Ensures all additional locale files specified in `this.otherLocales` 
     * exist and contain all keys defined in `en.json`. 
     *      - If a locale file is missing, it is created with placeholder 
     *        translations for all keys. 
     *      - If a locale file exists but is missing keys, those keys are added 
     *        with placeholder values.
     */
    #validateOtherLocalizationFiles() {
        const enFilePath = this.localizationFilePath;
        if (!fs.existsSync(enFilePath)) {
            this.logError(`[Localization] error: EN localization file not found at ${enFilePath}. Skipping other locales processing.`);
            return;
        }
    
        const enData = JSON.parse(fs.readFileSync(enFilePath, 'utf-8'));
        const enContents = enData.contents || {};
    
        this.otherLocales.forEach((locale) => {
            const localeFileName = `${locale}.json`;
            const localeFilePath = path.join(this.localeOutputPath, localeFileName);
    
            let localeData;
    
            if (!fs.existsSync(localeFilePath)) {
                // Locale file doesn't exist; create it with placeholders
                localeData = this.#createLocaleFileWithPlaceholders(enData, enContents, localeFileName, localeFilePath);
            } else {
                // Locale file exists; validate and update it
                localeData = this.#validateAndUpdateLocaleFile(enData, enContents, localeFileName, localeFilePath);
            }
    
            if (localeData) {
                // Check and remove extra keys
                const extraFound = this.#removeExtraKeys(localeData, enContents, localeFileName);
                if (extraFound) {
                    fs.writeFileSync(localeFilePath, JSON.stringify(localeData, null, 4), 'utf-8');
                    this.logError(`[Localization] file update: Updated ${localeFileName} by removing extra keys.`);
                }
            }
        });
    }

    /**
     * Generates lookup table files for all supported locales (including English). 
     * The lookup tables map numeric indices to translations and are stored in 
     * separate JSON files (e.g., `en_lookup_table.json`, `zh-cn_lookup_table.json`).
     */
    #writeAllLookupTables() {
        // en_lookup_table.json
        this.#createLocaleLookupTable(this.localizationData, 'en');

        // others
        this.otherLocales.forEach((locale) => {
            const localeFileName = `${locale}.json`;
            const localeFilePath = path.join(this.localeOutputPath, localeFileName);
            if (!fs.existsSync(localeFilePath)) {
                this.logError(`[Localization] error: Cannot create lookup table for ${locale}, file not found.`);
                return;
            }

            const localeFileData = JSON.parse(fs.readFileSync(localeFilePath, 'utf-8'));
            const localeContents = localeFileData.contents || {};
            this.#createLocaleLookupTable(localeContents, locale);
        });
    }

    // [private helper methods]

    #createLocaleFileWithPlaceholders(enData, enContents, localeFileName, localeFilePath) {
        const localeData = JSON.parse(JSON.stringify(enData));
        this.#fillDataWithPlaceholders(localeData, enContents, localeFileName, "file does not exist.");
        fs.writeFileSync(localeFilePath, JSON.stringify(localeData, null, 4), 'utf-8');
        this.logError(`[Localization] error: Created ${localeFileName} with placeholder translations because it did not exist.`);
        return localeData;
    }
    
    #validateAndUpdateLocaleFile(enData, enContents, localeFileName, localeFilePath) {
        let localeData;
    
        try {
            localeData = JSON.parse(fs.readFileSync(localeFilePath, 'utf-8'));
        } catch (e) {
            return this.#createLocaleFileWithPlaceholders(enData, enContents, localeFileName, localeFilePath);
        }
    
        localeData.contents ??= {};
        localeData.version = enData.version;
    
        let missingFound = false;
        for (const [filePath, enKeys] of Object.entries(enContents)) {
            localeData.contents[filePath] ??= {};
            for (const [key, enValue] of Object.entries(enKeys)) {
                if (!localeData.contents[filePath].hasOwnProperty(key) // missing key
                    || localeData.contents[filePath][key] === ''       // empty value
                ) {
                    localeData.contents[filePath][key] = "";
                    this.logError(`[Localization] error (missing translation): In ${localeFileName}, missing key: "${key}" under "${filePath}". Placeholder inserted.`);
                    missingFound = true;
                }
            }
        }
    
        if (missingFound) {
            fs.writeFileSync(localeFilePath, JSON.stringify(localeData, null, 4), 'utf-8');
            log('info', `[Localization] file update: Updated ${localeFileName} with missing keys placeholders.`);
        } else {
            log('info', `[Localization] validation complete: ${localeFileName} localization file.`);
        }
    
        return localeData;
    }
    
    #removeExtraKeys(localeData, enContents, localeFileName) {
        let extraFound = false;
    
        for (const [localeFilePathKey, localeKeys] of Object.entries(localeData.contents)) {
            // If the filePath doesn't exist in enContents, remove entire block in that locale file.
            if (!enContents.hasOwnProperty(localeFilePathKey)) {
                delete localeData.contents[localeFilePathKey];
                this.logError(`[Localization] error: In ${localeFileName}, found extra filePath "${localeFilePathKey}" not present in EN. Removed entire block.`);
                extraFound = true;
                continue;
            }
    
            // Otherwise, check individual keys
            for (const localeKey of Object.keys(localeKeys)) {
                if (!enContents[localeFilePathKey].hasOwnProperty(localeKey)) {
                    delete localeData.contents[localeFilePathKey][localeKey];
                    this.logError(`[Localization] error: In ${localeFileName}, found extra key "${localeKey}" under "${localeFilePathKey}" not present in EN. Removed this key.`);
                    extraFound = true;
                }
            }
        }
    
        return extraFound;
    }

    #createLocaleLookupTable(localeData, locale) {
        const lookupTable = this.localizationKeys.map((uniqueKey) => {
            const [relativePath, key] = uniqueKey.split('|');
            const translation = localeData[relativePath]?.[key] ?? '';
            return translation;
        });

        const localeLookupTableFilePath = path.join(this.localeOutputPath, `${locale}_lookup_table.json`);
        this.#ensureDirectoryExists(localeLookupTableFilePath);
        fs.writeFileSync(localeLookupTableFilePath, JSON.stringify(lookupTable, null, 4), 'utf-8');
        log('info', `[Localization] file written: Lookup table at ${localeLookupTableFilePath}`);
    }

    #fillDataWithPlaceholders(localeData, enContents, localeFileName, warningReason) {
        if (!localeData.contents) {
            localeData.contents = {};
        }

        for (const [filePath, enKeys] of Object.entries(enContents)) {
            if (!localeData.contents[filePath]) {
                localeData.contents[filePath] = {};
            }
            for (const [key] of Object.entries(enKeys)) {
                localeData.contents[filePath][key] = "";
                this.logError(`[Localization] error: In ${localeFileName}, ${warningReason} Inserted placeholder for key: "${key}" under "${filePath}".`);
            }
        }
    }

    #getAllFiles(dirPath, arrayOfFiles = []) {
        const files = fs.readdirSync(dirPath);

        files.forEach((file) => {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                arrayOfFiles = this.#getAllFiles(filePath, arrayOfFiles);
            } else if (file.endsWith('.ts')) {
                arrayOfFiles.push(filePath);
            }
        });

        return arrayOfFiles;
    }

    #parseFile(filePath) {
        const LOCALIZE_REGEX = 
            new SmartRegExp(/localize\(quote(str)quote,\s*quote(str)quote[\),]/g)
            .replace('str', /.*?/)
            .replace('quote', /["'`]/)
            .get();
        let fileContent = fs.readFileSync(filePath, 'utf-8');
        fileContent = removeComments(fileContent);

        const entries = {};
        let match;
        while ((match = LOCALIZE_REGEX.exec(fileContent)) !== null) {
            const [_, key, defaultMessage] = match;
            if (!entries[key]) {
                entries[key] = defaultMessage;
            }
        }
        return entries;
    }

    #ensureDirectoryExists(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    #getPackageVersion() {
        try {
            const rootPath = path.resolve(this.sourceCodePath, '../package.json');
            const packageJson = JSON.parse(fs.readFileSync(rootPath, 'utf-8'));
            return packageJson.version;
        } catch (error) {
            log('warn', '[Localization] Error reading package.json:', error.message);
            return '0.0.0';
        }
    }
}

function removeComments(content) {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
}

module.exports = { localizationGenerator };
