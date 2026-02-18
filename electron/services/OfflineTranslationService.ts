import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';

interface TranslationResult {
	text: string;
	detectedSourceLanguage?: string;
	error?: string;
}

class OfflineTranslationService {
	private process: ChildProcess | null = null;
	private isReady: boolean = false;
	private queue: { resolve: (value: TranslationResult | PromiseLike<TranslationResult>) => void; reject: (reason?: any) => void; }[] = [];

	init() {
		if (this.process) return;

		const isDev = !app.isPackaged;
		const rootDir = isDev
			? path.join(process.cwd())
			: path.join(process.resourcesPath);

		// Path to the compiled C++ binary
		// Adjust for Windows (.exe) if needed
		const binaryName = process.platform === 'win32' ? 'translator.exe' : 'translator';

		// Assuming the build output is in native/cpp/build for dev
		const manualBuildPath = path.join(rootDir, 'native/cpp/build', binaryName);
		// In production, we assume it's bundled in a 'bin' folder or similar
		const productionPath = path.join(rootDir, 'bin', binaryName);

		const executablePath = isDev ? manualBuildPath : productionPath;

		const modelPath = isDev
			? path.join(rootDir, 'native/models/nllb-200-distilled-600M')
			: path.join(rootDir, 'native/models/nllb-200-distilled-600M'); // Adjust for prod

		console.log('[OfflineTranslationService] Initializing...');
		console.log('[OfflineTranslationService] Executable:', executablePath);
		console.log('[OfflineTranslationService] Model:', modelPath);

		try {
			// Spawn the C++ process
			this.process = spawn(executablePath, [modelPath]);

			this.process.stdout?.on('data', (data) => {
				const lines = data.toString().split('\n');
				for (const line of lines) {
					if (!line.trim()) continue;
					this.handleOutput(line.trim());
				}
			});

			this.process.stderr?.on('data', (data) => {
				const msg = data.toString();
				console.error('[Translator Stderr]:', msg);
			});

			this.process.on('close', (code) => {
				console.log(`[OfflineTranslationService] Process exited with code ${code}`);
				this.process = null;
				this.isReady = false;
				// Reject pending requests
				while (this.queue.length > 0) {
					const pending = this.queue.shift();
					pending?.reject(new Error('Translation service exited unexpectedly'));
				}
			});

			this.process.on('error', (err) => {
				console.error('[OfflineTranslationService] Failed to spawn process:', err);
			});

		} catch (error) {
			console.error('[OfflineTranslationService] Initialization error:', error);
		}
	}

	private handleOutput(line: string) {
		// We assume newline-delimited JSON
		try {
			const result = JSON.parse(line);

			if (result.status === 'ready') {
				this.isReady = true;
				console.log('[OfflineTranslationService] Service Ready');
				return;
			}

			// FIFO for translation requests
			const pending = this.queue.shift();
			if (!pending) {
				// Unexpected output or ready signal handled above
				return;
			};

			if (result.error) {
				pending.reject(new Error(result.error));
			} else {
				// Strip NLLB language code if present (e.g. "jpn_Jpan Hello")
				const text = result.text.replace(/^[a-z]{3}_[A-Z][a-z]{3}\s+/gm, '').trim();
				pending.resolve({ ...result, text });
			}
		} catch (e) {
			console.error('[OfflineTranslationService] Failed to parse output:', line);
		}
	}

	async translate(text: string, source: string, target: string): Promise<TranslationResult> {
		if (!this.process) {
			this.init();
			if (!this.isReady) console.log('[OfflineTranslationService] Waiting for service...');
		}

		// Ensure service is ready (simple wait)
		if (!this.isReady) {
			await new Promise<void>(resolve => {
				const check = setInterval(() => {
					if (this.isReady) {
						clearInterval(check);
						resolve();
					}
				}, 100);
			});
		}

		// NLLB works best with single sentences.
		// Use Intl.Segmenter to split paragraphs into sentences.
		// Fallback to splitting by newlines if Segmenter fails or for simple splitting.
		let segments: string[] = [];
		try {
			// @ts-ignore: Intl.Segmenter is supported in Electron/Node environments but might be missing from TS lib
			const segmenter = new Intl.Segmenter(source, { granularity: 'sentence' });
			segments = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
		} catch (e) {
			console.warn('[OfflineTranslationService] Intl.Segmenter failed, falling back to newline splitting:', e);
			segments = text.split('\n');
		}


		const validSegments = segments.filter(s => s.trim().length > 0);

		if (validSegments.length === 0) {
			return { text: '', detectedSourceLanguage: source };
		}

		try {
			// Send all segments as a single batch
			const batchResult = await this.translateBatch(validSegments, source, target);

			// Reconstruct text maintaining whitespace/newlines from original segmentation if possible
			// But for now, just joining with space (or newline if it was multiline)
			// Actually, Intl.Segmenter segments include the punctuation.
			// The batch result is a single string joined by newline in C++, or we can change C++ to return array.
			// Current C++ implementation returns joined string by newline.

			// If input was "Hello. World." -> segments ["Hello.", " World."]
			// result "Hello.\n World."
			// We can just return the result text as is.

			return {
				text: batchResult.text,
				detectedSourceLanguage: source
			};
		} catch (e) {
			console.error('[OfflineTranslationService] Batch translation failed', e);
			return { text: text, error: String(e) };
		}
	}

	private translateBatch(texts: string[], source: string, target: string): Promise<TranslationResult> {
		return new Promise((resolve, reject) => {
			if (!this.process || !this.process.stdin) {
				return reject(new Error('Offline translation service not running'));
			}

			const nllbSource = this.mapToNLLB(source);
			const nllbTarget = this.mapToNLLB(target);

			// Don't replace newlines within segments, or do?
			// C++ now handles array of strings.
			// Ideally we shouldn't have newlines inside a single segment if we want it to be a single batch item.
			const safeTexts = texts.map(t => t.replace(/\n/g, ' ').replace(/\r/g, ''));

			const payload = JSON.stringify({ text: safeTexts, source: nllbSource, target: nllbTarget });

			this.process.stdin.write(payload + '\n');
			this.queue.push({ resolve, reject });
		});
	}



	private mapToNLLB(lang: string): string {
		const mapping: Record<string, string> = {
			'en': 'eng_Latn',
			'ja': 'jpn_Jpan',
			'es': 'spa_Latn',
			'fr': 'fra_Latn',
			'de': 'deu_Latn',
			'zh': 'zho_Hans',
			'ko': 'kor_Hang',
			'it': 'ita_Latn',
			'pt': 'por_Latn',
			'ru': 'rus_Cyrl',
			'nl': 'nld_Latn',
			'pl': 'pol_Latn',
			'tr': 'tur_Latn',
			'vi': 'vie_Latn',
			'th': 'tha_Thai',
			'id': 'ind_Latn',
			'hi': 'hin_Deva',
			'ar': 'arb_Arab',
			'bn': 'ben_Beng',
			'cs': 'ces_Latn',
			'da': 'dan_Latn',
			'fi': 'fin_Latn',
			'el': 'ell_Grek',
			'he': 'heb_Hebr',
			'hu': 'hun_Latn',
			'ms': 'zsm_Latn',
			'no': 'nob_Latn',
			'ro': 'ron_Latn',
			'sv': 'swe_Latn',
			'tl': 'tgl_Latn',
			'uk': 'ukr_Cyrl',
		};
		return mapping[lang] || lang;
	}

	dispose() {
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
	}
}

export const offlineTranslationService = new OfflineTranslationService();
