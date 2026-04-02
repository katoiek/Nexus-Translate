import { Command, Child } from '@tauri-apps/plugin-shell';
import { resolveResource } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
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
    // 使用するモデルのディレクトリ名 (例: 'nllb-200-distilled-600M')
    private modelDirName: string;

    constructor(modelDirName: string) {
        this.modelDirName = modelDirName;
    }

    async init() {
        if (this.child) return;

        let modelPath = "";
        try {
            // Priority 1: resolveResource with 'models/' path (Works with the junction we created)
            try {
                modelPath = await resolveResource(`models/${this.modelDirName}`);
                logger.log('[OfflineTranslationService] resolveResource returned:', modelPath);

                // On Windows, resolveResource might return a path that needs verification
                if (!await exists(modelPath)) {
                    // Tauri v1/v2 リソースパス解決の互換対応
                    const upPath = modelPath.replace('models/', '_up_/models/');
                    if (await exists(upPath)) {
                        modelPath = upPath;
                    }
                }
            } catch (resError) {
                logger.error('[OfflineTranslationService] resolveResource failed:', resError);
            }

            if (!modelPath || !await exists(modelPath)) {
                logger.error('[OfflineTranslationService] Could not find model directory in any location.');
                // 最終手段: 相対パスで試みる
                modelPath = `models/${this.modelDirName}`;
            }

            logger.log(`[OfflineTranslationService:${this.modelDirName}] Final Model Path:`, modelPath);
            const command = Command.sidecar('translator', [modelPath]);

            command.on('close', (data) => {
                logger.log(`[OfflineTranslationService] Process exited with code ${data.code} signal ${data.signal}`);
                this.child = null;
                this.isReady = false;
                if (data.code !== 0 && data.code !== null) {
                    this.handleUnexpectedExit();
                } else {
                    this.rejectAllPending('Service stopped');
                }
            });

            command.on('error', (error) => {
                logger.error(`[OfflineTranslationService] Command error:`, error);
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
            });

            this.child = await command.spawn();
            logger.log('[OfflineTranslationService] Process spawned', this.child.pid);

        } catch (error: any) {
            logger.error('[OfflineTranslationService] Initialization error:', error);
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
        try {
            const result = JSON.parse(line);
            if (result && result.status === 'ready') {
                this.isReady = true;
                this.restartAttempts = 0;
                logger.log('[OfflineTranslationService] Service Ready');
                return;
            }

            const pending = this.queue.shift();
            if (!pending) return;

            if (result.error) {
                pending.reject(new Error(result.error));
            } else {
                let text = result.text;
                if (typeof text === 'string') {
                    text = text.replace(/^[a-z]{3}_[A-Z][a-z]{3}\s+/gm, '').trim();
                }
                pending.resolve({ ...result, text });
            }
        } catch (e: any) {
            logger.error('[OfflineTranslationService] Failed to parse output:', line, e);
        }
    }

    async translate(text: string, source: string, target: string): Promise<TranslationResult> {
        if (!this.child) {
            await this.init();
        }

        if (!this.isReady) {
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
                    if (Date.now() - start > 10000) { // Extended to 10s for model loading
                        clearInterval(check);
                        const errorMsg = 'Service initialization timeout (10s).';
                        logger.error(`[OfflineTranslationService] ${errorMsg}`);
                        reject(new Error(errorMsg));
                    }
                }, 100);
            });
        }

        let segments: string[];
        try {
            // @ts-expect-error Intl.Segmenter は TypeScript の型定義が不完全なため
            const segmenter = new Intl.Segmenter(source, { granularity: 'sentence' });
            // @ts-expect-error Intl.Segmenter は TypeScript の型定義が不完全なため
            segments = Array.from(segmenter.segment(text)).map((s) => (s as { segment: string }).segment);
        } catch {
            segments = text.split('\n');
        }

        const validSegments = segments.filter(s => s.trim().length > 0);
        if (validSegments.length === 0) return { text: '', detectedSourceLanguage: source };

        try {
            const batchResult = await this.translateBatch(validSegments, source, target);
            return { text: batchResult.text, detectedSourceLanguage: source };
        } catch (e) {
            logger.error('[OfflineTranslationService] Batch translation failed', e);
            return { text: text, error: String(e) };
        }
    }

    private async translateBatch(texts: string[], source: string, target: string): Promise<TranslationResult> {
        if (!this.child) throw new Error('Offline translation service not running');

        const nllbSource = this.mapToNLLB(source);
        const nllbTarget = this.mapToNLLB(target);
        const safeTexts = texts.map(t => t.replace(/\n/g, ' ').replace(/\r/g, ''));
        const payload = JSON.stringify({ text: safeTexts, source: nllbSource, target: nllbTarget });

        return new Promise<TranslationResult>((resolve, reject) => {
            this.child!.write(payload + '\n')
                .then(() => {
                    this.queue.push({ resolve, reject });
                })
                .catch((e: unknown) => {
                    logger.error('[OfflineTranslationService] Write failed:', e);
                    reject(e);
                });
        });
    }

    private mapToNLLB(lang: string): string {
        const mapping: Record<string, string> = {
            'en': 'eng_Latn', 'ja': 'jpn_Jpan', 'es': 'spa_Latn', 'fr': 'fra_Latn',
            'de': 'deu_Latn', 'zh': 'zho_Hans', 'ko': 'kor_Hang', 'it': 'ita_Latn',
            'pt': 'por_Latn', 'ru': 'rus_Cyrl', 'nl': 'nld_Latn', 'pl': 'pol_Latn',
            'tr': 'tur_Latn', 'vi': 'vie_Latn', 'th': 'tha_Thai', 'id': 'ind_Latn',
            'hi': 'hin_Deva', 'ar': 'arb_Arab', 'bn': 'ben_Beng', 'cs': 'ces_Latn',
            'da': 'dan_Latn', 'fi': 'fin_Latn', 'el': 'ell_Grek', 'he': 'heb_Hebr',
            'hu': 'hun_Latn', 'ms': 'zsm_Latn', 'no': 'nob_Latn', 'ro': 'ron_Latn',
            'sv': 'swe_Latn', 'tl': 'tgl_Latn', 'uk': 'ukr_Cyrl',
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

// NLLB-200 600M: 高速・省メモリ版（既存互換）
export const offlineTranslationService = new OfflineTranslationService('nllb-200-distilled-600M');

// NLLB-200 1.3B: 高品質版（GPU対応）
export const offlineHQTranslationService = new OfflineTranslationService('nllb-200-distilled-1.3B');
