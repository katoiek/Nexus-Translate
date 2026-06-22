import { fetch } from '@tauri-apps/plugin-http';
import { message } from '@tauri-apps/plugin-dialog';
import { offlineTranslationService } from './OfflineTranslationService';
import { ollamaService } from './OllamaService';
import { buildTranslationSystemPrompt, Tone, GlossaryEntry } from '../lib/translationPrompt';
import { STORAGE_KEYS } from '../lib/settings';
import { logger } from '../lib/logger';

interface TranslationOptions {
    engine: string;
    source: string;
    target: string;
    apiKeys?: {
        openai?: string;
        openaiModel?: string;
        anthropic?: string;
        anthropicModel?: string;
        gemini?: string;
    };
    // AI 機能 / AI features
    tone?: Tone;
    glossary?: GlossaryEntry[];
    // ストリーミング受け口（差分テキスト）/ Streaming sink (delta text)
    onChunk?: (delta: string) => void;
}

interface TranslationResult {
    text: string;
    engine: string;
}

export class TranslationService {
    public async translate(text: string, options: TranslationOptions): Promise<TranslationResult> {
        const { engine, source, target, apiKeys, tone, glossary, onChunk } = options;

        try {
            if (engine === 'offline') {
                // NLLB-600M（翻訳専用モデル。トーン/用語集/ストリーミングは非対応）
                const result = await offlineTranslationService.translate(text, source, target);
                if (result.error) throw new Error(result.error);
                onChunk?.(result.text);
                return { text: result.text, engine: 'offline' };
            }

            if (engine === 'ollama') {
                const system = buildTranslationSystemPrompt({ source, target, tone, glossary });
                const full = await ollamaService.translate(system, text, onChunk);
                return { text: full.trim(), engine: `ollama (${ollamaService.getSelectedModel()})` };
            }

            if (engine.startsWith('llm')) {
                return await this.translateLLM(text, source, target, engine, apiKeys, tone, glossary, onChunk);
            }

            throw new Error(`Unsupported engine: ${engine}`);
        } catch (error: any) {
            logger.error('Translation Error:', error);
            throw error;
        }
    }

    // 翻訳以外の汎用 LLM アクション（言い換え・代替案など）/ Generic LLM action (rephrase, alternatives, etc.)
    // 選択中の LLM エンジンを使い、任意の system/user で生成する。
    public async assist(params: {
        engine: string;
        system: string;
        user: string;
        apiKeys?: TranslationOptions['apiKeys'];
        onChunk?: (delta: string) => void;
    }): Promise<string> {
        const { engine, system, user, apiKeys, onChunk } = params;

        if (engine === 'ollama') {
            return (await ollamaService.translate(system, user, onChunk)).trim();
        }
        if (engine === 'llm-openai' && apiKeys?.openai) {
            return (await this.translateOpenAI(user, system, apiKeys.openai, apiKeys.openaiModel, onChunk)).text;
        }
        if (engine === 'llm-anthropic' && apiKeys?.anthropic) {
            return (await this.translateAnthropic(user, system, apiKeys.anthropic, apiKeys.anthropicModel, onChunk)).text;
        }
        if (engine === 'llm-gemini' && apiKeys?.gemini) {
            return (await this.translateGemini(user, system, apiKeys.gemini, onChunk)).text;
        }
        throw new Error('AI 機能は LLM エンジン選択時のみ利用できます。');
    }

    private async translateLLM(
        text: string,
        source: string,
        target: string,
        engineId: string,
        apiKeys: TranslationOptions['apiKeys'],
        tone?: Tone,
        glossary?: GlossaryEntry[],
        onChunk?: (delta: string) => void,
    ): Promise<TranslationResult> {
        const system = buildTranslationSystemPrompt({ source, target, tone, glossary });

        if (engineId === 'llm-openai' && apiKeys?.openai) {
            return await this.translateOpenAI(text, system, apiKeys.openai, apiKeys.openaiModel, onChunk);
        }
        if (engineId === 'llm-anthropic' && apiKeys?.anthropic) {
            return await this.translateAnthropic(text, system, apiKeys.anthropic, apiKeys.anthropicModel, onChunk);
        }
        if (engineId === 'llm-gemini' && apiKeys?.gemini) {
            return await this.translateGemini(text, system, apiKeys.gemini, onChunk);
        }

        // Fallback: 設定済みの任意キーで実行 / Fall back to any configured key
        if (apiKeys?.openai) return await this.translateOpenAI(text, system, apiKeys.openai, apiKeys.openaiModel, onChunk);
        if (apiKeys?.anthropic) return await this.translateAnthropic(text, system, apiKeys.anthropic, apiKeys.anthropicModel, onChunk);
        if (apiKeys?.gemini) return await this.translateGemini(text, system, apiKeys.gemini, onChunk);

        throw new Error(`No API Key configured for ${engineId}. Please check Settings.`);
    }

