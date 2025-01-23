/* eslint-disable */
const path = require('path');
const WebpackBaseConfigurationProvider = require('../../../scripts/webpack/webpack.config.base');
const { KeyToIndexTransformPlugin } = require('../../../scripts/i18n/i18n.plugin');
const { ScriptHelper } = require("../../../scripts/utility");
const { DefinePlugin } = require('webpack');


class WebpackConfigurationProvider extends WebpackBaseConfigurationProvider {

    /** @type {string} Current working directory */
    #cwd;

    constructor(cwd) {
        super();
        this.#cwd = cwd;
    }

    // [public - configuration initialization]

    construct() {
        const baseConfiguration = Object.assign(
            {},
            super.construct({
                mode: "development",
                cwd: this.#cwd,
                watchMode: false,
                plugins: [
                    new KeyToIndexTransformPlugin({
                        logLevel: 'error',
                        sourceCodePath: path.resolve(this.#cwd, './test/build/i18n/src/'),
                        localeOutputPath: path.resolve(this.#cwd, './test/build/i18n/dist/locale/'),
                        localizationFileName: 'en.json',
                        lookupFileName: 'en_lookup_table.json',
                        otherLocales: [],
                    }),
                    new DefinePlugin({
                        'globalThis.APP_FILE_ROOT': JSON.stringify(this.#cwd),
                    }),
                ],
            })
        );

        return [
            this.#constructI18nIntegrationTest(Object.assign({}, baseConfiguration)),
        ];
    }

    #constructI18nIntegrationTest(baseConfiguration) {
        return Object.assign(baseConfiguration, {
            target: 'node',
            entry: './test/build/i18n/src/i18nTestMain.ts',
            output: {
                filename: '[name]-bundle.js',
                path: path.resolve(this.#cwd, './test/build/i18n/dist/'),
            },
        });
    }
}

// entries
ScriptHelper.init('webpack');
const provider = new WebpackConfigurationProvider(process.cwd());
module.exports = provider.construct();