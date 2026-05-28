import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const MODEL_DIR = path.join(ROOT_DIR, 'src-tauri', 'models', 'hymt2-1.8b-gguf');
const MODEL_FILE = 'Hy-MT2-1.8B-Q4_K_M.gguf';
const MODEL_URL = `https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF/resolve/main/${MODEL_FILE}?download=true`;

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        let downloaded = 0;
        let total = 0;
        let lastLog = 0;

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

            total = Number(response.headers['content-length'] || 0);
            if (total > 0) console.log(`ファイルサイズ: ${formatBytes(total)}`);

            response.on('data', (chunk) => {
                downloaded += chunk.length;
                const now = Date.now();
                if (now - lastLog > 2000) {
                    const pct = total > 0 ? `${((downloaded / total) * 100).toFixed(1)}%` : formatBytes(downloaded);
                    process.stdout.write(`\r進捗: ${pct} (${formatBytes(downloaded)})   `);
                    lastLog = now;
                }
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`\n保存完了: ${dest}`);
                resolve();
            });
        }).on('error', (error) => {
            file.close();
            fs.rmSync(dest, { force: true });
            reject(error);
        });
    });
}

async function main() {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    const modelPath = path.join(MODEL_DIR, MODEL_FILE);

    if (fs.existsSync(modelPath) && fs.statSync(modelPath).size > 0) {
        console.log(`スキップ: ${modelPath} はすでに存在します`);
        return;
    }

    console.log('Tencent Hy-MT2 1.8B Q4_K_M GGUF をダウンロードします...');
    await downloadFile(MODEL_URL, modelPath);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
