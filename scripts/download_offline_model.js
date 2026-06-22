import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = path.join(__dirname, '../src-tauri/models/nllb-200-distilled-600M');
// int8量子化版を使用。約623MBでNSISの2GB制限内に収まり、同梱インストーラーを軽量化できる。
// （Use the int8-quantized build: ~623MB, fits NSIS's 2GB limit and keeps the installer small.）
const BASE_URL = 'https://huggingface.co/JustFrederik/nllb-200-distilled-600M-ct2-int8/resolve/main';

const FILES = [
	'config.json',
	'model.bin',
	'sentencepiece.bpe.model',
	'shared_vocabulary.txt'
];

if (!fs.existsSync(MODEL_DIR)) {
	fs.mkdirSync(MODEL_DIR, { recursive: true });
}

async function downloadFile(filename) {
	const filePath = path.join(MODEL_DIR, filename);
	const url = `${BASE_URL}/${filename}`;

	console.log(`Downloading ${filename}...`);

	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(filePath);
		const options = {
			headers: {
				'User-Agent': 'NexusTranslate/1.0'
			}
		};

		https.get(url, options, (response) => {
			if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307 || response.statusCode === 303) {
				// Follow redirect
				let newUrl = response.headers.location;
				if (newUrl.startsWith('/')) {
					newUrl = `https://huggingface.co${newUrl}`;
				}
				console.log(`Redirecting to ${newUrl}...`);

				https.get(newUrl, options, (redirectResponse) => {
					if (redirectResponse.statusCode !== 200) {
						reject(new Error(`Failed to download ${filename} (redirect): ${redirectResponse.statusCode}`));
						return;
					}
					redirectResponse.pipe(file);
					file.on('finish', () => {
						file.close();
						console.log(`Saved ${filename}`);
						resolve();
					});
				}).on('error', (err) => {
					fs.unlink(filePath, () => { });
					reject(err);
				});
				return;
			}

			if (response.statusCode !== 200) {
				reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
				return;
			}
			response.pipe(file);
			file.on('finish', () => {
				file.close();
				console.log(`Saved ${filename}`);
				resolve();
			});
		}).on('error', (err) => {
			fs.unlink(filePath, () => { });
			reject(err);
		});
	});
}

async function main() {
	console.log(`Downloading model to ${MODEL_DIR}...`);
	try {
		for (const file of FILES) {
			await downloadFile(file);
		}
		console.log('Model download complete.');
	} catch (err) {
		console.error('Error downloading model:', err);
		process.exit(1);
	}
}

main();
