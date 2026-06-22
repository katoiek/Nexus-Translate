import { useState, useEffect } from 'react';
import { Sparkles, Settings, Boxes } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ollamaService } from '../services/OllamaService';
import { STORAGE_KEYS } from '../lib/settings';

export interface TranslationEngine {
	id: string;
	name: string;
	model?: string;
	icon: any;
	description: string;
	// LLM 生成系か（AI機能が使えるか）/ Whether this is an LLM engine (AI features available)
	isLLM?: boolean;
}

export function useTranslationEngines() {
	const { t } = useLanguage();
	const [engines, setEngines] = useState<TranslationEngine[]>([]);

	useEffect(() => {
		let cancelled = false;

		const updateEngines = async () => {
			const newEngines: TranslationEngine[] = [];

			// 同梱エンジン: NLLB-600M。常に利用可能なゼロ設定の既定エンジン
			// / Bundled engine: NLLB-600M, always-available zero-setup default
			newEngines.push({
				id: 'offline',
				name: 'Offline',
				model: 'NLLB-600M',
				icon: Settings,
				description: t.engines.description.native,
			});

			// Ollama エンジン: ローカルにインストール済みの Ollama を利用
			// / Ollama engine: uses the locally installed Ollama
			const selectedModel = ollamaService.getSelectedModel();
			newEngines.push({
				id: 'ollama',
				name: 'Ollama',
				model: selectedModel || t.engines.ollamaNoModel,
				icon: Boxes,
				description: t.engines.description.ollama,
				isLLM: true,
			});

			// クラウドエンジン: APIキーが設定されている場合のみ
			const openaiKey = localStorage.getItem(STORAGE_KEYS.openaiApiKey);
			const openaiModel = localStorage.getItem(STORAGE_KEYS.openaiModel) || 'gpt-4o';
			const anthropicKey = localStorage.getItem(STORAGE_KEYS.anthropicApiKey);
			const anthropicModel = localStorage.getItem(STORAGE_KEYS.anthropicModel) || '';
			const geminiKey = localStorage.getItem(STORAGE_KEYS.geminiApiKey);
			const geminiModel = localStorage.getItem(STORAGE_KEYS.geminiModel) || '';

			if (openaiKey) {
				newEngines.push({ id: 'llm-openai', name: 'Open AI', model: openaiModel, icon: Sparkles, description: t.engines.description.openai, isLLM: true });
			}
			if (anthropicKey) {
				newEngines.push({ id: 'llm-anthropic', name: 'Claude', model: anthropicModel || 'claude-3-5-sonnet', icon: Sparkles, description: t.engines.description.anthropic, isLLM: true });
			}
			if (geminiKey) {
				newEngines.push({ id: 'llm-gemini', name: 'Google Gemini', model: geminiModel || 'gemini-2.0-flash', icon: Sparkles, description: t.engines.description.gemini, isLLM: true });
			}

			if (!cancelled) setEngines(newEngines);
		};

		updateEngines();
		window.addEventListener('focus', updateEngines);
		window.addEventListener('settings-updated', updateEngines);

		return () => {
			cancelled = true;
			window.removeEventListener('focus', updateEngines);
			window.removeEventListener('settings-updated', updateEngines);
		};
	}, [t.engines]);

	return engines;
}
