const minimist = require("minimist");
const childProcess = require("child_process");

function log(type, message) {
    const color = (function getColor() {
        switch (type) {
            case 'info': return '';
            case 'warn': return fgColor.LightYellow;
            case 'error': return fgColor.LightRed;
            case 'ok': return fgColor.LightGreen;
            default: return '';
        }
    })();
    const strType = Colors.setANSIColor(centerAlign(type, 6), color);
    console.log(`[${strType}] ${Times.getTime()} ${color}${message}\x1b[0m`);
}

function centerAlign(str, totalLength) {
    if (str.length >= totalLength) {
        return str;
    }
    const leftPadding = Math.floor((totalLength - str.length) / 2);
    return str.padStart(str.length + leftPadding, ' ').padEnd(totalLength, ' ');
}

/**
 * ANSI escape color codes for foreground color.
 */
const fgColor = {
    Reset: '\x1b[39m',
	Black: '\x1b[30m',
    Red: '\x1b[31m',
    Green: '\x1b[32m',
    Yellow: '\x1b[33m',
    Blue: '\x1b[34m',
    Magenta: '\x1b[35m',
    Cyan: '\x1b[36m',
    White: '\x1b[37m',
	LightGray: '\x1b[90m',
    LightRed: '\x1b[91m',
    LightGreen: '\x1b[92m',
    LightYellow: '\x1b[93m',
    LightBlue: '\x1b[94m',
    LightMagenta: '\x1b[95m',
    LightCyan: '\x1b[96m',
    LightWhite: '\x1b[97m',
}

/**
 * ANSI escape color codes for background color.
 */
const bgColor = {
    Reset: '\x1b[49m',
	Black: '\x1b[40m',
    Red: '\x1b[41m',
    Green: '\x1b[42m',
    Yellow: '\x1b[43m',
    Blue: '\x1b[44m',
    Magenta: '\x1b[45m',
    Cyan: '\x1b[46m',
    White: '\x1b[47m',
    LightGray: '\x1b[100m',
    LightRed: '\x1b[101m',
    LightGreen: '\x1b[102m',
    LightYellow: '\x1b[103m',
    LightBlue: '\x1b[104m',
    LightMagenta: '\x1b[105m',
    LightCyan: '\x1b[106m',
    LightWhite: '\x1b[107m',
}

class Colors {
	
    /**
	 * @param {string} text The text to be colored.
	 * @param {string} bgColor The ANSI background color code to set for the text.
	 * @param {string} fgColor The ANSI foreground color code to set for the text.
	 */
	static setANSIColor(text, fgColor, bgColor) {
		return `${fgColor ?? ''}${bgColor ?? ''}${text}\x1b[0m`;
	}

	/**
	 * @param {string} text The text to be colored.
     * @param {number} r 
     * @param {number} g
     * @param {number} b 
	 */
	static setRGBColor(text, r, g, b) {
		return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
	}

    static green(text) {
        return `${fgColor.Green}${text}\x1b[0m`;
    }
    
    static red(text) {
        return `${fgColor.Red}${text}\x1b[0m`;
    }
    
    static yellow(text) {
        return `${fgColor.Yellow}${text}\x1b[0m`;
    }
    
    static gray(text) {
        return `${fgColor.LightGray}${text}\x1b[0m`;
    }
}

class Times {

    /**
     * @description Get the time in string format with the given color.
     * @param {string} color 
     * @example [16:04:08]
     */
    static getTime(color) {
        return color
            ? `${color}[${this.getSimpleCurrTimeStamp()}]\x1b[0m`
            : `${fgColor.LightGray}[${this.getSimpleCurrTimeStamp()}]\x1b[0m`;
    }

    /**
     * @example 2024-04-04 16:04:08.910
     */
    static getCurrTimeStamp() {
        const currentTime = new Date();
        return `${currentTime.getFullYear()}-${(currentTime.getMonth() + 1).toString().padStart(2, '0')}-${currentTime.getDate().toString().padStart(2, '0')} ${(currentTime.getHours()).toString().padStart(2, '0')}:${(currentTime.getMinutes()).toString().padStart(2, '0')}:${(currentTime.getSeconds()).toString().padStart(2, '0')}.${(currentTime.getMilliseconds()).toString().padStart(3, '0')}`;
    }

