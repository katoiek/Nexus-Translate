import { invoke } from '@tauri-apps/api/core';
import { logger } from '../lib/logger';

interface TranslationResult {
    text: string;
    detectedSourceLanguage?: string;
    error?: string;
}

class HyMT2TranslationService {
    async translate(text: string, source: string, target: string): Promise<TranslationResult> {
        if (!text.trim()) {
            return { text: '', detectedSourceLanguage: source };
        }

        try {
            const prompt = this.buildPrompt(text, source, target);
            const translatedText = await invoke<string>('translate_hymt2_local', { prompt });
            if (!translatedText) {
                throw new Error('Hy-MT2 から翻訳結果が返りませんでした。');
            }

            return {
                text: translatedText,
                detectedSourceLanguage: source,
            };
        } catch (error: unknown) {
            logger.error('[HyMT2TranslationService] Translation failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            return { text, detectedSourceLanguage: source, error: message };
        }
    }

    private buildPrompt(text: string, source: string, target: string): string {
        const sourceName = this.toLanguageName(source, 'auto-detected language');
        const targetName = this.toLanguageName(target, target);

        return [
            `Translate the following text from ${sourceName} into ${targetName}.`,
            'Note that you must ONLY output the translated result without any additional explanation:',
            '',
            text,
        ].join('\n');
    }

    private toLanguageName(code: string, fallback: string): string {
        const mapping: Record<string, string> = {
            auto: 'auto-detected language',
            en: 'English',
            eng_Latn: 'English',
            ja: 'Japanese',
            jpn_Jpan: 'Japanese',
            es: 'Spanish',
            spa_Latn: 'Spanish',
            fr: 'French',
            fra_Latn: 'French',
            de: 'German',
            deu_Latn: 'German',
            zh: 'Chinese',
            zho_Hans: 'Simplified Chinese',
            zho_Hant: 'Traditional Chinese',
            ko: 'Korean',
            kor_Hang: 'Korean',
            it: 'Italian',
            ita_Latn: 'Italian',
            pt: 'Portuguese',
            por_Latn: 'Portuguese',
            ru: 'Russian',
            rus_Cyrl: 'Russian',
            nl: 'Dutch',
            nld_Latn: 'Dutch',
            pl: 'Polish',
            pol_Latn: 'Polish',
            tr: 'Turkish',
            tur_Latn: 'Turkish',
            vi: 'Vietnamese',
            vie_Latn: 'Vietnamese',
            th: 'Thai',
            tha_Thai: 'Thai',
            id: 'Indonesian',
            ind_Latn: 'Indonesian',
            hi: 'Hindi',
            hin_Deva: 'Hindi',
            ar: 'Arabic',
            arb_Arab: 'Arabic',
            bn: 'Bengali',
            ben_Beng: 'Bengali',
            cs: 'Czech',
            ces_Latn: 'Czech',
            da: 'Danish',
            dan_Latn: 'Danish',
            fi: 'Finnish',
            fin_Latn: 'Finnish',
            el: 'Greek',
            ell_Grek: 'Greek',
            he: 'Hebrew',
            heb_Hebr: 'Hebrew',
            hu: 'Hungarian',
            hun_Latn: 'Hungarian',
            ms: 'Malay',
            zsm_Latn: 'Malay',
            no: 'Norwegian',
            nob_Latn: 'Norwegian',
            ro: 'Romanian',
            ron_Latn: 'Romanian',
            sv: 'Swedish',
            swe_Latn: 'Swedish',
            tl: 'Filipino',
            tgl_Latn: 'Filipino',
            uk: 'Ukrainian',
            ukr_Cyrl: 'Ukrainian',
        };
        return mapping[code] || fallback;
    }
}

export const hyMT2TranslationService = new HyMT2TranslationService();
