import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { ArrowRightLeft, Languages, Sparkles, Monitor, Globe, ScanText, Settings, Copy, Check } from 'lucide-react';

const engines = [
    { id: 'google-free', name: 'Google Translate', icon: Globe, description: 'Quick & Free' },
    { id: 'native', name: 'System Local', icon: Monitor, description: 'Privacy Focused' },
    { id: 'llm', name: 'AI Model', icon: Sparkles, description: 'High Accuracy' },
];

const LANGUAGES = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ko', name: 'Korean' },
];

interface TranslationViewProps {
    onNavigateToSettings?: () => void;
}

export function TranslationView({ onNavigateToSettings }: TranslationViewProps) {
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [selectedEngine, setSelectedEngine] = useState(engines[0].id);
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('ja');
    const [isTranslating, setIsTranslating] = useState(false);
    const [copiedSource, setCopiedSource] = useState(false);
    const [copiedTarget, setCopiedTarget] = useState(false);

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

        window.ipcRenderer?.on('ocr-result', handleOcrResult);

        return () => {
            window.ipcRenderer?.off('ocr-result', handleOcrResult);
        };
    }, []);

    const handleTranslate = async () => {
        setIsTranslating(true);
        try {
            if (!window.ipcRenderer) {
                setTimeout(() => {
                    setTargetText(`[Mock ${selectedEngine}] ${sourceText}`);
                    setIsTranslating(false);
                }, 800);
                return;
            }

            const apiKeys = {
                openai: localStorage.getItem('openai_api_key') || undefined,
                anthropic: localStorage.getItem('anthropic_api_key') || undefined,
                gemini: localStorage.getItem('gemini_api_key') || undefined,
            };

            const result = await window.ipcRenderer.invoke('translate-request', sourceText, {
                engine: selectedEngine,
                source: sourceLang,
                target: targetLang,
                apiKeys,
            });

            setTargetText(result.text || 'Translation failed');
        } catch (error) {
            setTargetText('Error occurred during translation.');
        } finally {
            setIsTranslating(false);
        }
    };

    const handleOCR = async () => {
        if (!window.ipcRenderer) {
            alert('IPC Renderer not found.');
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
                    <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                        <Languages className="text-white size-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">Nexus Translate</h1>
                        <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">AI-Powered Localization</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex bg-slate-900/50 border border-white/10 rounded-full p-1 backdrop-blur-md">
                        {engines.map(e => {
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
                                </button>
                            );
                        })}
                    </div>

                    {/* Mobile/Fallback Select for smaller screens (optional, simply hiding for now as per premium design focus) */}

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
                            {LANGUAGES.map(l => (
                                <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>
                            ))}
                        </select>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleCopy(sourceText, true)} className="h-8 w-8 rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                                {copiedSource ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOCR}
                                className="h-8 gap-2 rounded-full border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50 transition-all font-medium"
                            >
                                <ScanText className="size-4" />
                                <span className="text-xs">OCR</span>
                            </Button>
                        </div>
                    </div>

                    <div className="glass flex-1 rounded-3xl p-6 relative group transition-all duration-300 hover:bg-slate-900/60 hover:shadow-blue-900/20 focus-within:ring-1 focus-within:ring-blue-500/50">
                        <Textarea
                            placeholder="Type or paste text here..."
                            className="w-full h-full resize-none border-0 bg-transparent text-xl p-0 leading-relaxed font-light text-slate-100 placeholder:text-slate-600 focus-visible:ring-0 selection:bg-blue-500/30"
                            value={sourceText}
                            onChange={(e) => setSourceText(e.target.value)}
                        />
                        {/* Subtle corner accent */}
                        <div className="absolute bottom-6 right-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-slate-600 font-mono">{sourceText.length} chars</span>
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
                                {LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                                    <option key={l.code} value={l.code} className="bg-slate-900">{l.name}</option>
                                ))}
                            </select>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(targetText, false)} className="h-8 w-8 rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                            {copiedTarget ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
                        </Button>
                    </div>

                    <div className="glass-card flex-1 rounded-3xl p-6 relative flex flex-col group transition-all duration-300 hover:bg-card/40 hover:shadow-indigo-900/20">
                        <div className="flex-1 text-xl leading-relaxed whitespace-pre-wrap font-light text-slate-50 overflow-y-auto selection:bg-indigo-500/30">
                            {targetText ? (
                                targetText
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                                    <Sparkles className="size-12 stroke-1" />
                                    <span className="text-sm font-medium">Ready to translate</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button
                                onClick={handleTranslate}
                                disabled={isTranslating}
                                size="lg"
                                className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 rounded-full px-8 h-12 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100 group/btn"
                            >
                                <span className={`flex items-center gap-2 relative z-10 ${isTranslating ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
                                    Translate <ArrowRightLeft className="size-4" />
                                </span>
                                {isTranslating && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 rounded-full" />
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
