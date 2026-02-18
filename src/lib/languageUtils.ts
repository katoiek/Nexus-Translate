export const detectLanguage = (text: string): string => {
	// Japanese: Hiragana or Katakana (Strong indicator)
	if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'jpn_Jpan';

	// Korean: Hangul
	if (/[\uac00-\ud7af]/.test(text)) return 'kor_Hang';

	// Chinese: Hanzi (and no Kana)
	if (/[\u4e00-\u9faf]/.test(text)) return 'zho_Hans';

	// Cyrillic: Russian/Ukrainian
	if (/[\u0400-\u04ff]/.test(text)) return 'rus_Cyrl';

	// Latin: English, etc.
	if (/[a-zA-Z]/.test(text)) return 'eng_Latn';

	return 'auto';
};

export const getLanguageName = (code: string, languages: { code: string, name: string }[]): string => {
	const lang = languages.find(l => l.code === code);
	return lang ? lang.name : code;
};
