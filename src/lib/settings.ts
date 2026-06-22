// アプリ設定の localStorage キーとアクセサを一元管理する。
// 各所に散らばっていたキー文字列をここへ集約し、型付きで読み書きする。
// （Single source of truth for localStorage keys and accessors.）

export const STORAGE_KEYS = {
    openaiApiKey: 'openai_api_key',
    openaiModel: 'openai_model',
    anthropicApiKey: 'anthropic_api_key',
    anthropicModel: 'anthropic_model',
    geminiApiKey: 'gemini_api_key',
    geminiModel: 'gemini_model',
    ollamaBaseUrl: 'ollama_base_url',
    ollamaModel: 'ollama_model',
    aiTone: 'ai_tone',
    aiGlossary: 'ai_glossary',
    selectedEngine: 'selected_engine',
    sourceLang: 'source_lang',
    targetLang: 'target_lang',
} as const;

export interface ApiKeys {
    openai?: string;
    openaiModel?: string;
    anthropic?: string;
    anthropicModel?: string;
    gemini?: string;
}

// クラウドエンジン用のAPIキー一式を取得 / Collect cloud-engine API keys
export function getApiKeys(): ApiKeys {
    return {
        openai: localStorage.getItem(STORAGE_KEYS.openaiApiKey) || undefined,
        openaiModel: localStorage.getItem(STORAGE_KEYS.openaiModel) || undefined,
        anthropic: localStorage.getItem(STORAGE_KEYS.anthropicApiKey) || undefined,
        anthropicModel: localStorage.getItem(STORAGE_KEYS.anthropicModel) || undefined,
        gemini: localStorage.getItem(STORAGE_KEYS.geminiApiKey) || undefined,
    };
}
