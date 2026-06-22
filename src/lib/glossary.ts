import { GlossaryEntry } from './translationPrompt';
import { STORAGE_KEYS } from './settings';
import { logger } from './logger';

// 用語集は localStorage に JSON 配列で保存 / Glossary is stored in localStorage as a JSON array
const STORAGE_KEY = STORAGE_KEYS.aiGlossary;

export function loadGlossary(): GlossaryEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((e) => e && typeof e.source === 'string' && typeof e.target === 'string');
    } catch (e) {
        logger.error('[glossary] load failed', e);
        return [];
    }
}

export function saveGlossary(entries: GlossaryEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('settings-updated'));
}
