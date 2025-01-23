const path = require("path");
const { ScriptProcess, ScriptHelper, log } = require("../utility");

(async () => {
    const cwd     = process.cwd();
    const CLIArgv = ScriptHelper.init('build');
    const envPair = ScriptHelper.setEnv({
        CIRCULAR: { 
            value: CLIArgv.circular ?? CLIArgv.c, 
            defaultValue: 'false' 
        },
        WATCH_MODE: {
            value: CLIArgv.watch ?? CLIArgv.w,
            defaultValue: 'false',
        },
        BUILD_MODE: {
            value: CLIArgv.mode,
            defaultValue: 'development',
        },
        i18n_error: {
            value: CLIArgv.i18nError,
            defaultValue: 'false',
        }
    });

    /**
     * compile codicon
     */
    const codicon = new ScriptProcess(
        'codicon',
        `node ${path.join(cwd, './scripts/icons/codicon.js')}`,
        [],
        [],
        {
            env: process.env,
            cwd: cwd,
            shell: true,
            stdio: "inherit",
        }
    );
    
    try {
        await codicon.waiting();
    } catch (err) {
        process.exit(1);
    }

    /**
     * @description A simple Node.js script to monitor the root `package.json` 
     * for changes. When `package.json` updates, it regenerates a corresponding 
     * `product.json` file.
     */
    const product = new ScriptProcess(
        'product',
        `node ${path.join(cwd, './scripts/build/product.js')}`,
        [],
        [],
        {
            env: process.env,
            cwd: cwd,
            shell: true,
            stdio: "inherit"
        },
    );
    await product.spawning().catch(err => log('error', err));

    /**
     * build with webpack
     */
    const webpack = new ScriptProcess(
        'webpack',
        'webpack',
        ['--config', './scripts/build/webpack.config.js'],
        [],
        {
            env: process.env,
            cwd: cwd,
            shell: true,
            logConfiguration: [
                ['ELECTRON_VER', process.versions.electron ?? 'N/A'],
                ['CHROME_VER', process.versions.chrome ?? 'N/A'],
                ['V8_VER', process.versions.v8 ?? 'N/A'],
                ['NODE_VER', process.versions.node ?? 'N/A'],
                ...envPair,
            ],
            stdio: "inherit"
        },
    );

    try {
        await webpack.waiting();
    } catch (err) {
        process.exit(1);
    }
})();