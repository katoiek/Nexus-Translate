import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Save, Key, ShieldCheck, Sparkles, Monitor, Power, Settings as SettingsIcon, Cpu, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsViewProps {
    onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
    const { t, language, setLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'languages'>('general');

    const [openAIKey, setOpenAIKey] = useState('');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');

    // New Settings
    const [launchAtLogin, setLaunchAtLogin] = useState(false);
    const [closeBehavior, setCloseBehavior] = useState('ask'); // 'ask' | 'quit' | 'minimize'

    const [savedMessage, setSavedMessage] = useState('');

    useEffect(() => {
        setOpenAIKey(localStorage.getItem('openai_api_key') || '');
        setAnthropicKey(localStorage.getItem('anthropic_api_key') || '');
        setGeminiKey(localStorage.getItem('gemini_api_key') || '');

        // Fetch Main Process Settings
        const loadSettings = async () => {
            // @ts-ignore
            if (window.ipcRenderer) {
                // @ts-ignore
                const settings = await window.ipcRenderer.invoke('get-settings');
                if (settings) {
                    setLaunchAtLogin(!!settings.launchAtLogin);
                    setCloseBehavior(settings.closeBehavior || 'ask');
                }
            }
        };
        loadSettings();
    }, []);

    const handleSave = () => {
        localStorage.setItem('openai_api_key', openAIKey);
        localStorage.setItem('anthropic_api_key', anthropicKey);
        localStorage.setItem('gemini_api_key', geminiKey);

        setSavedMessage(t.common.saved);
        setTimeout(() => setSavedMessage(''), 3000);
    };

    const handleSettingChange = (key: string, value: any) => {
        // @ts-ignore
        if (window.ipcRenderer) {
            // @ts-ignore
            window.ipcRenderer.invoke('set-setting', key, value);
        }
        if (key === 'launchAtLogin') setLaunchAtLogin(value);
        if (key === 'closeBehavior') setCloseBehavior(value);
    };

    return (
        <div className="min-h-screen flex flex-col p-4 font-display bg-slate-950 text-slate-100 overflow-hidden">
            <header className="flex items-center gap-4 mb-4 px-2">
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                    <ArrowLeft className="size-6" />
                </Button>
                <h1 className="text-xl font-bold">{t.settings.title}</h1>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Sidebar */}
                <aside className="col-span-3 bg-slate-900/50 rounded-2xl border border-white/5 p-4 flex flex-col gap-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-3">Preferences</div>

                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'general' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <SettingsIcon className="size-4" />
                        {t.settings.categories.general}
                    </button>

                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'ai' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <Cpu className="size-4" />
                        {t.settings.categories.externalAi}
                    </button>

                    <button
                        onClick={() => setActiveTab('languages')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'languages' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <Globe className="size-4" />
                        {t.settings.categories.languages}
                    </button>

                    <div className="mt-auto pt-4 border-t border-white/5">
                        <Button
                            onClick={handleSave}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white gap-2"
                        >
                            <Save className="size-4" />
                            {t.common.save}
                        </Button>
                        <div className={`text-center mt-2 text-xs font-medium text-green-400 transition-opacity duration-300 ${savedMessage ? 'opacity-100' : 'opacity-0'}`}>
                            {savedMessage || 'Changes saved'}
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <main className="col-span-9 bg-slate-900/30 rounded-2xl border border-white/5 p-8 overflow-y-auto custom-scrollbar">

                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <SettingsIcon className="size-5 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{t.settings.general.title}</h2>
                                    <p className="text-sm text-slate-400">{t.settings.general.description}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Monitor className="size-4" /> {t.settings.general.startup.title}
                                    </h3>
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950/50 border border-white/5">
                                        <input
                                            type="checkbox"
                                            id="launchAtLogin"
                                            checked={launchAtLogin}
                                            onChange={(e) => handleSettingChange('launchAtLogin', e.target.checked)}
                                            className="size-5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/50 cursor-pointer"
                                        />
                                        <label htmlFor="launchAtLogin" className="text-slate-200 font-medium cursor-pointer select-none">
                                            {t.settings.general.startup.label}
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Power className="size-4" /> {t.settings.general.window.title}
                                    </h3>

                                    <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 space-y-4">
                                        <p className="text-sm text-slate-400 mb-2">{t.settings.general.window.description}</p>

                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="closeBehavior"
                                                    id="cb_minimize"
                                                    value="minimize"
                                                    checked={closeBehavior === 'minimize'}
                                                    onChange={(e) => handleSettingChange('closeBehavior', e.target.value)}
                                                    className="size-4 text-blue-500 bg-slate-900 border-slate-700 focus:ring-blue-500/50 cursor-pointer"
                                                />
                                                <label htmlFor="cb_minimize" className="text-slate-300 cursor-pointer select-none">
                                                    {t.settings.general.window.minimize.label}
                                                    <span className="block text-xs text-slate-500 ml-0 mt-0.5">{t.settings.general.window.minimize.desc}</span>
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="closeBehavior"
                                                    id="cb_quit"
                                                    value="quit"
                                                    checked={closeBehavior === 'quit'}
                                                    onChange={(e) => handleSettingChange('closeBehavior', e.target.value)}
                                                    className="size-4 text-blue-500 bg-slate-900 border-slate-700 focus:ring-blue-500/50 cursor-pointer"
                                                />
                                                <label htmlFor="cb_quit" className="text-slate-300 cursor-pointer select-none">
                                                    {t.settings.general.window.quit.label}
                                                    <span className="block text-xs text-slate-500 ml-0 mt-0.5">{t.settings.general.window.quit.desc}</span>
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="closeBehavior"
                                                    id="cb_ask"
                                                    value="ask"
                                                    checked={closeBehavior === 'ask'}
                                                    onChange={(e) => handleSettingChange('closeBehavior', e.target.value)}
                                                    className="size-4 text-blue-500 bg-slate-900 border-slate-700 focus:ring-blue-500/50 cursor-pointer"
                                                />
                                                <label htmlFor="cb_ask" className="text-slate-300 cursor-pointer select-none">
                                                    {t.settings.general.window.ask.label}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                    <Cpu className="size-5 text-violet-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{t.settings.externalAi.title}</h2>
                                    <p className="text-sm text-slate-400">{t.settings.externalAi.description}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2 group">
                                    <Label htmlFor="openai" className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.settings.externalAi.openai.label}</Label>
                                    <div className="relative">
                                        <Input
                                            id="openai"
                                            type="password"
                                            placeholder="sk-..."
                                            className="bg-slate-950/50 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 h-11 rounded-xl pl-10"
                                            value={openAIKey}
                                            onChange={(e) => setOpenAIKey(e.target.value)}
                                        />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            <ShieldCheck className="size-4" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">{t.settings.externalAi.openai.desc}</p>
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="anthropic" className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.settings.externalAi.anthropic.label}</Label>
                                    <div className="relative">
                                        <Input
                                            id="anthropic"
                                            type="password"
                                            placeholder="sk-ant-..."
                                            className="bg-slate-950/50 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 focus:bg-slate-900/80 focus:ring-4 focus:ring-violet-500/10 transition-all duration-300 h-11 rounded-xl pl-10"
                                            value={anthropicKey}
                                            onChange={(e) => setAnthropicKey(e.target.value)}
                                        />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            <ShieldCheck className="size-4" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">{t.settings.externalAi.anthropic.desc}</p>
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="gemini" className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.settings.externalAi.gemini.label}</Label>
                                    <div className="relative">
                                        <Input
                                            id="gemini"
                                            type="password"
                                            placeholder="AIza..."
                                            className="bg-slate-950/50 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-teal-500/50 focus:bg-slate-900/80 focus:ring-4 focus:ring-teal-500/10 transition-all duration-300 h-11 rounded-xl pl-10"
                                            value={geminiKey}
                                            onChange={(e) => setGeminiKey(e.target.value)}
                                        />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            <Sparkles className="size-4" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">{t.settings.externalAi.gemini.desc}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'languages' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                    <Globe className="size-5 text-teal-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{t.settings.languages.title}</h2>
                                    <p className="text-sm text-slate-400">{t.settings.languages.description}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2 group">
                                    <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.settings.languages.selectLabel}</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setLanguage('en')}
                                            className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${language === 'en'
                                                ? 'bg-blue-600/10 border-blue-500/50 ring-2 ring-blue-500/20'
                                                : 'bg-slate-950/50 border-white/5 hover:bg-slate-900/50'}`}
                                        >
                                            <div className={`size-4 rounded-full border flex items-center justify-center ${language === 'en' ? 'border-blue-500' : 'border-slate-500'}`}>
                                                {language === 'en' && <div className="size-2 rounded-full bg-blue-500" />}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-medium text-white">English</div>
                                                <div className="text-xs text-slate-500">English</div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setLanguage('ja')}
                                            className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${language === 'ja'
                                                ? 'bg-blue-600/10 border-blue-500/50 ring-2 ring-blue-500/20'
                                                : 'bg-slate-950/50 border-white/5 hover:bg-slate-900/50'}`}
                                        >
                                            <div className={`size-4 rounded-full border flex items-center justify-center ${language === 'ja' ? 'border-blue-500' : 'border-slate-500'}`}>
                                                {language === 'ja' && <div className="size-2 rounded-full bg-blue-500" />}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-medium text-white">日本語</div>
                                                <div className="text-xs text-slate-500">Japanese</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
