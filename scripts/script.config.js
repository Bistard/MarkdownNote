// @ts-check

/**
 * @typedef {Record<string, { 
 *      command: string, 
 *      commandDescription?: string,
 *      description: string, 
 *      options?: { flags: string[], descriptions: string[] }[]
 * }>} ScriptConfiguration
 */

/** 
 * @description An object that describes all the valid scripts in the project.
 * @type {ScriptConfiguration} 
 */
const configuration = {
    
    "run": {
        command: "electron . --- --log=info",
        description: 'Run program.'
    },

    "_run": {
        command: "electron . --- --log=trace --open-devtools",
        description: 'Run program in develop mode.'
    },

    "build": {
        command: "node ./scripts/build/build.js",
        description: 'Build the program.',
        options: [
            {
                flags: ['--watch', '-w'],
                descriptions: [
                    'Turn on watch mode. This means that after the initial build, webpack will continue to watch for changes in any of the resolved files.',
                    'default = false.',
                ]
            },
            {
                flags: ['--circular', '-c'], 
                descriptions: [
                    'Turn on the dependency circular check. It will start detecting any direct or indirect circular dependencies among all the used modules.',
                    'default = true.',
                ]
            },
            {
                flags: ['--mode'],
                descriptions: [
                    'Choose the building mode. The value can be either "development", "production" or "none".',
                    'default = "development"',
                ]
            }
        ]
    },

    "watch": {
        command: "npm run script build -- --watch=true --circular=false",
        description: 'Build the program and wait to rebuild by watching the change of the source directory.'
    },

    "start": {
        command: "npm run script build && electron .",
        description: 'Build program and run program.',
        options: [
            {
                flags: ['--log=<level>'],
                descriptions: [
                    'Sets the logging level of the application, the <level> can be either "trace", "debug", "info", "warn", "error", "fatal".',
                    'default = info.',
                ]
            },
            {
                flags: ['--open-devtools'],
                descriptions: [
                    'Open a developer tool along with every window.',
                    'default = false.',
                ]
            }
        ]
    },

    "_start": {
        command: "npm run script start -- --log=trace --open-devtools",
        description: 'Build program and run program in develop mode.'
    },

    "test": {
        command: "node ./scripts/tests/mochaRunner.js",
        description: 'Run all the unit tests stores in the files which end with .test.ts under the ./test directory. If any of the tests or suites are marked as `only`, the command will only execute those.\n' +
                      'e.g. Writing `suite.only(\'suite-name\', () => {})` in the source file.',
        options: [
            {
                flags: ['(-g | --grep) <pattern>'],
                descriptions: [
                    'Run all the unit tests that match the regular expression <pattern>.',
                    'For example, `npm run script test -- -g \'z\'` will match any unit tests that contain the letter `z`.',
                ]
            },
            {
                flags: ['--watch'],
                descriptions: [
                    'Build the program and wait to rebuild by watching the change of the source directory.',
                ],
            }
        ]
    },

    "lint": {
        command: 'eslint . --format=./scripts/linting/formatter.js',
        description: 'The eslint . command runs the ESLint tool on all JavaScript and TypeScript files in the current directory and subdirectories, checking for and reporting any coding errors or stylistic issues based on your configuration rules.',
        options: [
            {
                flags: ['--fix'],
                descriptions: [
                    'Automatically fixes problems that can be fixed without any risk.'
                ]
            }
        ]
    },

    "codicons": {
        command: 'node ./scripts/icons/codicon.js',
        description: 'Compiles the all project-related icons from svg format into a font file. All the icons are stored at "https://github.com/Bistard/nota-codicons.git". The command will fetch the latest version and compile them. The more detailed configuration is at "src/base/browser/icon/.fantasticonrc.js".'
    },

    "benchmark": {
        command: "node benchmark/benchmark.js",
        description: 'Run the benchmark tests.'
    },
}

module.exports = configuration;