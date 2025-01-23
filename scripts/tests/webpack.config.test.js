const path = require('path');
const WebpackBaseConfigurationProvider = require('../webpack/webpack.config.base');
const nodeExternals = require('webpack-node-externals');
const { DefinePlugin } = require('webpack');

/**
 * @description The webpack configuration of the application compilation only
 * for unit testing.
 */
class WebpackUnitTestConfigurationProvider extends WebpackBaseConfigurationProvider {

    /** @type {string} Current working directory */
    #cwd;
    #minNodeJsVer = '16.7.0';

    constructor(cwd) {
        super();
        this.#cwd = cwd;
    }

    // [public - configuration initialization]

    construct() {
        this.checkNodeJsRequirement(this.#minNodeJsVer, process.versions.node);

        const testConfiguration = Object.assign(
            super.construct({
                
                // only run in development mode
                mode: 'development',
                cwd: this.#cwd,
                plugins: [
                    new DefinePlugin({
                        'globalThis.APP_FILE_ROOT': JSON.stringify(this.#cwd),
                    }),
                ]
            }), 
            {
                // make sure running in nodejs environment
                target: 'node',

                devtool: 'eval-source-map',

                /**
                 * The top-level output key contains a set of options instructing 
                 * webpack on how and where it should output your bundles, assets, 
                 * and anything else you bundle or load with webpack.
                 * 
                 * @note The following are necessary for debugging purpose.
                 */
                output: {
                    devtoolModuleFilenameTemplate: 'webpack://[absolute-resource-path]',
                },
            },
        );

        // ignore stylesheet loading
        testConfiguration.module.rules.push({
            test: /\.(css|scss|sass)$/,
            loader: path.resolve(this.#cwd, 'scripts/webpack/nullLoader.js'),
        });

        /** 
         * When bundling with Webpack for the backend - you usually don't 
         * want to bundle its `node_modules` dependencies. This library 
         * creates an externals function that ignores `node_modules` when 
         * bundling in Webpack.
         */
        testConfiguration.externals = [nodeExternals()];

        return testConfiguration;
    }
}

// entries
const provider = new WebpackUnitTestConfigurationProvider(process.cwd());
module.exports = provider.construct();