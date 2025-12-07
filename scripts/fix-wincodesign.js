const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const VERSION = '2.6.0';
const FILE_NAME = `winCodeSign-${VERSION}.7z`;
const URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-${VERSION}/${FILE_NAME}`;
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const WIN_CODE_SIGN_DIR = path.join(CACHE_DIR, 'winCodeSign');
const TARGET_DIR = path.join(WIN_CODE_SIGN_DIR, `winCodeSign-${VERSION}`);
// Path to 7za in node_modules
const SEVEN_ZIP_PATH = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

async function main() {
    console.log('Fixing winCodeSign for Windows...');

    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR);
    }
    if (!fs.existsSync(WIN_CODE_SIGN_DIR)) {
        fs.mkdirSync(WIN_CODE_SIGN_DIR);
    }

    // Check if already extracted
    if (fs.existsSync(TARGET_DIR)) {
        console.log('winCodeSign already exists. Skipping...');
        return;
    }

    const archivePath = path.join(CACHE_DIR, FILE_NAME);

    // 1. Download
    if (!fs.existsSync(archivePath)) {
        console.log(`Downloading ${URL}...`);
        await downloadFile(URL, archivePath);
        console.log('Download complete.');
    }

    // 2. Extract excluding darwin (macOS) folder which has symlinks
    console.log('Extracting...');
    try {
        // -x!darwin : Exclude darwin directory
        // -o{dir} : Output directory
        const cmd = `"${SEVEN_ZIP_PATH}" x "${archivePath}" -o"${TARGET_DIR}" -xr!darwin/ -y`;
        execSync(cmd, { stdio: 'inherit' });
        console.log('Extraction complete.');
    } catch (error) {
        console.error('Failed to extract:', error);
        process.exit(1);
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { }); // Delete the file async. (But we don't check result)
            reject(err);
        });
    });
}

main();
