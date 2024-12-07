const fs = require('fs');
const path = require('path');

const DIRECTORY_PATH = path.join(__dirname, '../../src');
const OUTPUT_FILE = path.join(__dirname, '../../.wisp/locale/en.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '../../package.json');

// Helper to ensure a directory exists
function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
}

// Function to read package.json version
function getPackageVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
        return packageJson.version;
    } catch (error) {
        console.error('Error reading package.json:', error.message);
        process.exit(1);
    }
}

// Function to generate localization JSON
function generateLocalizationJSON() {
    const version = getPackageVersion();
    const allFiles = getAllFiles(DIRECTORY_PATH);
    const localizationData = {
        "": [
            "--------------------------------------------------------------------------------------------",
            "Copyright (c) Your Company. All rights reserved.",
            "Licensed under the MIT License. See License.txt in the project root for license information.",
            "--------------------------------------------------------------------------------------------",
            "Do not edit this file. It is machine generated."
        ],
        version,
        contents: {}
    };

    allFiles.forEach((filePath) => {
        const relativePath = path.relative(DIRECTORY_PATH, filePath).replace(/\\/g, '/');
        const localizedEntries = parseFile(filePath);

        if (Object.keys(localizedEntries).length > 0) {
            localizationData.contents[relativePath] = localizedEntries;
        }
    });

    // Ensure the directory exists
    ensureDirectoryExists(OUTPUT_FILE);

    // Write the output file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(localizationData, null, 4), 'utf-8');
    console.log(`Localization JSON written to ${OUTPUT_FILE}`);
}

// Recursively get all .ts files
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach((file) => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
            arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
        } else if (file.endsWith('.ts')) {
            arrayOfFiles.push(path.join(dirPath, file));
        }
    });

    return arrayOfFiles;
}

// Parse a file for localize calls
function parseFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    const entries = {};
    lines.forEach((line) => {
        let match;
        while ((match = LOCALIZE_REGEX.exec(line)) !== null) {
            const [_, key, defaultMessage] = match;

            if (!entries[key]) {
                entries[key] = defaultMessage;
            }
        }
    });

    return entries;
}

// Main Regex for localization
const LOCALIZE_REGEX = /(?<!\/\/.*)(?<!\/\*.*)localize\s*\(\s*["'`](.*?)["'`]\s*,\s*["'`](.*?)["'`]/g;

// Run the script
generateLocalizationJSON();