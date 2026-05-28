import fs from 'fs';
import https from 'https';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT_DIR, 'cache', 'llama-cpp');
const SIDECAR_PATH = path.join(ROOT_DIR, 'src-tauri', 'llama-cli-x86_64-pc-windows-msvc.exe');
const RUNTIME_DIR = path.join(ROOT_DIR, 'src-tauri', 'llama-runtime');
const TAURI_DIR = path.join(ROOT_DIR, 'src-tauri');

function requestJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NexusTranslate/2.0' } }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${url}`));
                return;
            }

            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => { body += chunk; });
            response.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'NexusTranslate/2.0' } }, (response) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                file.close();
                fs.rmSync(dest, { force: true });
                downloadFile(response.headers.location, dest).then(resolve, reject);
                return;
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.rmSync(dest, { force: true });
                reject(new Error(`HTTP ${response.statusCode}: ${url}`));
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (error) => {
            file.close();
            fs.rmSync(dest, { force: true });
            reject(error);
        });
    });
}

function chooseWindowsAsset(assets) {
    const zipAssets = assets.filter((asset) => {
        const name = asset.name.toLowerCase();
        return name.endsWith('.zip') && name.includes('win') && name.includes('x64');
    });

    const preferred = [
        (name) => name.includes('avx2') && !name.includes('cuda') && !name.includes('vulkan'),
        (name) => name.includes('cpu') && !name.includes('cuda') && !name.includes('vulkan'),
        (name) => !name.includes('cuda') && !name.includes('vulkan'),
        () => true,
    ];

    for (const predicate of preferred) {
        const match = zipAssets.find((asset) => predicate(asset.name.toLowerCase()));
        if (match) return match;
    }

    throw new Error('Windows x64 用の llama.cpp バイナリを見つけられませんでした。');
}

function findFile(dir, filename) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found) return found;
        } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
            return fullPath;
        }
    }
    return null;
}

function copyRuntimeDlls(extractDir) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    const entries = fs.readdirSync(extractDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(extractDir, entry.name);
        if (entry.isDirectory()) {
            copyRuntimeDlls(fullPath);
        } else if (entry.name.toLowerCase().endsWith('.dll')) {
            fs.copyFileSync(fullPath, path.join(RUNTIME_DIR, entry.name));
            fs.copyFileSync(fullPath, path.join(TAURI_DIR, entry.name));
        }
    }
}

async function main() {
    if (process.platform !== 'win32') {
        throw new Error('このスクリプトは Windows x64 sidecar の準備用です。');
    }

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(SIDECAR_PATH), { recursive: true });

    console.log('llama.cpp の最新 Windows x64 バイナリを確認しています...');
    const release = await requestJson('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest');
    const asset = chooseWindowsAsset(release.assets || []);
    const zipPath = path.join(CACHE_DIR, asset.name);
    const extractDir = path.join(CACHE_DIR, asset.name.replace(/\.zip$/i, ''));

    if (!fs.existsSync(zipPath)) {
        console.log(`ダウンロード中: ${asset.name}`);
        await downloadFile(asset.browser_download_url, zipPath);
    } else {
        console.log(`スキップ: ${asset.name} は取得済みです`);
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync('powershell', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force`,
    ], { stdio: 'inherit' });

    const llamaCli = findFile(extractDir, 'llama-cli.exe');
    if (!llamaCli) {
        throw new Error('アーカイブ内に llama-cli.exe が見つかりませんでした。');
    }

    fs.copyFileSync(llamaCli, SIDECAR_PATH);
    copyRuntimeDlls(extractDir);

    console.log(`配置完了: ${SIDECAR_PATH}`);
    console.log(`DLL 配置先: ${RUNTIME_DIR}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
