import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = path.join(__dirname, '../src-tauri/models/nllb-200-distilled-1.3B');
const BASE_URL = 'https://huggingface.co/michaelfeil/ct2fast-nllb-200-distilled-1.3B/resolve/main';

const FILES = [
    'config.json',
    'model.bin',
    'sentencepiece.bpe.model',
    'shared_vocabulary.txt'
];

if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadFile(filename) {
    const filePath = path.join(MODEL_DIR, filename);

    // すでに存在する場合はスキップ
    if (fs.existsSync(filePath)) {
        console.log(`[スキップ] ${filename} はすでに存在します`);
        return;
    }

    const url = `${BASE_URL}/${filename}`;
    console.log(`\nダウンロード中: ${filename}`);

    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': 'NexusTranslate/2.0' } };

        const doDownload = (downloadUrl) => {
            const file = fs.createWriteStream(filePath);
            let downloaded = 0;
            let total = 0;
            let lastLog = 0;

            https.get(downloadUrl, options, (response) => {
                // リダイレクト追従
                if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                    file.close();
                    fs.unlinkSync(filePath);
                    let newUrl = response.headers.location;
                    if (newUrl.startsWith('/')) newUrl = `https://huggingface.co${newUrl}`;
                    console.log(`  リダイレクト先: ${newUrl.substring(0, 80)}...`);
                    doDownload(newUrl);
                    return;
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(filePath);
                    reject(new Error(`HTTP ${response.statusCode}: ${filename}`));
                    return;
                }

                total = parseInt(response.headers['content-length'] || '0', 10);
                if (total) console.log(`  ファイルサイズ: ${formatBytes(total)}`);

                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    const now = Date.now();
                    if (now - lastLog > 2000) {
                        const pct = total ? `${((downloaded / total) * 100).toFixed(1)}%` : formatBytes(downloaded);
                        process.stdout.write(`\r  進捗: ${pct} (${formatBytes(downloaded)})   `);
                        lastLog = now;
                    }
                });

                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`\n  完了: ${filename} (${formatBytes(downloaded)})`);
                    resolve();
                });
            }).on('error', (err) => {
                file.close();
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                reject(err);
            });
        };

        doDownload(url);
    });
}

async function main() {
    console.log('=== NLLB-200 1.3B モデルダウンローダー ===');
    console.log(`保存先: ${MODEL_DIR}`);
    console.log('リポジトリ: michaelfeil/ct2fast-nllb-200-distilled-1.3B');
    console.log('合計サイズ: 約 1.2GB\n');

    try {
        for (const file of FILES) {
            await downloadFile(file);
        }
        console.log('\n=== ダウンロード完了 ===');
        console.log('アプリを再起動して NLLB-1.3B エンジンを使用してください。');
    } catch (err) {
        console.error('\nエラー:', err.message);
        process.exit(1);
    }
}

main();
