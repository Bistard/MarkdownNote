/**
 * # Command Line Interface Documentation (CLI Doc)
 * 
 * This script can be invoked from `package.json`.
 * 
 * The script acts like a central management that can access all the pre-defined
 * scripts. The script configurations can be found at {@link SCRIPT_CONFIG_PATH}.
 */

const childProcess = require("child_process");
const path = require("path");
const { utils, Colors, Times } = require('./utility');

/**
 * @typedef {import('./script.config.js').ScriptConfiguration} ScriptConfiguration
 */

const SCRIPT_CONFIG_PATH = './script.config.js';
const USAGE = `
Usage: npm run script <command> [--] [options]

    Execute a script command with optional arguments. Available commands include running specific scripts, listing all available scripts, and displaying this help message.

Commands:
    <command>    Execute the specified script with optional arguments.
    list         Display a list of all available scripts.
    help         Show this usage information.

Examples:
    npm run script help               Display this usage information.
    npm run script list               List all available scripts.
    npm run script start -- -a --arg1 Optional arguments can be passed after the '--'.

Note:
    Use '--' before specifying any arguments to ensure they are correctly passed to the script.
`;
const HELP_STRING = `Help Guide:

- To execute a specific script along with any optional arguments, use the following format:
    npm run script <command> [--] [options]

- To view all available scripts and understand their purpose, run:
    npm run script list

- For a summary of usage commands and examples, use:
    npm run script help

Feel free to append '--' before any options to ensure they are passed correctly to the script.
`;
const INVALID_SCRIPT_COMMAND = `Error: The script command you entered is not recognized or improperly formatted.

Quick Tips:
- Ensure the command follows the structure: npm run script <command> [--] [options]
- For a list of available commands, run: npm run script list
- For further assistance, refer to: npm run script help
`;

(async function () {
    
    // Read script configuration
    const scriptconfiguration = require(SCRIPT_CONFIG_PATH);

    // try interpret CLI
    const cliArgs = process.argv.slice(2);
    const [cmd, args] = validateCLI(cliArgs);

    // actual execution
    if (cmd === 'help') {
        executeHelp();
    } 
    else if (cmd === 'list') {
        executeList(scriptconfiguration);
    }
    else {
        executeScript(cmd, args, scriptconfiguration);
    }
})();

// #region Helper Functions

/**
 * @param {string[]} args 
 * @returns {[string, string[]]}
 */
function validateCLI(args) {
    const command = args[0];
    if (!command) {
        process.stderr.write(`${Times.getTime()} ${Colors.red('Invalid Script Command')}\n ${INVALID_SCRIPT_COMMAND}`);
        process.exit(1);
    }
    return [command, args.slice(1)];
}

function executeHelp() {
    console.log(USAGE);
}

/**
 * @param {ScriptConfiguration} configuration 
 */
function executeList(configuration) {
    console.log(`${'[command]'.padStart(10, ' ')}`);
    
    for (const [cmdName, config] of Object.entries(configuration)) {
        
        const { _command, description, options } = config;
        const coloredName = Colors.green(config.commandDescription ?? cmdName);
        console.log(coloredName);
        console.log(description);
        
        if (!options) {
            continue;
        }
        
        for (const opt of options) {
            console.log(`${''.padEnd(6, ' ')}${opt.flags.join(', ')}`);
            for (const desc of opt.descriptions) {
                console.log(`${''.padEnd(10, ' ')}${desc}`);
            }
        }
    }
}

/**
 * @param {string} command 
 * @param {string[]} args 
 * @param {ScriptConfiguration} configuration
 */
function executeScript(command, args, configuration) {

    // validate the corresponding script configuration
    let scriptConfiguration = configuration[command];
    if (!scriptConfiguration) {
        console.log(`Invalid script command '${command}'. ${HELP_STRING}.`);
        process.exit(1);
    }

    // concat the command in string
    const actualCommand = scriptConfiguration.command + ' ' + args.join(' ');
    console.log(`${Times.getTime()} Executing script: ${utils.c.BgWhite}${utils.c.FgBlack}${command}\x1b[0m`);
    console.log(`${Times.getTime()} Executing command: ${actualCommand}`);
    
    // run command with a new process
    const proc = childProcess.spawn(
        actualCommand, 
        [], 
        {
            env: process.env,
            cwd: path.resolve(__dirname, '../'), // redirect the cwd to the root directory
            shell: true,

            // inherits the stdin / stdout / stderr
            stdio: "inherit",
        },
    );

    // listeners
    proc.on('close', (code) => {
        if (code) {
            process.stderr.write(`${Times.getTime()} ${Colors.red(`The script '${command}' exits with error code ${code}.\n`)}`);
            process.exit(code);
        } else {
            process.exit(0);
        }
    });
}

// #endregion