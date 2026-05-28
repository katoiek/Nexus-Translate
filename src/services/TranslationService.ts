import { fetch } from '@tauri-apps/plugin-http';
import { message } from '@tauri-apps/plugin-dialog';
import { offlineTranslationService, offlineHQTranslationService } from './OfflineTranslationService';
import { hyMT2TranslationService } from './HyMT2TranslationService';
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
}

interface TranslationResult {
    text: string;
    engine: string;
}

export class TranslationService {
    public async translate(text: string, options: TranslationOptions): Promise<TranslationResult> {
        const { engine, source, target, apiKeys } = options;

        try {
            if (engine === 'offline') {
                const result = await offlineTranslationService.translate(text, source, target);
                if (result.error) throw new Error(result.error);
                return { text: result.text, engine: 'offline' };
            }

            if (engine === 'native') {
                // 'native' は 'offline' へフォールバック
                const result = await offlineTranslationService.translate(text, source, target);
                if (result.error) throw new Error(result.error);
                return { text: result.text, engine: 'offline' };
            }

            if (engine === 'offline-hq') {
                // NLLB-1.3B 高品質オフラインエンジン（GPU自動利用）
                const result = await offlineHQTranslationService.translate(text, source, target);
                if (result.error) throw new Error(result.error);
                return { text: result.text, engine: 'offline-hq' };
            }

            if (engine === 'local-hymt2') {
                const result = await hyMT2TranslationService.translate(text, source, target);
                if (result.error) throw new Error(result.error);
                return { text: result.text, engine: 'local-hymt2' };
            }

            if (engine.startsWith('llm')) {
                return await this.translateLLM(text, source, target, engine, apiKeys);
            }

            throw new Error(`Unsupported engine: ${engine}`);
        } catch (error: any) {
            logger.error('Translation Error:', error);
            throw error;
        }
    }

    private async translateLLM(text: string, source: string, target: string, engineId: string, apiKeys?: TranslationOptions['apiKeys']): Promise<TranslationResult> {
        if (engineId === 'llm-openai' && apiKeys?.openai) {
            return await this.translateOpenAI(text, source, target, apiKeys.openai, apiKeys.openaiModel);
        }
        if (engineId === 'llm-anthropic' && apiKeys?.anthropic) {
            return await this.translateAnthropic(text, source, target, apiKeys.anthropic, apiKeys.anthropicModel);
        }
        if (engineId === 'llm-gemini' && apiKeys?.gemini) {
            return await this.translateGemini(text, source, target, apiKeys.gemini);
        }

        // Fallback
        if (apiKeys?.openai) {
            return await this.translateOpenAI(text, source, target, apiKeys.openai, apiKeys.openaiModel);
        } else if (apiKeys?.anthropic) {
            return await this.translateAnthropic(text, source, target, apiKeys.anthropic, apiKeys.anthropicModel);
        } else if (apiKeys?.gemini) {
            return await this.translateGemini(text, source, target, apiKeys.gemini);
        }

        throw new Error(`No API Key configured for ${engineId}. Please check Settings.`);
    }

    private async translateOpenAI(text: string, source: string, target: string, apiKey: string, customModel?: string): Promise<TranslationResult> {
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
                        {
                            role: "system",
                            content: `You are a professional translator. Translate the following text from ${source === 'auto' ? 'auto-detected language' : source} to ${target}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.`
                        },
                        { role: "user", content: text }
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

            return {
                text: translatedText,
                engine: `llm-openai (${modelToUse})`
            };
        } catch (error: unknown) {
            logger.error(`Translation failed for OpenAI model ${modelToUse}:`, error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`OpenAI API Error: ${message}`);
        }
    }

    private async translateAnthropic(text: string, _source: string, target: string, apiKey: string, customModel?: string): Promise<TranslationResult> {
        const models = [
            customModel && customModel.trim() !== '' ? customModel.trim() : null, // Prioritize custom model if provided
            localStorage.getItem('anthropic_model'),
            'claude-sonnet-4-6',
            'claude-opus-4-6',
            'claude-sonnet-4-5-20250929',
            'claude-3-7-sonnet-20250219',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-sonnet-20240620',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229'
        ].filter(Boolean) as string[];

        // Remove duplicates while keeping order
        const uniqueModels = Array.from(new Set(models));

        const triedModelsDetails = [];
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
                        model: model,
                        max_tokens: 1024,
                        system: `You are a high-performance translation engine. Translate the provided text to ${target}. Output ONLY the translated result. Do not output the language name, character count, or any introductory phrases like "Here is the translation". Return strictly the translation.`,
                        messages: [{ role: "user", content: text }]
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

    private async translateGemini(text: string, _source: string, target: string, apiKey: string): Promise<TranslationResult> {
        const storedModel = localStorage.getItem('gemini_model');
        const models = [
            storedModel,
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
            'gemini-1.5-pro',
            'gemini-pro'
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
                        contents: [{
                            parts: [{
                                text: `You are a professional translator. Translate the following text to ${target}. Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.\n\nText: ${text}`
                            }]
                        }]
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    logger.error(`Gemini API Error (${model}):`, JSON.stringify(err, null, 2));
                    lastError = err;
                    if (response.status === 429 || response.status === 401) break;
                    if (response.status === 404 && model === models[0]) {
                        this.logAvailableGeminiModels(apiKey).catch(logger.error);
                    }
                    continue;
                }

                const data = await response.json();
                const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!translatedText) throw new Error('No translation in response');

                return { text: translatedText, engine: `llm-gemini (${model})` };
            } catch (error: any) {
                logger.error(`Attempt failed for ${model}:`, error);
                lastError = error;
            }
        }
        throw new Error(`Gemini API Error: ${lastError?.error?.message || lastError?.message || 'All models failed'}`);
    }

    private async logAvailableGeminiModels(apiKey: string) {
        try {
            logger.log('Fetching available Gemini models...');
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await response.json();
            if (data.models) {
                logger.log('Available Gemini Models:', data.models.map((m: any) => m.name));
            } else {
                logger.log('Failed to list models:', data);
            }
        } catch (e) {
            logger.error('Error listing models:', e);
        }
    }
}

export const translationService = new TranslationService();
