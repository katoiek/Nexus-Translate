export const detectLanguage = (text: string): string => {
	if (!text || text.trim().length === 0) return 'auto';

	// Count different script types
	const counts = {
		kana: (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length,
		han: (text.match(/[\u4e00-\u9faf]/g) || []).length, // Common Hanzi/Kanji
		lat: (text.match(/[a-zA-Z]/g) || []).length,
		kor: (text.match(/[\uac00-\ud7af]/g) || []).length
	};

	// Priority 1: Japanese Kana (If there's any Hiragana or Katakana, it's almost certainly Japanese)
	if (counts.kana > 0) return 'jpn_Jpan';

	// Priority 2: Korean
	if (counts.kor > 0) return 'kor_Hang';

	// Priority 3: Latin vs Chinese (Simplified/Traditional/Kanji-only)
	if (counts.lat > 0 && counts.lat >= counts.han) {
		return 'eng_Latn';
	}
	
	if (counts.han > 0) {
		return 'zho_Hans'; // Default to Simplified Chinese if no kana/hangul present
	}

	return 'auto';
};

export const getLanguageName = (code: string, languages: { code: string, name: string }[]): string => {
	const lang = languages.find(l => l.code === code);
	return lang ? lang.name : code;
};