    /**
     * @example 16:04:08
     */
    static getSimpleCurrTimeStamp() {
        const currentTime = new Date();
        return `${(currentTime.getHours()).toString().padStart(2, '0')}:${(currentTime.getMinutes()).toString().padStart(2, '0')}:${(currentTime.getSeconds()).toString().padStart(2, '0')}`;
    }
}

class ScriptHelper {
    
    /**
     * @param {string} name The script name
     * @return {import('minimist').ParsedArgs}
     * 
     * @deprecated
     */
    static init(name) {
        log('info', `Executing '${name}'...`);
        const args = this.parseCLI();
        log('info', `Script arguments: ${JSON.stringify(args)}`);
        return args;
    }

    /**
     * @param {Record<string, { value?: string, defaultValue: string }>} newEnv 
     * @returns {[string, string][]}
     */
    static setEnv(newEnv) {
        const envPair = [];
        Object.entries(newEnv)
            .forEach(([envName, { value, defaultValue }]) => {
                if (process.env[envName] !== null && process.env[envName] !== undefined) {
                    log('warn', `[ScriptHelper] Overwriting the existing environment: ${envName}`);
                }
                process.env[envName] = value ?? defaultValue;
                envPair.push([envName, value ?? defaultValue]);
            });
        return envPair;
    }
    
    /**
     * @template T
     * @param {T} argv An array of strings representing keys of env variables.
     * @returns {{ [K in T[number]: string] }}
     */
    static getEnv(argv) {
        const argMapping = {};
        for (const arg of argv) {
            argMapping[arg] = process.env[arg];
        }
        return argMapping;
    }

    /**
     * @description Parses the command line interface of the current script.
     * @returns Returning an object that contains all the command line 
     * arguments. Already processed by minimist.
     * 
     * @example
     * ```
     * > node ./scripts/script.js "a" "-b" "--c=d" "---e"
     * { _: [ 'a' ], b: true, c: 'd', '-e': true }
     * ```
     */
    static parseCLI() {
        const CLIArgv = minimist(process.argv.slice(2));
        return CLIArgv;
    }
}

class ScriptProcess {
    
    /**
     * @typedef {import('child_process').StdioPipe} StdioPipe
     * @typedef {import('child_process').ChildProcessByStdio<StdioPipe, StdioPipe, StdioPipe>} ProcOptions
     */

    /**
     * @type {ReturnType<childProcess.spawn>}
     */
    #proc;
    
    /**
     * @type {boolean}
     */
    #spawned = false;
    #spawnPromise;

    /**
     * @type {Promise<number>}
     */
    #waiting;

