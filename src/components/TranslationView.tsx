import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

import { ArrowRightLeft, Sparkles, Globe, ScanText, Settings, Copy, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TranslationViewProps {
    onNavigateToSettings?: () => void;
}

const detectLanguage = (text: string): 'ja' | 'en' | 'other' => {
    const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);
    if (hasJapanese) return 'ja';
    const hasEnglish = /^[a-zA-Z0-9\s.,!?'"()]+$/.test(text);
    if (hasEnglish) return 'en';
    return 'other';
};

export function TranslationView({ onNavigateToSettings }: TranslationViewProps) {
    const { t } = useLanguage();
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [selectedEngine, setSelectedEngine] = useState('google-free');
    const [availableEngines, setAvailableEngines] = useState<any[]>([]);
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('ja');
    const [_, setIsTranslating] = useState(false);
    const [copiedSource, setCopiedSource] = useState(false);
    const [copiedTarget, setCopiedTarget] = useState(false);

    const languages = useMemo(() => [
        { code: 'auto', name: t.languages.auto },
        { code: 'en', name: t.languages.en },
        { code: 'ja', name: t.languages.ja },
        { code: 'es', name: t.languages.es },
        { code: 'fr', name: t.languages.fr },
        { code: 'de', name: t.languages.de },
        { code: 'zh', name: t.languages.zh },
        { code: 'ko', name: t.languages.ko },
    ], [t.languages]);

    useEffect(() => {
        const updateEngines = () => {
            let newEngines: any[] = [];

            newEngines.push({ id: 'google-free', name: 'Google Translate (Web)', icon: Globe, description: t.engines.description.google });

            const openaiKey = localStorage.getItem('openai_api_key');
            const anthropicKey = localStorage.getItem('anthropic_api_key');
            const geminiKey = localStorage.getItem('gemini_api_key');

            if (openaiKey) {
                newEngines.push({ id: 'llm-openai', name: 'OpenAI (GPT-4o)', icon: Sparkles, description: t.engines.description.openai });
            }
            if (anthropicKey) {
                newEngines.push({ id: 'llm-anthropic', name: 'Claude 3.5 Sonnet', icon: Sparkles, description: t.engines.description.anthropic });
            }
            if (geminiKey) {
                newEngines.push({ id: 'llm-gemini', name: 'Gemini 2.0 Flash', icon: Sparkles, description: t.engines.description.gemini });
            }

            setAvailableEngines(newEngines);
        };

        updateEngines();
        updateEngines();
        window.addEventListener('focus', updateEngines);
        // Listen for internal settings updates
        window.addEventListener('settings-updated', updateEngines);

        return () => {
            window.removeEventListener('focus', updateEngines);
            window.removeEventListener('settings-updated', updateEngines);
        };
    }, [selectedEngine, t.engines]); // selectedEngine dependence to handle fallback properly

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
            console.error('Failed to copy:', err);
        }
    };

    useEffect(() => {
        const handleOcrResult = (_event: any, result: any) => {
            if (result.text && result.text.startsWith && result.text.startsWith('ERROR:')) {
                // Ideally show a toast
                console.error(result.text);
            } else {
                setSourceText(result.text || '');
            }
        };

        const handleSmartTranslate = (_event: any, text: string) => {
            if (text) {
                setSourceText(text);
                // Optional: trigger immediate translation is handled by debounce or we can force it
                // setSourceText will trigger the debounce effect
            }
        };

        window.ipcRenderer?.on('ocr-result', handleOcrResult);
        window.ipcRenderer?.on('smart-translate', handleSmartTranslate);

        return () => {
            window.ipcRenderer?.off('ocr-result', handleOcrResult);
            window.ipcRenderer?.off('smart-translate', handleSmartTranslate);
        };
    }, []);

    // Auto-translate with debounce
    useEffect(() => {
        if (!sourceText || sourceText.trim() === '') return;

        const timer = setTimeout(() => {
            handleTranslate();
        }, 1000);

        return () => clearTimeout(timer);
    }, [sourceText, selectedEngine, targetLang, sourceLang]);

    const handleTranslate = async (overrideSourceText?: string) => {
        setIsTranslating(true);
        const textToTranslate = typeof overrideSourceText === 'string' ? overrideSourceText : sourceText;

        try {
            if (!window.ipcRenderer) {
                setTimeout(() => {
                    setTargetText(`[Mock ${selectedEngine}] ${textToTranslate}`);
                    setIsTranslating(false);
                }, 800);
                return;
            }

            // Smart Language Switching
            const detected = detectLanguage(textToTranslate);
            let currentSource = sourceLang;
            let currentTarget = targetLang;

            if (detected !== 'other') {
                // If detected lang matches current target, swap!
                if (detected === targetLang) {
                    currentSource = targetLang;
                    currentTarget = sourceLang === 'auto' ? 'en' : sourceLang; // Default to EN if auto was source

                    setSourceLang(currentSource);
                    setTargetLang(currentTarget);
                }
            }

            const apiKeys = {
                openai: localStorage.getItem('openai_api_key') || undefined,
                anthropic: localStorage.getItem('anthropic_api_key') || undefined,
                gemini: localStorage.getItem('gemini_api_key') || undefined,
            };

            const result = await window.ipcRenderer.invoke('translate-request', textToTranslate, {
                engine: selectedEngine,
                source: currentSource,
                target: currentTarget,
                apiKeys,
            });

            setTargetText(result.text || t.translation.translationFailed);
        } catch (error) {
            setTargetText(t.translation.errorOccurred);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleOCR = async () => {
        if (!window.ipcRenderer) {
            alert(t.translation.ipcRendererNotFound);
            return;
        }
        window.ipcRenderer.send('start-capture');
    };

    const swapLanguages = () => {
        if (sourceLang === 'auto') return;
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
        setSourceText(targetText);
        setTargetText(sourceText);
    };

    return (
        <div className="min-h-screen flex flex-col p-6 font-display overflow-hidden relative">
            <header className="flex items-center justify-between mb-8 animate-fade-in">
                <div className="flex items-center gap-3 group">
                    <div className="size-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                        <img src="icon.png" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">Nexus Translate</h1>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold tracking-wider border border-blue-500/20">{t.translation.beta}</span>
                        </div>
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
                </div>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 animate-fade-up max-w-7xl mx-auto w-full">
                {/* Source Panel */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                        <select
                            className="bg-transparent text-sm font-medium text-slate-300 hover:text-white focus:outline-none cursor-pointer transition-colors"
                            value={sourceLang}
                            onChange={(e) => setSourceLang(e.target.value)}
                        >
                            {languages.map(l => (
                                <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="glass flex-1 rounded-3xl p-6 relative group transition-all duration-300 hover:bg-slate-900/60 hover:shadow-blue-900/20 focus-within:ring-1 focus-within:ring-blue-500/50">
                        <Textarea
                            placeholder={t.translation.placeholder}
                            className="w-full h-full resize-none border-0 bg-transparent text-xl p-0 leading-relaxed font-light text-slate-100 placeholder:text-slate-600 focus-visible:ring-0 selection:bg-blue-500/30 pb-12"
                            value={sourceText}
                            onChange={(e) => setSourceText(e.target.value)}
                        />

                        <div className="absolute bottom-4 right-4 flex items-center gap-3">
                            <span className="text-xs text-slate-600 font-mono mr-2">{sourceText.length} {t.translation.chars}</span>

                            <div className="flex bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 gap-1 border border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleCopy(sourceText, true)}
                                    className="h-10 w-10 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
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
                                    <ScanText className="size-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Target Panel */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
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
                            <select
                                className="bg-transparent text-sm font-medium text-blue-400 hover:text-blue-300 focus:outline-none cursor-pointer transition-colors"
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                            >
                                {languages.filter(l => l.code !== 'auto').map(l => (
                                    <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="glass-card flex-1 rounded-3xl p-6 relative flex flex-col group transition-all duration-300 hover:bg-card/40 hover:shadow-indigo-900/20">
                        <div className="flex-1 text-xl leading-relaxed whitespace-pre-wrap font-light text-slate-50 overflow-y-auto selection:bg-indigo-500/30 pb-16">
                            {targetText ? (
                                targetText
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                                    <Sparkles className="size-12 stroke-1" />
                                    <span className="text-sm font-medium">{t.translation.ready}</span>
                                </div>
                            )}
                        </div>

                        {/* Bottom Right Actions for Target */}
                        <div className="absolute bottom-4 right-4 flex items-center gap-3">
                            {targetText && (
                                <div className="flex bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleCopy(targetText, false)}
                                        className="h-10 w-10 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
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
