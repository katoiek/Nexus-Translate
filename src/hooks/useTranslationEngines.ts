import { useState, useEffect } from 'react';
import { Sparkles, Settings } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface TranslationEngine {
	id: string;
	name: string;
	model?: string;
	icon: any;
	description: string;
}

export function useTranslationEngines() {
	const { t } = useLanguage();
	const [engines, setEngines] = useState<TranslationEngine[]>([]);

	useEffect(() => {
		const updateEngines = () => {
			let newEngines: TranslationEngine[] = [];

			// Offline Engine (Always available)
			newEngines.push({
				id: 'offline',
				name: 'Offline',
				model: 'NLLB-200',
				icon: Settings,
				description: 'Runs locally'
			});

			// LLM Engines (Available if API key is set)
			const openaiKey = localStorage.getItem('openai_api_key');
			const openaiModel = localStorage.getItem('openai_model') || 'gpt-4o';
			const anthropicKey = localStorage.getItem('anthropic_api_key');
			const anthropicModel = localStorage.getItem('anthropic_model') || '';
			const geminiKey = localStorage.getItem('gemini_api_key');
			const geminiModel = localStorage.getItem('gemini_model') || '';

			if (openaiKey) {
				newEngines.push({
					id: 'llm-openai',
					name: 'Open AI',
					model: openaiModel,
					icon: Sparkles,
					description: t.engines.description.openai
				});
			}
			if (anthropicKey) {
				newEngines.push({
					id: 'llm-anthropic',
					name: 'Claude',
					model: anthropicModel || 'claude-3-5-sonnet',
					icon: Sparkles,
					description: t.engines.description.anthropic
				});
			}
			if (geminiKey) {
				newEngines.push({
					id: 'llm-gemini',
					name: 'Google Gemini',
					model: geminiModel || 'gemini-2.0-flash',
					icon: Sparkles,
					description: t.engines.description.gemini
				});
			}

			setEngines(newEngines);
		};

		updateEngines();
		window.addEventListener('focus', updateEngines);
		window.addEventListener('settings-updated', updateEngines);

		return () => {
			window.removeEventListener('focus', updateEngines);
			window.removeEventListener('settings-updated', updateEngines);
		};
	}, [t.engines]);

	return engines;
}
