import { useState, useEffect } from 'react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { detectLanguage } from '../lib/languageUtils';
import { useTranslationEngines } from '../hooks/useTranslationEngines';
import { translationService } from '../services/TranslationService';
import { logger } from '../lib/logger';
import { EngineSelector } from './translation/EngineSelector';
import { SourcePanel } from './translation/SourcePanel';
import { TargetPanel } from './translation/TargetPanel';

interface TranslationViewProps {
    onNavigateToSettings?: () => void;
    onRequestScreenshot?: () => void;
}

export function TranslationView({ onNavigateToSettings, onRequestScreenshot }: TranslationViewProps) {
    const { t } = useLanguage();
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [selectedEngine, setSelectedEngine] = useState('offline');
    const availableEngines = useTranslationEngines();
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('jpn_Jpan');
    const [copiedSource, setCopiedSource] = useState(false);
    const [copiedTarget, setCopiedTarget] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const handleCopySource = async () => {
        if (!sourceText) return;
        try {
            await navigator.clipboard.writeText(sourceText);
            setCopiedSource(true);
            setTimeout(() => setCopiedSource(false), 2000);
        } catch (err) {
            logger.error('Failed to copy:', err);
        }
    };

    const handleCopyTarget = async () => {
        if (!targetText) return;
        try {
            await navigator.clipboard.writeText(targetText);
            setCopiedTarget(true);
            setTimeout(() => setCopiedTarget(false), 2000);
        } catch (err) {
            logger.error('Failed to copy:', err);
        }
    };

    useEffect(() => {
        const applyDetectedLanguage = (text: string) => {
            if (!text) return;
            const detected = detectLanguage(text);

            if (detected !== 'auto' && sourceLang === 'auto') {
                setSourceLang(detected);
            }
            setSourceText(text);
        };

        const handleSmartTranslateTrigger = async () => {
            try {
                const text = await readText();
                if (text && text.trim().length > 0) {
                    applyDetectedLanguage(text);
                }
            } catch {
                // Ignore error if clipboard content is not text (e.g., images)
                logger.log('Clipboard is empty or contains non-text content, ignoring trigger.');
            }
        };

        const handleOCRResult = (e: Event) => {
            const detail = (e as CustomEvent<string>).detail;
            if (detail) {
                applyDetectedLanguage(detail);
            }
        };

        window.addEventListener('smart-translate-trigger', handleSmartTranslateTrigger);
        window.addEventListener('ocr-captured-text', handleOCRResult);

        return () => {
            window.removeEventListener('smart-translate-trigger', handleSmartTranslateTrigger);
            window.removeEventListener('ocr-captured-text', handleOCRResult);
        };
    }, []);

    // debounce で自動翻訳
    useEffect(() => {
        if (!sourceText || sourceText.trim() === '') {
            setTargetText('');
            return;
        }

        const timer = setTimeout(() => {
            handleTranslate();
        }, 1000);

        return () => clearTimeout(timer);
    }, [sourceText, selectedEngine, targetLang, sourceLang]);

    const handleTranslate = async (overrideSourceText?: string) => {
        const textToTranslate = typeof overrideSourceText === 'string' ? overrideSourceText : sourceText;

        if (!textToTranslate.trim()) {
            setTargetText('');
            return;
        }

        try {
            // スマート言語切り替え
            const detected = detectLanguage(textToTranslate);
            let currentSource = sourceLang === 'auto' ? detected : sourceLang;
            let currentTarget = targetLang;

            if (currentSource === 'auto') {
                currentSource = 'eng_Latn';
            }

            // 同一言語なら自動的に入れ替え
            if (currentSource === currentTarget) {
                currentTarget = currentSource === 'eng_Latn' ? 'jpn_Jpan' : 'eng_Latn';
            }

            const apiKeys = {
                openai: localStorage.getItem('openai_api_key') || undefined,
                openaiModel: localStorage.getItem('openai_model') || undefined,
                anthropic: localStorage.getItem('anthropic_api_key') || undefined,
                anthropicModel: localStorage.getItem('anthropic_model') || undefined,
                gemini: localStorage.getItem('gemini_api_key') || undefined,
            };

            const result = await translationService.translate(textToTranslate, {
                engine: selectedEngine,
                source: currentSource,
                target: currentTarget,
                apiKeys,
            });

            setTargetText(result.text || t.translation.translationFailed);
        } catch (error: unknown) {
            logger.error('[TranslationView] Translation Failed Detail:', error);
            setTargetText(t.translation.errorOccurred);
        }
    };

    const handleSpeak = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        if (!targetText) return;

        const utterance = new SpeechSynthesisUtterance(targetText);
        let langTag = targetLang;
        if (targetLang === 'eng_Latn') langTag = 'en-US';
        else if (targetLang === 'jpn_Jpan') langTag = 'ja-JP';
        else if (targetLang === 'zho_Hans') langTag = 'zh-CN';
        else if (targetLang === 'zho_Hant') langTag = 'zh-TW';
        else if (targetLang === 'yue_Hant') langTag = 'zh-HK';
        else if (targetLang === 'kor_Hang') langTag = 'ko-KR';
        else if (targetLang === 'fra_Latn') langTag = 'fr-FR';
        else if (targetLang === 'spa_Latn') langTag = 'es-ES';
        else if (targetLang === 'rus_Cyrl') langTag = 'ru-RU';
        else if (targetLang.length > 3) langTag = targetLang.substring(0, 3);

        utterance.lang = langTag;
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(utterance.lang));
        if (voice) {
            utterance.voice = voice;
        }

        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    const swapLanguages = () => {
        if (sourceLang === 'auto') return;
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
        setSourceText(targetText);
        setTargetText(sourceText);
    };

    return (
        <div className="h-screen flex flex-col p-6 font-display overflow-hidden relative">

            <header className="flex items-center justify-between mb-8 animate-fade-in flex-none relative z-[50]">
                <div className="flex items-center gap-3 group pointer-events-auto">
                    <div className="size-10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <img src="icon.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">Nexus Translate</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    <EngineSelector
                        engines={availableEngines}
                        selectedEngine={selectedEngine}
                        onSelect={setSelectedEngine}
                    />

                    <Button variant="ghost" size="icon" onClick={onNavigateToSettings} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <Settings className="size-5" />
                    </Button>
                </div>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 animate-fade-up max-w-none w-full min-h-0">
                <SourcePanel
                    sourceText={sourceText}
                    sourceLang={sourceLang}
                    copiedSource={copiedSource}
                    onTextChange={setSourceText}
                    onLangChange={setSourceLang}
                    onCopy={handleCopySource}
                    onOCR={() => onRequestScreenshot?.()}
                    t={t}
                />
                <TargetPanel
                    targetText={targetText}
                    targetLang={targetLang}
                    sourceLang={sourceLang}
                    copiedTarget={copiedTarget}
                    isSpeaking={isSpeaking}
                    onLangChange={setTargetLang}
                    onSwapLanguages={swapLanguages}
                    onCopy={handleCopyTarget}
                    onSpeak={handleSpeak}
                    t={t}
                />
            </main>
        </div>
    );
}
