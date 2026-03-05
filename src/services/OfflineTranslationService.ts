import { Command, Child } from '@tauri-apps/plugin-shell';
import { resolveResource } from '@tauri-apps/api/path';
import { logger } from '../lib/logger';

interface TranslationResult {
    text: string;
    detectedSourceLanguage?: string;
    error?: string;
}

class OfflineTranslationService {
    private child: Child | null = null;
    private isReady: boolean = false;
    private queue: { resolve: (value: TranslationResult | PromiseLike<TranslationResult>) => void; reject: (reason?: any) => void; }[] = [];
    private restartAttempts: number = 0;
    private maxRestarts: number = 3;
    private restartDelay: number = 1000;

    async init() {
        if (this.child) return;

        try {
            // Resolve model path
            const modelPath = await resolveResource('native/models/nllb-200-distilled-600M');
            logger.log('[OfflineTranslationService] Model Path:', modelPath);

            // Tauri `Command.sidecar` automatically securely escapes arguments.
            // Adding literal quotes makes Python's CTranslate2 see the quotes as part of the directory name and crash.
            const command = Command.sidecar('translator', [modelPath]);

            // events
            command.on('close', (data) => {
                logger.log(`[OfflineTranslationService] Process exited with code ${data.code} signal ${data.signal}`);
                this.child = null;
                this.isReady = false;

                if (data.code !== 0 && data.code !== null) {
                    // message(`Translation Service Exited: Code ${data.code}\nSignal: ${data.signal}`, { title: 'App Error', kind: 'error' });
                    this.handleUnexpectedExit();
                } else {
                    // Normal exit (app quit)
                    this.rejectAllPending('Service stopped');
                }
            });

            command.on('error', (error) => {
                logger.error(`[OfflineTranslationService] Command error: "${error}"`);
                this.handleUnexpectedExit();
            });

            command.stdout.on('data', (line) => {
                const textLine = typeof line === 'string' ? line : new TextDecoder().decode(line as any);
                const lines = textLine.split('\n');
                for (const l of lines) {
                    if (!l.trim()) continue;
                    this.handleOutput(l.trim());
                }
            });

            command.stderr.on('data', (line) => {
                const textLine = typeof line === 'string' ? line : new TextDecoder().decode(line as any);
                logger.error(`[Translator Stderr]: ${textLine}`);
                // Try to intercept Python ModuleNotFound or critical errors and display to user
                if (textLine.toLowerCase().includes("error") || textLine.includes("Traceback")) {
                    // message(`Sidecar Crash Trace:\n${textLine}`, { title: 'Sidecar Python Error', kind: 'error' });
                }
            });

            // spawn
            this.child = await command.spawn();
            logger.log('[OfflineTranslationService] Process spawned', this.child.pid);

        } catch (error: any) {
            logger.error('[OfflineTranslationService] Initialization error:', error);
            // message(`Translation Service Init Error:\n${error}\n${JSON.stringify(error, Object.getOwnPropertyNames(error))}`, { title: 'App Error', kind: 'error' });
        }
    }

    private handleUnexpectedExit() {
        if (this.restartAttempts < this.maxRestarts) {
            this.restartAttempts++;
            logger.log(`[OfflineTranslationService] Restarting service in ${this.restartDelay}ms (Attempt ${this.restartAttempts}/${this.maxRestarts})...`);
            setTimeout(() => {
                this.init();
            }, this.restartDelay);
        } else {
            logger.error('[OfflineTranslationService] Max restart attempts reached. Service is dead.');
            // message('Translation Service Crashed and could not restart.', { title: 'App Error', kind: 'error' });
            this.rejectAllPending('Translation service crashed and could not be restarted.');
        }
    }

    private rejectAllPending(reason: string) {
        while (this.queue.length > 0) {
            const pending = this.queue.shift();
            pending?.reject(new Error(reason));
        }
    }

    private handleOutput(line: string) {
        // We assume newline-delimited JSON
        try {
            const result = JSON.parse(line);

            if (result && result.status === 'ready') {
                this.isReady = true;
                this.restartAttempts = 0; // Reset restart counter on success
                logger.log('[OfflineTranslationService] Service Ready');
                // message("Offline Translation Model Loaded Successfully", { title: "Nexus Translate", kind: "info" });
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
                let text = result.text;
                if (typeof text === 'string') {
                    text = text.replace(/^[a-z]{3}_[A-Z][a-z]{3}\s+/gm, '').trim();
                }
                pending.resolve({ ...result, text });
            }
        } catch (e: any) {
            logger.error('[OfflineTranslationService] Failed to parse output:', line, e);
            // message(`Translation Service Parse Error: ${e.message}\nLine: ${line}`, { title: 'App Error', kind: 'error' });
        }
    }

    async translate(text: string, source: string, target: string): Promise<TranslationResult> {
        if (!this.child) {
            await this.init();
            if (!this.isReady) logger.log('[OfflineTranslationService] Waiting for service...');
        }

        // Ensure service is ready (simple wait)
        if (!this.isReady) {
            // Fast fail if dead
            if (this.child === null && this.restartAttempts >= this.maxRestarts) {
                return { text: text, error: 'Translation service is unavailable' };
            }

            await new Promise<void>((resolve, reject) => {
                const start = Date.now();
                const check = setInterval(() => {
                    if (this.isReady) {
                        clearInterval(check);
                        resolve();
                    }
                    // Timeout after 5s
                    if (Date.now() - start > 5000) {
                        clearInterval(check);
                        reject(new Error('Service initialization timeout'));
                    }
                }, 100);
            });
        }

        // NLLB works best with single sentences.
        // Use Intl.Segmenter to split paragraphs into sentences.
        let segments: string[] = [];
        try {
            // @ts-ignore: Intl.Segmenter is supported
            const segmenter = new Intl.Segmenter(source, { granularity: 'sentence' });
            segments = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
        } catch (e) {
            segments = text.split('\n');
        }

        const validSegments = segments.filter(s => s.trim().length > 0);

        if (validSegments.length === 0) {
            return { text: '', detectedSourceLanguage: source };
        }

        try {
            // Send all segments as a single batch
            const batchResult = await this.translateBatch(validSegments, source, target);

            return {
                text: batchResult.text,
                detectedSourceLanguage: source
            };
        } catch (e) {
            logger.error('[OfflineTranslationService] Batch translation failed', e);
            // message(`Translation Failed: ${e}`, { title: 'App Error', kind: 'error' });
            return { text: text, error: String(e) };
        }
    }

    private translateBatch(texts: string[], source: string, target: string): Promise<TranslationResult> {
        return new Promise(async (resolve, reject) => {
            if (!this.child) {
                return reject(new Error('Offline translation service not running'));
            }

            const nllbSource = this.mapToNLLB(source);
            const nllbTarget = this.mapToNLLB(target);
            const safeTexts = texts.map(t => t.replace(/\n/g, ' ').replace(/\r/g, ''));
            const payload = JSON.stringify({ text: safeTexts, source: nllbSource, target: nllbTarget });

            try {
                await this.child.write(payload + '\n');
                this.queue.push({ resolve, reject });
            } catch (e) {
                logger.error('[OfflineTranslationService] Write failed:', e);
                reject(e);
            }
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

    async dispose() {
        if (this.child) {
            await this.child.kill();
            this.child = null;
        }
    }
}

export const offlineTranslationService = new OfflineTranslationService();
