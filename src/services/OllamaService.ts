import { invoke, Channel } from '@tauri-apps/api/core';
import { STORAGE_KEYS } from '../lib/settings';
import { logger } from '../lib/logger';

// Ollama の接続状態 / Ollama connection status
// 'running'     : 起動済み・翻訳可能モデルあり
// 'no-models'   : 起動済みだが翻訳可能モデルが0個
// 'not-running' : 未起動 or 未インストール（ポートに繋がらない）
export type OllamaStatus = 'running' | 'no-models' | 'not-running';

export interface OllamaModel {
    name: string;
    size?: number;
    family?: string;
    parameterSize?: string;
}

export interface OllamaState {
    status: OllamaStatus;
    models: OllamaModel[];
}

// 翻訳ストリームのイベント（Rust 側 TranslateEvent と一致）
// / Translation stream events (mirrors Rust TranslateEvent)
type TranslateEvent =
    | { type: 'chunk'; content: string }
    | { type: 'done'; full: string }
    | { type: 'error'; message: string };

// モデル pull の進捗イベント（Rust 側 PullEvent と一致）
type PullEvent =
    | { type: 'progress'; status: string; completed?: number; total?: number }
    | { type: 'done' }
    | { type: 'error'; message: string };

export interface PullProgress {
    status: string;
    completed?: number;
    total?: number;
}

const DEFAULT_BASE_URL = 'http://localhost:11434';

// 翻訳に使えない（埋め込み・リランク専用）モデル名の手がかり
// / Hints for models that can't translate (embedding/rerank only)
const NON_CHAT_HINTS = ['embed', 'bge', 'minilm', 'rerank', 'reranker', 'e5-', 'gte-'];

// 翻訳に強い推奨モデル（未pull時の案内用）/ Recommended multilingual models for the empty state
export const RECOMMENDED_MODELS = ['qwen2.5:7b', 'aya:8b', 'gemma2:9b'];

class OllamaService {
    getBaseUrl(): string {
        return localStorage.getItem(STORAGE_KEYS.ollamaBaseUrl)?.trim() || DEFAULT_BASE_URL;
    }

    setBaseUrl(url: string) {
        const trimmed = url.trim();
        if (trimmed) localStorage.setItem(STORAGE_KEYS.ollamaBaseUrl, trimmed);
        else localStorage.removeItem(STORAGE_KEYS.ollamaBaseUrl);
    }

    getSelectedModel(): string {
        return localStorage.getItem(STORAGE_KEYS.ollamaModel) || '';
    }

    setSelectedModel(model: string) {
        if (model) localStorage.setItem(STORAGE_KEYS.ollamaModel, model);
        else localStorage.removeItem(STORAGE_KEYS.ollamaModel);
    }

    // 翻訳に使えそうかをベストエフォートで判定 / Best-effort check for translation capability
    private isTranslationCapable(model: OllamaModel): boolean {
        const name = model.name.toLowerCase();
        return !NON_CHAT_HINTS.some((hint) => name.includes(hint));
    }

    // Ollama の状態とモデル一覧を取得 / Fetch Ollama state and model list
    // 取得は Rust(reqwest)経由。フロントの plugin-http だと本番では origin
    // (http://tauri.localhost) を Ollama が 403 拒否するため。
    // / Fetched via Rust(reqwest); the frontend plugin-http would send the webview
    //   Origin which Ollama rejects with 403 in release builds.
    async getState(): Promise<OllamaState> {
        try {
            const data = await invoke<any>('ollama_tags', { baseUrl: this.getBaseUrl() });
            const all: OllamaModel[] = (data?.models || []).map((m: any) => ({
                name: m.name,
                size: m.size,
                family: m.details?.family,
                parameterSize: m.details?.parameter_size,
            }));

            const models = all.filter((m) => this.isTranslationCapable(m));
            return { status: models.length > 0 ? 'running' : 'no-models', models };
        } catch (error) {
            logger.log('[OllamaService] Ollama not reachable:', error);
            return { status: 'not-running', models: [] };
        }
    }

    // 翻訳をストリーミング実行 / Run translation with streaming
    // onChunk は生成中の差分テキストを逐次受け取る。戻り値は最終全文。
    async translate(
        system: string,
        prompt: string,
        onChunk?: (delta: string) => void,
        temperature = 0.3,
    ): Promise<string> {
        const model = this.getSelectedModel();
        if (!model) {
            throw new Error('Ollama モデルが選択されていません。設定で選択してください。');
        }

        return new Promise<string>((resolve, reject) => {
            const channel = new Channel<TranslateEvent>();
            let full = '';

            channel.onmessage = (event) => {
                if (event.type === 'chunk') {
                    full += event.content;
                    onChunk?.(event.content);
                } else if (event.type === 'done') {
                    resolve(event.full || full);
                } else if (event.type === 'error') {
                    reject(new Error(event.message));
                }
            };

            invoke('ollama_translate', {
                baseUrl: this.getBaseUrl(),
                model,
                system,
                prompt,
                temperature,
                onEvent: channel,
            }).catch((e) => reject(e instanceof Error ? e : new Error(String(e))));
        });
    }

    // モデルを pull（進捗ストリーミング）/ Pull a model with progress streaming
    async pull(model: string, onProgress?: (p: PullProgress) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const channel = new Channel<PullEvent>();

            channel.onmessage = (event) => {
                if (event.type === 'progress') {
                    onProgress?.({ status: event.status, completed: event.completed, total: event.total });
                } else if (event.type === 'done') {
                    resolve();
                } else if (event.type === 'error') {
                    reject(new Error(event.message));
                }
            };

            invoke('ollama_pull', {
                baseUrl: this.getBaseUrl(),
                model,
                onEvent: channel,
            }).catch((e) => reject(e instanceof Error ? e : new Error(String(e))));
        });
    }
}

export const ollamaService = new OllamaService();
