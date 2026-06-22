// LLM 翻訳用のプロンプト生成 / Prompt building for LLM translation
//
// Ollama・クラウド両エンジンで共用する。用語集やトーンなどの AI 機能も
// ここで system プロンプトに織り込む。
// （Shared by Ollama and cloud engines. AI features such as glossary and tone
//  are woven into the system prompt here.）

// NLLB コード / 2文字コードを英語の言語名へ / Map NLLB or 2-letter codes to English names
const LANGUAGE_NAMES: Record<string, string> = {
    auto: 'the auto-detected source language',
    en: 'English', eng_Latn: 'English',
    ja: 'Japanese', jpn_Jpan: 'Japanese',
    es: 'Spanish', spa_Latn: 'Spanish',
    fr: 'French', fra_Latn: 'French',
    de: 'German', deu_Latn: 'German',
    zh: 'Chinese', zho_Hans: 'Simplified Chinese', zho_Hant: 'Traditional Chinese',
    yue_Hant: 'Cantonese',
    ko: 'Korean', kor_Hang: 'Korean',
    it: 'Italian', ita_Latn: 'Italian',
    pt: 'Portuguese', por_Latn: 'Portuguese',
    ru: 'Russian', rus_Cyrl: 'Russian',
    nl: 'Dutch', nld_Latn: 'Dutch',
    pl: 'Polish', pol_Latn: 'Polish',
    tr: 'Turkish', tur_Latn: 'Turkish',
    vi: 'Vietnamese', vie_Latn: 'Vietnamese',
    th: 'Thai', tha_Thai: 'Thai',
    id: 'Indonesian', ind_Latn: 'Indonesian',
    hi: 'Hindi', hin_Deva: 'Hindi',
    ar: 'Arabic', arb_Arab: 'Arabic',
    bn: 'Bengali', ben_Beng: 'Bengali',
    cs: 'Czech', ces_Latn: 'Czech',
    da: 'Danish', dan_Latn: 'Danish',
    fi: 'Finnish', fin_Latn: 'Finnish',
    el: 'Greek', ell_Grek: 'Greek',
    he: 'Hebrew', heb_Hebr: 'Hebrew',
    hu: 'Hungarian', hun_Latn: 'Hungarian',
    ms: 'Malay', zsm_Latn: 'Malay',
    no: 'Norwegian', nob_Latn: 'Norwegian',
    ro: 'Romanian', ron_Latn: 'Romanian',
    sv: 'Swedish', swe_Latn: 'Swedish',
    tl: 'Filipino', tgl_Latn: 'Filipino',
    uk: 'Ukrainian', ukr_Cyrl: 'Ukrainian',
};

export function toLanguageName(code: string, fallback?: string): string {
    return LANGUAGE_NAMES[code] || fallback || code;
}

// 訳文のトーン / Translation tone
export type Tone = 'default' | 'formal' | 'casual' | 'business' | 'technical';

export interface GlossaryEntry {
    source: string;
    target: string;
}

export interface PromptOptions {
    source: string;
    target: string;
    tone?: Tone;
    glossary?: GlossaryEntry[];
}

const TONE_INSTRUCTIONS: Record<Tone, string> = {
    default: '',
    formal: 'Use a polite, formal register.',
    casual: 'Use a casual, friendly, conversational register.',
    business: 'Use professional business language suitable for formal correspondence.',
    technical: 'Preserve technical terminology precisely and use a neutral technical register.',
};

// 翻訳用の system プロンプトを生成 / Build the system prompt for translation
export function buildTranslationSystemPrompt(options: PromptOptions): string {
    const sourceName = toLanguageName(options.source, 'the source language');
    const targetName = toLanguageName(options.target);

    const lines: string[] = [
        `You are a professional translation engine. Translate the user's text from ${sourceName} into ${targetName}.`,
        'Output ONLY the translated text. Do not add explanations, notes, language names, or quotation marks.',
    ];

    const tone = options.tone && options.tone !== 'default' ? TONE_INSTRUCTIONS[options.tone] : '';
    if (tone) lines.push(tone);

    if (options.glossary && options.glossary.length > 0) {
        const pairs = options.glossary
            .filter((g) => g.source.trim() && g.target.trim())
            .map((g) => `- "${g.source}" => "${g.target}"`)
            .join('\n');
        if (pairs) {
            lines.push(
                'Apply the following glossary strictly. Whenever a source term appears, translate it exactly as specified:',
                pairs,
            );
        }
    }

    return lines.join('\n');
}

// 言い換え（文章改善）用の system プロンプト / System prompt for rephrasing (writing improvement)
export function buildRephraseSystemPrompt(lang: string): string {
    const name = toLanguageName(lang, 'the same language');
    return [
        `Rewrite the user's text in ${name} to be more natural, fluent, and concise while preserving the original meaning.`,
        'Output ONLY the rewritten text without explanations or quotation marks.',
    ].join('\n');
}

// 代替案・ニュアンス説明用の system プロンプト / System prompt for alternatives and nuance notes
export function buildAlternativesSystemPrompt(source: string, target: string): string {
    const sourceName = toLanguageName(source, 'the source language');
    const targetName = toLanguageName(target);
    return [
        `You help a user understand translation choices from ${sourceName} to ${targetName}.`,
        `Provide 2-3 alternative translations in ${targetName}, each on its own line, followed by a short note about nuance differences.`,
        'Be concise.',
    ].join('\n');
}
