import { Command } from '@tauri-apps/plugin-shell';
import { logger } from '../lib/logger';

interface OCRResult {
    text: string;
    confidence: number;
}

export class NativeService {
    public async performOCR(imagePath: string): Promise<OCRResult> {
        return this.runNativeCommand(['ocr', imagePath]);
    }

    public async performMacInteractiveCapture(): Promise<OCRResult> {
        return this.runNativeCommand(['interactive-capture']);
    }

    public async performCaptureAndOCR(x: number, y: number, width: number, height: number): Promise<OCRResult> {
        const args = ['capture', x.toString(), y.toString(), width.toString(), height.toString()];
        return this.runNativeCommand(args);
    }

    private runNativeCommand(args: string[]): Promise<OCRResult> {
        // "binaries/NexusNative" matches the externalBin entry in tauri.conf.json
        const command = Command.sidecar('NexusNative', args, { encoding: 'raw' });

        return new Promise<OCRResult>((resolve, reject) => {
            let rawStdout: number[] = [];
            let rawStderr: number[] = [];

            command.stdout.on('data', (data) => {
                rawStdout.push(...Array.from(data as Uint8Array));
            });

            command.stderr.on('data', (data) => {
                rawStderr.push(...Array.from(data as Uint8Array));
            });

            command.on('close', (data) => {
                if (data.code !== 0) {
                    const stderrStr = new TextDecoder().decode(new Uint8Array(rawStderr));
                    logger.error(`Native Command Failed: ${args.join(' ')}`);
                    logger.error(`Stderr: ${stderrStr}`);
                    reject(new Error(`Command failed with code ${data.code}: ${stderrStr}`));
                    return;
                }

                // Decode safely
                let stdoutStr: string;
                try {
                    // Try standard UTF-8 first
                    stdoutStr = new TextDecoder('utf-8').decode(new Uint8Array(rawStdout)).trim();
                } catch {
                    // Fallback or ignore
                    stdoutStr = String.fromCharCode(...rawStdout).trim();
                }

                logger.log(`Native Result Received: ${stdoutStr}`);

                try {
                    const result = JSON.parse(stdoutStr);
                    if (result && result.text) {
                        result.text = this.normalizeOcrText(result.text);
                    }
                    resolve(result);
                } catch {
                    logger.error(`Failed to parse Native output: ${stdoutStr}`);
                    reject(new Error('Invalid JSON from native sidecar'));
                }
            });

            command.on('error', (err) => {
                reject(err);
            });

            command.spawn().catch((error: unknown) => {
                logger.error(`NativeService Error:`, error);
                reject(error);
            });
        });
    }

    private normalizeOcrText(text: string): string {
        // Windows OCR は日本語の文字・句読点・カッコの周辺に不要な空白を入れることがある。
        // 語句の誤認識までは補正せず、OCR結果の意味を変えにくい空白整形だけを行う。
        const cjk = '\\u4e00-\\u9fa5\\u3040-\\u309f\\u30a0-\\u30ff';
        const jpPunctuation = '、。，．！？!?:：;；）］｝」』】〉》';
        const jpOpening = '（［｛「『【〈《';

        return text
            .replace(new RegExp(`([${cjk}])\\s+(?=[${cjk}])`, 'g'), '$1')
            .replace(new RegExp(`\\s+([${jpPunctuation}])`, 'g'), '$1')
            .replace(new RegExp(`([${jpOpening}])\\s+`, 'g'), '$1')
            .replace(new RegExp(`([${cjk}${jpPunctuation}])\\s+(?=[${jpPunctuation}])`, 'g'), '$1')
            .replace(/(\d)\s+(?=\d)/g, '$1');
    }
}

export const nativeService = new NativeService();
