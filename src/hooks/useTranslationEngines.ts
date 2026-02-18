import { useState, useEffect } from 'react';
import { Sparkles, Settings } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface TranslationEngine {
	id: string;
	name: string;
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
				name: 'Offline (NLLB-200)',
				icon: Settings,
				description: 'Runs locally'
			});

			// LLM Engines (Available if API key is set)
			const openaiKey = localStorage.getItem('openai_api_key');
			const anthropicKey = localStorage.getItem('anthropic_api_key');
			const geminiKey = localStorage.getItem('gemini_api_key');

			if (openaiKey) {
				newEngines.push({
					id: 'llm-openai',
					name: 'OpenAI (GPT-4o)',
					icon: Sparkles,
					description: t.engines.description.openai
				});
			}
			if (anthropicKey) {
				newEngines.push({
					id: 'llm-anthropic',
					name: 'Claude 3.5 Sonnet',
					icon: Sparkles,
					description: t.engines.description.anthropic
				});
			}
			if (geminiKey) {
				newEngines.push({
					id: 'llm-gemini',
					name: 'Gemini 2.0 Flash',
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
