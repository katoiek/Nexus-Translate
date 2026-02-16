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

            if (engine === 'llm') {
                return await this.translateLLM(text, source, target, apiKeys);
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

    private async translateLLM(text: string, source: string, target: string, apiKeys?: TranslationOptions['apiKeys']): Promise<TranslationResult> {
        // Determine which LLM to use based on available keys or default to OpenAI if multiple
        // For simplicity, let's look for keys in a priority order: OpenAI -> Anthropic -> Gemini

        if (apiKeys?.openai) {
            return await this.translateOpenAI(text, source, target, apiKeys.openai);
        } else if (apiKeys?.anthropic) {
            return await this.translateAnthropic(text, source, target, apiKeys.anthropic);
        } else if (apiKeys?.gemini) {
            return await this.translateGemini(text, source, target, apiKeys.gemini);
        }

        throw new Error('No API Key configured for LLM. Please check Settings.');
    }

    private async translateOpenAI(text: string, source: string, target: string, apiKey: string): Promise<TranslationResult> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // or gpt-3.5-turbo
                messages: [
                    {
                        role: "system",
                        content: `You are a professional translator. Translate the following text from ${source === 'auto' ? 'auto-detected language' : source} to ${target}. Output ONLY the translated text, no explanations.`
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
            throw new Error(`OpenAI API Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const translatedText = data.choices[0]?.message?.content?.trim();

        return {
            text: translatedText,
            engine: 'llm-openai'
        };
    }

    private async translateAnthropic(text: string, source: string, target: string, apiKey: string): Promise<TranslationResult> {
        // Implement Anthropic
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229',
                max_tokens: 1024,
                system: `You are a professional translator. Translate the following text from ${source === 'auto' ? 'auto-detected language' : source} to ${target}. Output ONLY the translated text.`,
                messages: [
                    { role: "user", content: text }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Anthropic API Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const translatedText = data.content[0]?.text;

        return {
            text: translatedText,
            engine: 'llm-anthropic'
        };
    }

    private async translateGemini(text: string, source: string, target: string, apiKey: string): Promise<TranslationResult> {
        // Implement Gemini
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Translate the following to ${target}: ${text}`
                    }]
                }]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Gemini API Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return {
            text: translatedText || 'Translation failed',
            engine: 'llm-gemini'
        };
    }
}

export const translationService = new TranslationService();
