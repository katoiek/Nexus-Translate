import { useState, useEffect } from 'react';
import { message } from '@tauri-apps/plugin-dialog';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ArrowRightLeft, Sparkles, Settings, Copy, Check, Volume2, StopCircle, Minus, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { detectLanguage } from '../lib/languageUtils';
import { useTranslationEngines } from '../hooks/useTranslationEngines';
import { translationService } from '../services/TranslationService';
import { logger } from '../lib/logger';

interface TranslationViewProps {
    onNavigateToSettings?: () => void;
    onMinimize?: () => void;
    onClose?: () => void;
    onRequestScreenshot?: () => void;
}

export function TranslationView({ onNavigateToSettings, onMinimize, onClose, onRequestScreenshot }: TranslationViewProps) {
    const { t } = useLanguage();
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [selectedEngine, setSelectedEngine] = useState('offline');
    const availableEngines = useTranslationEngines();
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('jpn_Jpan');
    const [_, setIsTranslating] = useState(false);
    const [copiedSource, setCopiedSource] = useState(false);
    const [copiedTarget, setCopiedTarget] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const handleCopy = async (text: string, isSource: boolean) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (isSource) {
                setCopiedSource(true);
                setTimeout(() => setCopiedSource(false), 2000);
            } else {
                setCopiedTarget(true);
                setTimeout(() => setCopiedTarget(false), 2000);
            }
        } catch (err) {
            logger.error('Failed to copy:', err);
        }
    };

    useEffect(() => {
        const applyDetectedLanguage = (text: string) => {
            if (!text) return;
            const detected = detectLanguage(text);

            if (detected !== 'auto') {
                setSourceLang(detected);
                setTargetLang(prevTarget => {
                    if (detected === prevTarget) {
                        return detected === 'eng_Latn' ? 'jpn_Jpan' : 'eng_Latn';
                    }
                    return prevTarget;
                });
            } else {
                setSourceLang('auto');
            }
            setSourceText(text);
        };

        const handleSmartTranslateTrigger = async () => {
            try {
                const text = await readText();
                if (text && text.trim().length > 0) {
                    applyDetectedLanguage(text);
                }
            } catch (err: any) {
                // Ignore error if clipboard content is not text (e.g., images)
                logger.log('Clipboard is empty or contains non-text content, ignoring trigger.');
            }
        };

        const handleOCRResult = (e: CustomEvent<string>) => {
            if (e.detail) {
                applyDetectedLanguage(e.detail);
            }
        };

        window.addEventListener('smart-translate-trigger', handleSmartTranslateTrigger);
        window.addEventListener('ocr-captured-text', handleOCRResult as EventListener);

        return () => {
            window.removeEventListener('smart-translate-trigger', handleSmartTranslateTrigger);
            window.removeEventListener('ocr-captured-text', handleOCRResult as EventListener);
        };
    }, []);

    // Auto-translate with debounce
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
        setIsTranslating(true);
        const textToTranslate = typeof overrideSourceText === 'string' ? overrideSourceText : sourceText;

        if (!textToTranslate.trim()) {
            setTargetText('');
            setIsTranslating(false);
            return;
        }

        try {
            // Smart Language Switching
            const detected = detectLanguage(textToTranslate);
            let currentSource = sourceLang;
            let currentTarget = targetLang;

            if (detected !== 'other') {
                if (detected === targetLang) {
                    currentSource = targetLang;
                    currentTarget = sourceLang === 'auto' ? 'en' : sourceLang;
                    setSourceLang(currentSource);
                    setTargetLang(currentTarget);
                }
            }

            const apiKeys = {
                openai: localStorage.getItem('openai_api_key') || undefined,
                anthropic: localStorage.getItem('anthropic_api_key') || undefined,
                gemini: localStorage.getItem('gemini_api_key') || undefined,
            };

            const result = await translationService.translate(textToTranslate, {
                engine: selectedEngine,
                source: currentSource,
                target: currentTarget,
                apiKeys,
            });

            setTargetText(result.text || t.translation.translationFailed);
        } catch (error: any) {
            logger.error(error);
            // message(`Translation Failed: ${error}`, { title: 'App Error', kind: 'error' });
            setTargetText(t.translation.errorOccurred);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleOCR = async () => {
        if (onRequestScreenshot) {
            onRequestScreenshot();
        }
    };

    const handleSpeak = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
            alert("Screenshot capture is being migrated to Tauri.");
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
            {/* Window Drag Region */}
            <div
                className="absolute inset-x-0 top-0 h-16 z-0"
                data-tauri-drag-region
                style={{ WebkitAppRegion: 'drag' } as any}
            />

            <header className="flex items-center justify-between mb-8 animate-fade-in flex-none relative z-10" data-tauri-drag-region>
                <div className="flex items-center gap-3 group pointer-events-none">
                    <div className="size-10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <img src="icon.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">Nexus Translate</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex bg-slate-900/50 border border-white/10 rounded-full p-1 backdrop-blur-md">
                        {availableEngines.map(e => {
                            const Icon = e.icon;
                            const isSelected = selectedEngine === e.id;
                            return (
                                <button
                                    key={e.id}
                                    onClick={() => setSelectedEngine(e.id)}
                                    className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${isSelected
                                        ? 'text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {isSelected && (
                                        <span className="absolute inset-0 bg-blue-600/80 rounded-full -z-10 animate-scale-in" />
                                    )}
                                    <Icon className="size-4" />
                                    {e.name}
                                    <span className="hidden lg:inline text-[10px] opacity-60 ml-1 font-normal">
                                        {e.description}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <Button variant="ghost" size="icon" onClick={onNavigateToSettings} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <Settings className="size-5" />
                    </Button>
                    <div className="w-px bg-white/10 h-6 mx-1" />
                    <Button variant="ghost" size="icon" onClick={onMinimize} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <Minus className="size-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                        <X className="size-5" />
                    </Button>
                </div>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 animate-fade-up max-w-7xl mx-auto w-full min-h-0">
                {/* Source Panel */}
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between px-2 h-10 flex-none">
                        <LanguageSelector
                            value={sourceLang}
                            onChange={setSourceLang}
                            label="原文の言語を選択"
                        />
                    </div>

                    <div className="glass flex-1 rounded-3xl relative group transition-all duration-300 hover:bg-slate-900/60 hover:shadow-blue-900/20 focus-within:ring-1 focus-within:ring-blue-500/50 min-h-0 overflow-hidden">
                        <div className="absolute inset-0 p-6">
                            <Textarea
                                placeholder={t.translation.placeholder}
                                className="w-full h-full resize-none border-0 bg-transparent text-xl p-0 leading-relaxed font-light text-slate-100 placeholder:text-slate-600 focus-visible:ring-0 selection:bg-blue-500/30 pb-12 overflow-y-auto"
                                value={sourceText}
                                onChange={(e) => setSourceText(e.target.value)}
                            />
                        </div>

                        <div className="absolute bottom-4 right-4 flex items-center gap-3 z-10">
                            <span className="text-xs text-slate-600 font-mono mr-2">{sourceText.length} {t.translation.chars}</span>

                            <div className="flex bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 gap-1 border border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleCopy(sourceText, true)}
                                    className="h-10 w-10 rounded-lg hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                                    title={t.translation.copyText}
                                >
                                    {copiedSource ? <Check className="size-5 text-green-400" /> : <Copy className="size-5" />}
                                </Button>
                                <div className="w-px bg-white/10 my-2" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleOCR}
                                    className="h-10 w-10 gap-2 rounded-lg text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all font-medium"
                                    title={t.translation.capture}
                                >
                                    <div
                                        className="size-5 bg-blue-400 transition-colors group-hover:bg-blue-300"
                                        style={{
                                            maskImage: 'url(screenshot-icon.png)',
                                            maskSize: 'contain',
                                            maskRepeat: 'no-repeat',
                                            maskPosition: 'center',
                                            WebkitMaskImage: 'url(screenshot-icon.png)',
                                            WebkitMaskSize: 'contain',
                                            WebkitMaskRepeat: 'no-repeat',
                                            WebkitMaskPosition: 'center'
                                        }}
                                    />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Target Panel */}
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between px-2 h-10">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-transform hover:rotate-180 duration-500"
                                onClick={swapLanguages}
                                disabled={sourceLang === 'auto'}
                            >
                                <ArrowRightLeft className="size-4" />
                            </Button>
                            <LanguageSelector
                                value={targetLang}
                                onChange={setTargetLang}
                                excludeAuto={true}
                                label="訳文の言語を選択"
                            />
                        </div>
                    </div>

                    <div className="glass-card flex-1 rounded-3xl relative group transition-all duration-300 hover:bg-card/40 hover:shadow-indigo-900/20 min-h-0 overflow-hidden">
                        <div className="absolute inset-0 p-6 overflow-y-auto">
                            <div className="min-h-full text-xl leading-relaxed whitespace-pre-wrap font-light text-slate-50 selection:bg-indigo-500/30 pb-16">
                                {targetText ? (
                                    targetText
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                                        <Sparkles className="size-12 stroke-1" />
                                        <span className="text-sm font-medium">{t.translation.ready}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Right Actions for Target */}
                        <div className="absolute bottom-4 right-4 flex items-center gap-3 z-10">
                            {targetText && (
                                <div className="flex bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleSpeak}
                                        className={`h-10 w-10 rounded-lg hover:bg-white/10 ${isSpeaking ? 'text-red-400 hover:text-red-300' : 'text-blue-400 hover:text-blue-300'} transition-colors`}
                                        title={isSpeaking ? "Stop" : "Listen"}
                                    >
                                        {isSpeaking ? <StopCircle className="size-5" /> : <Volume2 className="size-5" />}
                                    </Button>
                                    <div className="w-px bg-white/10 my-2" />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleCopy(targetText, false)}
                                        className="h-10 w-10 rounded-lg hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                                        title={t.translation.copyTranslation}
                                    >
                                        {copiedTarget ? <Check className="size-5 text-green-400" /> : <Copy className="size-5" />}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
