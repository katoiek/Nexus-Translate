import { fetch } from '@tauri-apps/plugin-http';
import { offlineTranslationService } from './OfflineTranslationService';
import { logger } from '../lib/logger';

interface TranslationOptions {
    engine: string;
    source: string;
    target: string;
    apiKeys?: {
        openai?: string;
        anthropic?: string;
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
                // Map 'native' to 'offline' if that's the intent
                const result = await offlineTranslationService.translate(text, source, target);
                if (result.error) throw new Error(result.error);
                return { text: result.text, engine: 'offline' };
            }

            if (engine === 'google-free') {
                return await this.translateGoogleFree(text, source, target);
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

    private async translateGoogleFree(text: string, source: string, target: string): Promise<TranslationResult> {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`Google Translate failed: ${response.statusText}`);
        }

        const data = await response.json();
        // data[0] contains the translated segments.
        const translatedText = data[0].map((segment: any) => segment[0]).join('');

        return {
            text: translatedText,
            engine: 'google-free'
        };
    }

    private async translateLLM(text: string, source: string, target: string, engineId: string, apiKeys?: TranslationOptions['apiKeys']): Promise<TranslationResult> {
        if (engineId === 'llm-openai' && apiKeys?.openai) {
            return await this.translateOpenAI(text, source, target, apiKeys.openai);
        }
        if (engineId === 'llm-anthropic' && apiKeys?.anthropic) {
            return await this.translateAnthropic(text, source, target, apiKeys.anthropic);
        }
        if (engineId === 'llm-gemini' && apiKeys?.gemini) {
            return await this.translateGemini(text, source, target, apiKeys.gemini);
        }

        // Fallback
        if (apiKeys?.openai) {
            return await this.translateOpenAI(text, source, target, apiKeys.openai);
        } else if (apiKeys?.anthropic) {
            return await this.translateAnthropic(text, source, target, apiKeys.anthropic);
        } else if (apiKeys?.gemini) {
            return await this.translateGemini(text, source, target, apiKeys.gemini);
        }

        throw new Error(`No API Key configured for ${engineId}. Please check Settings.`);
    }

    private async translateOpenAI(text: string, source: string, target: string, apiKey: string): Promise<TranslationResult> {
        const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
        let lastError: any;

        for (const model of models) {
            try {
                logger.log(`Attempting OpenAI translation with model: ${model}`);
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
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
                    logger.error(`OpenAI API Error (${model}):`, JSON.stringify(err, null, 2));
                    lastError = err;
                    if (response.status === 429 || response.status === 401) break;
                    continue;
                }

                const data = await response.json();
                const translatedText = data.choices[0]?.message?.content?.trim();

                if (!translatedText) throw new Error('No translation in response');

                return {
                    text: translatedText,
                    engine: `llm-openai (${model})`
                };
            } catch (error: any) {
                logger.error(`Attempt failed for ${model}:`, error);
                lastError = error;
            }
        }
        throw new Error(`OpenAI API Error: ${lastError?.error?.message || lastError?.message || 'All models failed'}`);
    }

    private async translateAnthropic(text: string, _source: string, target: string, apiKey: string): Promise<TranslationResult> {
        const models = [
            'claude-3-5-haiku-20241022',
            'claude-3-5-sonnet-20240620',
            'claude-3-5-sonnet-20241022',
            'claude-3-opus-20240229'
        ];
        let lastError: any;

        for (const model of models) {
            try {
                logger.log(`Attempting Anthropic translation with model: ${model}`);
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
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
                    logger.error(`Anthropic API Error (${model}):`, JSON.stringify(err, null, 2));
                    lastError = err;
                    if (response.status === 429 || response.status === 401) break;
                    continue;
                }

                const data = await response.json();
                const translatedText = data.content[0]?.text;

                return { text: translatedText, engine: `llm-anthropic (${model})` };
            } catch (error: any) {
                logger.error(`Attempt failed for ${model}:`, error);
                lastError = error;
                if (error.message && error.message.includes('Anthropic Auth Error')) throw error;
            }
        }
        throw new Error(`Anthropic API Error: ${lastError?.error?.message || lastError?.message || 'Unknown error'}`);
    }

    private async translateGemini(text: string, _source: string, target: string, apiKey: string): Promise<TranslationResult> {
        const models = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'];
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
                    console.error(`Gemini API Error (${model}):`, JSON.stringify(err, null, 2));
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
