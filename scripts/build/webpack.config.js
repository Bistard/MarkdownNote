const utils = require('../utility');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require('path');
const WebpackBaseConfigurationProvider = require('../webpack/webpack.config.base');

class WebpackPluginProvider {

    // [field]

    /** @type {string} Current working directory */
    #cwd;

    // [constructor]

    constructor(cwd) {
        this.#cwd = cwd;
        if (!cwd || typeof cwd != 'string') {
            console.log(`${utils.color(utils.c.FgYellow, '[WebpackPluginProvider]')} cwd is not provided or provided with wrong type: '${typeof cwd}'!`);
        }
    }

    // [public methods]

    /**
     * @param {{
     *      circular?: boolean;
     * } | undefined} opts 
     */
    getPlugins(opts) {

        const plugins = [];
        
        /**
         * mini-css-extract plugin
         * 
         * This plugin extracts CSS into separate files. It creates a CSS file per 
         * JS file which contains CSS. It supports On-Demand-Loading of CSS and 
         * SourceMaps.
         */
        plugins.push(new MiniCssExtractPlugin({
            filename: 'index.css',
        }));
    
        /**
         * circular dependency plugin
         */

        const MAX_CYCLES = 3;
        let detectedCycleCount = 0;

        if (opts && opts.circular) {
            plugins.push(new CircularDependencyPlugin(
                {
                    exclude: /a\.js|node_modules/,
                    include: /src/,
                    cwd: this.#cwd,
                    
                    // `onStart` is called before the cycle detection starts
                    onStart({ _compilation }) {
                        console.log('start detecting webpack modules cycles');
                    },

                    // `onDetected` is called for each module that is cyclical
                    onDetected({ module: _webpackModuleRecord, paths, compilation }) {
                        // `paths` will be an Array of the relative module paths that make up the cycle
                        // `module` will be the module record generated by webpack that caused the cycle
                        detectedCycleCount++;
                        console.log(`detecting webpack modules cycle:\n${paths.join(' -> ')}`);
                        compilation.warnings.push(new Error(paths.join(' -> ')));
                    },
                    
                    // `onEnd` is called before the cycle detection ends
                    onEnd({ compilation }) {
                        console.log('end detecting webpack modules cycles');
                        if (detectedCycleCount > MAX_CYCLES) {
                            compilation.errors.push(new Error(`Detected ${detectedCycleCount} cycles which exceeds configured limit of ${MAX_CYCLES}`));
                        }
                    },
                }
            ));
        }
        
        return plugins;
    }
}

/**
 * @description The general webpack configuration of the application compilation.
 */
class WebpackConfigurationProvider extends WebpackBaseConfigurationProvider {

    #distPath = './dist';
    #minNodeJsVer = '16.7.0';
    
    /** @type {string} Current working directory */
    #cwd;

    /** @type {string} environment mode */
    #envMode;
    #isWatchMode;

    constructor(cwd) {
        super();
        this.#cwd = cwd;

        // init environment constant
        this.#envMode = process.env.NODE_ENV ?? 'development';
        this.#isWatchMode = (process.env.WATCH_MODE == 'true');
    }

    // [public - configuration initialization]

    consturct() {
        this.checkNodeJsRequirement(this.#minNodeJsVer, process.versions.node);

        // base configuration
        const baseConfiguration = Object.assign(
            {},
            super.construct({
                mode: this.#envMode,
                cwd: this.#cwd,
                watchMode: this.#isWatchMode,
                plugins: (new WebpackPluginProvider()).getPlugins({ 
                    circular: process.env.CIRCULAR === 'true', 
                }),
            }),
        );
        
        // compiles SCSS files to CSS files
        baseConfiguration.module.rules.push({
            test: /\.(css|scss|sass)$/,
            use: [
                MiniCssExtractPlugin.loader, 
                'css-loader', 
                {
                    loader: 'sass-loader',
                    options: {
                        sassOptions: {
                            includePaths: [path.resolve(this.#cwd, 'src/')],
                        }
                    }
                }
            ],
        });

        return [
            this.#constructMainProcess(Object.assign({}, baseConfiguration)),
            this.#constructRendererProcess(Object.assign({}, baseConfiguration)),
            // this.#consturctLookupProcess(Object.assign({}, baseConfiguration)),
        ];
    }

    // [private - configuration construction]

    #constructMainProcess(baseConfiguration) {
        const mainConfiguration = 
            Object.assign(
                baseConfiguration, 
                {
                    target: 'electron-main',
                    entry: {
                        main: './src/main.js',
                    },
                    output: {
                        filename: '[name]-bundle.js',
                        path: path.resolve(this.#cwd, this.#distPath)
                    },
                },
            );
        return mainConfiguration;
    }

    #constructRendererProcess(baseConfiguration) {
        const rendererConfiguration = 
            Object.assign(
                baseConfiguration, 
                {
                    target: 'electron-renderer',
                    entry: {
                        renderer: './src/code/browser/renderer.ts',
                    },
                    output: {
                        filename: '[name]-bundle.js',
                        path: path.resolve(this.#cwd, this.#distPath)
                    },
                },
            );
        return rendererConfiguration;
    }

    #consturctLookupProcess(baseConfiguration) {
        const lookupConfiguraion = 
            Object.assign(
                baseConfiguration, 
                {
                    target: 'electron-renderer',
                    entry: {
                        renderer: './src/code/browser/lookup/browser.lookup.ts',
                    },
                    output: {
                        filename: '[name]-lookup-bundle.js',
                        path: path.resolve(this.#cwd, this.#distPath)
                    },
                },
            );
        return lookupConfiguraion;
    }
}

// entries
const provider = new WebpackConfigurationProvider(process.cwd());
module.exports = provider.consturct();