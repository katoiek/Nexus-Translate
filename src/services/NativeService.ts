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
        return new Promise(async (resolve, reject) => {
            try {
                // "binaries/NexusNative" matches the externalBin entry in tauri.conf.json
                const command = Command.sidecar('NexusNative', args, { encoding: 'raw' });

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
                        return reject(new Error(`Command failed with code ${data.code}: ${stderrStr}`));
                    }

                    // Decode safely
                    let stdoutStr = '';
                    try {
                        // Try standard UTF-8 first
                        stdoutStr = new TextDecoder('utf-8').decode(new Uint8Array(rawStdout)).trim();
                    } catch (e) {
                        // Fallback or ignore
                        stdoutStr = String.fromCharCode(...rawStdout).trim();
                    }

                    logger.log(`Native Result Received: ${stdoutStr}`);

                    try {
                        const result = JSON.parse(stdoutStr);
                        if (result && result.text) {
                            // 1. Windows OCR は CJK 文字間に不要なスペースを挿入することがある。
                            // lookahead (?=...) を使うことで右側の文字を消費せず、連鎖するスペースを1パスで全除去できる。
                            result.text = result.text.replace(/([\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff])\s+(?=[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff])/g, '$1');
                        }
                        resolve(result);
                    } catch (e) {
                        logger.error(`Failed to parse Native output: ${stdoutStr}`);
                        reject(new Error('Invalid JSON from native sidecar'));
                    }
                });

                command.on('error', (err) => {
                    reject(err);
                });

                await command.spawn();
            } catch (error: any) {
                logger.error(`NativeService Error:`, error);
                reject(error);
            }
        });
    }
}

export const nativeService = new NativeService();
