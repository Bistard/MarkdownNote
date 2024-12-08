const CircularDependencyPlugin = require('circular-dependency-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const WebpackBaseConfigurationProvider = require('../webpack/webpack.config.base');
const { ScriptHelper } = require('../utility');

class KeyToIndexTransformPlugin {
    constructor(localeFilePath) {
        this.localeFilePath = localeFilePath;
        this.keyMap = {};
        this.loadKeyMap();
    }

    apply(compiler) {
        compiler.hooks.thisCompilation.tap('KeyToIndexTransformPlugin', (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'KeyToIndexTransformPlugin',
                    stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
                },
                (assets) => {
                    Object.keys(assets).forEach((filename) => {
                        // Only process renderer-bundle.js
                        if (filename === 'renderer-bundle.js') {
                            console.log(`[KeyToIndexTransformPlugin] Transforming file: ${filename}`);
                            const asset = compilation.getAsset(filename);
                            const source = asset.source.source().toString();
                            const transformed = this.transformSource(source);

                            if (transformed !== source) {
                                compilation.updateAsset(
                                    filename,
                                    new webpack.sources.RawSource(transformed)
                                );
                                console.log(`[KeyToIndexTransformPlugin] Successfully transformed ${filename}`);
                            } else {
                                console.log(`[KeyToIndexTransformPlugin] No transformations applied to ${filename}`);
                            }
                        }
                    });
                }
            );
        });
    }

    loadKeyMap() {
        console.log(`[KeyToIndexTransformPlugin] Loading locale file from: ${this.localeFilePath}`);

        if (fs.existsSync(this.localeFilePath)) {
            try {
                const rawData = fs.readFileSync(this.localeFilePath, 'utf-8');
                const jsonData = JSON.parse(rawData);

                if (Array.isArray(jsonData)) {
                    jsonData.forEach((key, index) => {
                        this.keyMap[key] = index;
                    });
                    console.log(`[KeyToIndexTransformPlugin] Loaded key map: ${JSON.stringify(this.keyMap, null, 2)}`);
                } else {
                    throw new Error('Locale file JSON is not an array of keys.');
                }
            } catch (error) {
                console.error(`[KeyToIndexTransformPlugin] Error loading locale file: ${error.message}`);
            }
        } else {
            console.error(`[KeyToIndexTransformPlugin] Locale file not found at: ${this.localeFilePath}`);
        }
    }

    transformSource(source) {
        let transformed = source;
        // Replace all occurrences of 'key' with their index.
        // Note the single quotes around the keys.
        for (const [key, index] of Object.entries(this.keyMap)) {
            const regex = new RegExp(`'${key}'`, 'g');
            transformed = transformed.replace(regex, index.toString());
        }
        return transformed;
    }
}

class WebpackPluginProvider {
    constructor() {}

    /**
     * @param {{
    *      cwd: string;
    *      circular?: boolean;
    * } | undefined} opts 
    */
    getPlugins(opts) {
        const plugins = [];
        const cwd = opts.cwd;

        if (!cwd || typeof cwd !== 'string') {
            console.log(`[WebpackPluginProvider] CWD is not provided or provided with wrong type: '${typeof cwd}'!`);
        }

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

        const MAX_CYCLES = 0;
        let detectedCycleCount = 0;

        if (opts && opts.circular) {
            plugins.push(
                new CircularDependencyPlugin({
                    exclude: /a\.js|node_modules/,
                    include: /src/,
                    cwd: cwd,
                    failOnError: true,
                    allowAsyncCycles: false,

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
                })
            );
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
    #buildMode;
    #isWatchMode;
    #isCircular;

    constructor(cwd) {
        super();
        this.#cwd = cwd;

        /** @type {['BUILD_MODE', 'WATCH_MODE', 'CIRCULAR']} */
        const envList = ['BUILD_MODE', 'WATCH_MODE', 'CIRCULAR'];
        const env = ScriptHelper.getEnv(envList);

        console.log(`   🌍 Webpack environments: ${JSON.stringify(env)}`);

        // init environment constant
        this.#buildMode   = env.BUILD_MODE;
        this.#isWatchMode = env.WATCH_MODE == 'true';
        this.#isCircular  = env.CIRCULAR == 'true';
    }

    // [public - configuration initialization]
    construct() {
        this.checkNodeJsRequirement(this.#minNodeJsVer, process.versions.node);

        // base configuration
        const baseConfiguration = Object.assign(
            {},
            super.construct({
                mode: this.#buildMode,
                cwd: this.#cwd,
                watchMode: this.#isWatchMode,
                plugins: new WebpackPluginProvider().getPlugins({
                    cwd: this.#cwd,
                    circular: this.#isCircular,
                }),
            })
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
                        },
                    },
                },
            ],
        });

        return [
            this.#constructMainProcess(Object.assign({}, baseConfiguration)),
            this.#constructRendererProcess(Object.assign({}, baseConfiguration)),
            this.#constructInspectorProcess(Object.assign({}, baseConfiguration)),
        ];
    }

    #constructMainProcess(baseConfiguration) {
        return Object.assign(baseConfiguration, {
            target: 'electron-main',
            entry: { main: './src/main.js' },
            output: {
                filename: '[name]-bundle.js',
                path: path.resolve(this.#cwd, this.#distPath),
            },
        });
    }

    #constructRendererProcess(baseConfiguration) {
        return Object.assign(baseConfiguration, {
            target: 'electron-renderer',
            entry: { renderer: './src/code/browser/renderer.desktop.ts' },
            output: {
                filename: '[name]-bundle.js',
                path: path.resolve(this.#cwd, this.#distPath),
            },
        });
    }

    #constructInspectorProcess(baseConfiguration) {
        return Object.assign(baseConfiguration, {
            target: 'electron-renderer',
            entry: { renderer: './src/code/browser/inspector/renderer.inspector.ts' },
            output: {
                filename: '[name]-inspector-bundle.js',
                path: path.resolve(this.#cwd, this.#distPath),
            },
        });
    }
}

// entries
ScriptHelper.init('webpack');
const provider = new WebpackConfigurationProvider(process.cwd());
module.exports = provider.construct();
