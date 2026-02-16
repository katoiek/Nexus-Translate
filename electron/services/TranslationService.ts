import { net } from 'electron';

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
            if (engine === 'google-free') {
                return await this.translateGoogleFree(text, source, target);
            }

            if (engine.startsWith('llm')) {
                return await this.translateLLM(text, source, target, engine, apiKeys);
            }

            if (engine === 'native') {
                // Fallback to Google Free for now as native is not implemented
                return await this.translateGoogleFree(text, source, target);
            }

            throw new Error(`Unsupported engine: ${engine}`);
        } catch (error: any) {
            console.error('Translation Error:', error);
            throw error;
        }
    }

    private async translateGoogleFree(text: string, source: string, target: string): Promise<TranslationResult> {
        // Simple fetch to Google Translate API (undocumented/free endpoint)
        // Note: This might be rate limited or blocked, but suffices for a "free" tier demo.
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Translate failed: ${response.statusText}`);
        }

        const data = await response.json();
        // data[0] contains the translated segments. 
        // data[0][0][0] is the translated text.
        // It can be multiple segments if the text is long.
        const translatedText = data[0].map((segment: any) => segment[0]).join('');

        return {
            text: translatedText,
            engine: 'google-free'
        };
    }

    private async translateLLM(text: string, source: string, target: string, engineId: string, apiKeys?: TranslationOptions['apiKeys']): Promise<TranslationResult> {
        // Use specific engine if ID matches, or fallback to priority list if generic 'llm' (legacy support)

        if (engineId === 'llm-openai' && apiKeys?.openai) {
            return await this.translateOpenAI(text, source, target, apiKeys.openai);
        }
        if (engineId === 'llm-anthropic' && apiKeys?.anthropic) {
            return await this.translateAnthropic(text, source, target, apiKeys.anthropic);
        }
        if (engineId === 'llm-gemini' && apiKeys?.gemini) {
            return await this.translateGemini(text, source, target, apiKeys.gemini);
        }

        // Fallback for generic 'llm' or missing specific key
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
        const models = [
            'gpt-4o',
            'gpt-4-turbo',
            'gpt-3.5-turbo'
        ];

        let lastError: any;

        for (const model of models) {
            try {
                console.log(`Attempting OpenAI translation with model: ${model}`);
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
                            {
                                role: "user",
                                content: text
                            }
                        ]
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    console.error(`OpenAI API Error (${model}):`, JSON.stringify(err, null, 2));
                    lastError = err;
                    continue; // Try next model
                }

                const data = await response.json();
                const translatedText = data.choices[0]?.message?.content?.trim();

                if (!translatedText) {
                    throw new Error('No translation in response');
                }

                return {
                    text: translatedText,
                    engine: `llm-openai (${model})`
                };
            } catch (error: any) {
                console.error(`Attempt failed for ${model}:`, error);
                lastError = error;
            }
        }

        throw new Error(`OpenAI API Error: ${lastError?.error?.message || lastError?.message || 'All models failed'}`);
    }

    private async translateAnthropic(text: string, source: string, target: string, apiKey: string): Promise<TranslationResult> {
        const models = [
            'claude-3-5-sonnet-20240620',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307'
        ];

        let lastError: any;

        for (const model of models) {
            try {
                console.log(`Attempting Anthropic translation with model: ${model}`);
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
                        messages: [
                            { role: "user", content: text }
                        ]
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    console.error(`Anthropic API Error (${model}):`, JSON.stringify(err, null, 2));
                    lastError = err;
                    // If error is 'authentication_error' or 'permission_error', don't retry other models as they will likely fail too
                    if (err.error?.type === 'authentication_error') {
                        throw new Error(`Anthropic Auth Error: ${err.error.message}`);
                    }
                    continue; // Try next model
                }

                const data = await response.json();
                const translatedText = data.content[0]?.text;

                return {
                    text: translatedText,
                    engine: `llm-anthropic (${model})`
                };
            } catch (error: any) {
                console.error(`Attempt failed for ${model}:`, error);
                lastError = error;
                if (error.message && error.message.includes('Anthropic Auth Error')) {
                    throw error;
                }
            }
        }

        throw new Error(`Anthropic API Error: ${lastError?.error?.message || lastError?.message || 'Unknown error'}`);
    }

    private async translateGemini(text: string, source: string, target: string, apiKey: string): Promise<TranslationResult> {
        // Try multiple models in order
        // Based on user's available models and rate limits
        const models = [
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite', // Fallback for better rate limits
            'gemini-2.5-flash',      // Try newer model
            'gemini-flash-latest',
        ];

        let lastError: any;

        for (const model of models) {
            try {
                console.log(`Attempting Gemini translation with model: ${model}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
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
                    lastError = err;

                    // Specific check for 404 to try listing models once
                    if (response.status === 404 && model === models[0]) {
                        this.logAvailableGeminiModels(apiKey).catch(console.error);
                    }

                    continue; // Try next model
                }

                const data = await response.json();
                const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!translatedText) {
                    throw new Error('No translation in response');
                }

                return {
                    text: translatedText,
                    engine: `llm-gemini (${model})`
                };
            } catch (error: any) {
                console.error(`Attempt failed for ${model}:`, error);
                lastError = error;
            }
        }

        throw new Error(`Gemini API Error: ${lastError?.error?.message || lastError?.message || 'All models failed'}`);
    }

    private async logAvailableGeminiModels(apiKey: string) {
        try {
            console.log('Fetching available Gemini models...');
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await response.json();
            if (data.models) {
                console.log('Available Gemini Models:', data.models.map((m: any) => m.name));
            } else {
                console.log('Failed to list models:', data);
            }
        } catch (e) {
            console.error('Error listing models:', e);
        }
    }
}

export const translationService = new TranslationService();