    private async translateOpenAI(text: string, system: string, apiKey: string, customModel: string | undefined, onChunk?: (delta: string) => void): Promise<TranslationResult> {
        const modelToUse = customModel && customModel.trim() !== '' ? customModel.trim() : 'gpt-4o';

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelToUse,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: text }
                    ]
                })
            });

            if (!response.ok) {
                const err = await response.json();
                const errorMsg = err?.error?.message || `API Error: ${response.status}`;
                logger.error(`[translateOpenAI] Error:`, err);
                await message(`OpenAI Translation Error: ${errorMsg}`, { title: 'OpenAI エラー', kind: 'error' });
                throw new Error(errorMsg);
            }

            const data = await response.json();
            const translatedText = data.choices[0]?.message?.content?.trim();

            if (!translatedText) throw new Error('No translation in response');

            onChunk?.(translatedText);
            return { text: translatedText, engine: `llm-openai (${modelToUse})` };
        } catch (error: unknown) {
            logger.error(`Translation failed for OpenAI model ${modelToUse}:`, error);
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`OpenAI API Error: ${msg}`);
        }
    }

    private async translateAnthropic(text: string, system: string, apiKey: string, customModel: string | undefined, onChunk?: (delta: string) => void): Promise<TranslationResult> {
        const models = [
            customModel && customModel.trim() !== '' ? customModel.trim() : null,
            localStorage.getItem(STORAGE_KEYS.anthropicModel),
            'claude-sonnet-4-6',
            'claude-opus-4-6',
            'claude-sonnet-4-5-20250929',
            'claude-3-7-sonnet-20250219',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
        ].filter(Boolean) as string[];

        const uniqueModels = Array.from(new Set(models));
        const triedModelsDetails: string[] = [];

        for (const model of uniqueModels) {
            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model,
                        max_tokens: 4096,
                        system,
                        messages: [{ role: 'user', content: text }]
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    const status = response.status;
                    const errorMsg = err?.error?.message || JSON.stringify(err);
                    logger.error(`[translateAnthropic] API Error (${model}) Status ${status}:`, err);
                    triedModelsDetails.push(`${model}: Status ${status} (${errorMsg})`);

                    if (status === 401 || status === 403 || status === 429) {
                        await message(`Anthropic Critical Error (Status ${status}):\n${errorMsg}`, { title: 'Anthropic エラー', kind: 'error' });
                        throw new Error(errorMsg);
                    }
                    if (status === 400 && (errorMsg.includes('credit') || errorMsg.includes('balance') || errorMsg.includes('billing'))) {
                        await message(`Anthropic Account Error (Status 400):\n${errorMsg}`, { title: 'Anthropic アカウントエラー', kind: 'error' });
                        throw new Error(errorMsg);
                    }
                    continue;
                }

                const data = await response.json();
                const translatedText = data.content[0]?.text;
                onChunk?.(translatedText);
                return { text: translatedText, engine: `llm-anthropic (${model})` };
            } catch (error: any) {
                logger.error(`[translateAnthropic] Attempt failed for ${model}:`, error);
                if (!triedModelsDetails.some(d => d.startsWith(model))) {
                    triedModelsDetails.push(`${model}: Error (${error.message})`);
                }
                if (error.message && (error.message.includes('Critical Error') || error.message.includes('Account Error'))) throw error;
            }
        }

        const details = triedModelsDetails.join('\n');
        logger.error(`[translateAnthropic] All models failed: ${details}`);
        await message(`Anthropic All Models Failed:\n\n${details}`, { title: 'Anthropic エラー', kind: 'error' });
        throw new Error(`Anthropic All Models Failed:\n${details}`);
    }

    private async translateGemini(text: string, system: string, apiKey: string, onChunk?: (delta: string) => void): Promise<TranslationResult> {
        const storedModel = localStorage.getItem(STORAGE_KEYS.geminiModel);
        const models = [
            storedModel,
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
        ].filter(Boolean) as string[];

        let lastError: any;

        for (const model of models) {
            try {
                logger.log(`Attempting Gemini translation with model: ${model}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: system }] },
                        contents: [{ parts: [{ text }] }]
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    logger.error(`Gemini API Error (${model}):`, JSON.stringify(err, null, 2));
                    lastError = err;
                    if (response.status === 429 || response.status === 401) break;
                    continue;
                }

                const data = await response.json();
                const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!translatedText) throw new Error('No translation in response');

                onChunk?.(translatedText);
                return { text: translatedText, engine: `llm-gemini (${model})` };
            } catch (error: any) {
                logger.error(`Attempt failed for ${model}:`, error);
                lastError = error;
            }
        }
        throw new Error(`Gemini API Error: ${lastError?.error?.message || lastError?.message || 'All models failed'}`);
    }
}

export const translationService = new TranslationService();