    /**
     * @param {string} scriptName
     * @param {string} scriptCommand 
     * @param {string[]} commandArgs 
     * @param {string[]} procArgs 
     * @param {ProcOptions & { 
     *      logConfiguration?: [string, string | undefined][]; 
     *      eventHandlers?: Record<string, () => any>; 
     *      onStdin?:  (chuck: any) => void; 
     *      onStdout?: (chuck: any) => void; 
     *      onStderr?: (error: any) => void; 
     * }} procOpts 
     */
    constructor(
        scriptName,
        scriptCommand,
        commandArgs,
        procArgs,
        procOpts,
    ) {
        const cmdArgsString = commandArgs.join(' ');
        const procArgsString = procArgs.join(' ');
        const actualCommand = `${scriptCommand} ${cmdArgsString}`;

        console.log('===========================================================');
        console.log(`\x1B[4m${fgColor.LightGreen}${scriptName}\x1b[0m`);
        console.log(this.#formatKeyValue('Script', scriptCommand));
        console.log(this.#formatKeyValue('Argument', cmdArgsString || 'N/A'));
        console.log(this.#formatKeyValue('Command', actualCommand));
        console.log(this.#formatKeyValue('Process argument', procArgsString || 'N/A'));
        console.log('   Process Environment:');
        console.log(this.#formatKeyValue('CWD', procOpts.cwd || 'N/A', 22));
        console.log(this.#formatKeyValue('shell', procOpts.shell || 'N/A', 22));
        console.log(this.#formatKeyValue('stdio', procOpts.stdio || 'N/A', 22));

        for (const [configName, configValue] of procOpts.logConfiguration ?? []) {
            console.log(this.#formatKeyValue(configName, configValue || 'N/A', 22));
        }
        console.log('');

        // create the actual process
        const startTime = performance.now();
        const p = childProcess.spawn(actualCommand, procArgs, procOpts);
        this.#proc = p;

        let procResolve, procReject;
        this.#waiting = new Promise((res, rej) => {
            procResolve = res;
            procReject  = rej;
        });

        let spawnResolve;
        this.#spawnPromise = new Promise((res, rej) => {
            spawnResolve = res;
        });

        // listeners
        {
            /**
             * Event fires once the child process has spawned successfully.
             */
            p.once('spawn', () => {
                this.#spawned = true;
                spawnResolve();
            });

            /**
             * After the process has ended and the stdio streams of a child 
             * process have been closed.
             */
            p.on('close', code => {
                const type = code ? 'error' : 'ok';
                let finishMessage = code
                    ? `The script '${scriptName}' exits with error code ${code}.`
                    : `The script '${scriptName}' finished.`;

                // perf log
                const endTime = performance.now();
                const spentInSec = (endTime - startTime) / 1000;
                finishMessage += ` Executed in ${Math.round(spentInSec * 100) / 100} seconds.`;


                log(type, `${finishMessage}`);
                if (code) {
                    procReject(code);
                } else {
                    procResolve(0);
                }
            });

            /**
             * The event is emitted whenever:
             *  - The proc cannot be spawned.
             *  - The proc could not be killed.
             *  - Sending a message to the child proc failed.
             *  - The child proc was aborted via the `signal` option.
             */
            p.on('error', error => {
                log('warn', `Script error encounters:`);
                console.log(error);
            });

            // Setup custom event handlers if provided
            if (procOpts.eventHandlers) {
                for (const [event, handler] of Object.entries(procOpts.eventHandlers)) {
                    p.on(event, handler);
                }
            }

            if (procOpts.onStdout) {
                p.stdout.on('data', procOpts.onStdout);
            }
            if (procOpts.onStderr) {
                p.stderr.on('data', procOpts.onStderr);
            }
        }
    }

    /** The actual process reference. */
    get proc() {
        return this.#proc;
    }

    /** Is the process spawned successfully. */
    get isSpawned() {
        return this.#spawned;
    }

    /**
     * @description You may await this method to wait the process has spawned successfully. 
     */
    async spawning() {
        return this.#spawnPromise;
    }

    /**
     * @description You may await this method to wait the process to complete.
     */
    async waiting() {
        return this.#waiting;
    }

    /**
     * Terminates the child process.
     */
    terminate() {
        if (this.#spawned) {
            this.#proc.kill();
        }
    }

    #formatKeyValue(key, value, width = 18) {
        return `   ${key.padEnd(width, ' ')}: ${value}`;
    }
}

class Git {
    static Submodule = class {
        
        /**
         * @param {string} submodulePath 
         * @param {string[]} gitOptions
         * @returns {Promise<void>}
         */
        static async init(submodulePath, gitOptions = []) {
            const proc = new ScriptProcess(
                'git submodule',
                'git submodule update',
                ['--init', ...gitOptions, submodulePath],
                [],
                {
                    env: process.env,
                    cwd: process.cwd(),
                    shell: true,
                    stdio: "inherit",
                }
            );
            return proc.waiting();
        }
    }
}

class SmartRegExp {

    // [fields]

    _source;
    _flag;

    // [constructor]

    constructor(raw, flag) {
        if (typeof raw === 'string') {
            this._source = raw;
            this._flag = flag;
        } else {
            this._source = raw.source;
            this._flag = flag ?? raw.flags;
        }
    }

    // [public methods]

    replace(name, value) {
        let valSource = typeof value === 'string' ? value : value.source;
        valSource = valSource.replace(/(^|[^[])\^/g, '$1');
        this._source = this._source.replaceAll(name, valSource);
        return this;
    }

    get() {
        return new RegExp(this._source, this._flag);
    }
}

// export
module.exports = { 
    log, fgColor, bgColor, 
    Colors, Times, ScriptProcess, ScriptHelper, Git,
    SmartRegExp,
};