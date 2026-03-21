import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, ShieldCheck, Sparkles, Monitor, Power, Settings as SettingsIcon, Cpu, Globe, Palette } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme, Theme } from '../contexts/ThemeContext';

interface SettingsViewProps {
    onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
    const { t, language, setLanguage } = useLanguage();
    const { theme, setTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'ai' | 'languages'>('general');


    const [openAIKey, setOpenAIKey] = useState('');
    const [openAIModel, setOpenAIModel] = useState('');
    const [openAIModelStatus, setOpenAIModelStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [anthropicModel, setAnthropicModel] = useState('');
    const [anthropicModelStatus, setAnthropicModelStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [geminiKey, setGeminiKey] = useState('');
    const [geminiModel, setGeminiModel] = useState('');
    const [geminiModelStatus, setGeminiModelStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // New Settings
    const [launchAtLogin, setLaunchAtLogin] = useState(false);
    const [closeBehavior, setCloseBehavior] = useState('ask'); // 'ask' | 'quit' | 'minimize'

    const [savedMessage, setSavedMessage] = useState('');

    // Load initial settings
    useEffect(() => {
        setOpenAIKey(localStorage.getItem('openai_api_key') || '');
        setOpenAIModel(localStorage.getItem('openai_model') || '');
        setAnthropicKey(localStorage.getItem('anthropic_api_key') || '');
        setAnthropicModel(localStorage.getItem('anthropic_model') || '');
        setGeminiKey(localStorage.getItem('gemini_api_key') || '');
        setGeminiModel(localStorage.getItem('gemini_model') || '');

        setLaunchAtLogin(false); // Not implemented yet in Tauri version
        setCloseBehavior(localStorage.getItem('closeBehavior') || 'ask');
    }, []);

    const showSavedMessage = () => {
        setSavedMessage(t.common.saved || 'Saved');
        setTimeout(() => setSavedMessage(''), 2000);
    };

    // Auto-save API Keys with debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const storedKey = localStorage.getItem('openai_api_key') || '';
            let saved = false;

            if (openAIKey !== storedKey) {
                localStorage.setItem('openai_api_key', openAIKey);
                saved = true;
                if (openAIKey) {
                    fetchOpenAIModels(openAIKey);
                } else {
                    setOpenAIModel('');
                    localStorage.removeItem('openai_model');
                    setOpenAIModelStatus('idle');
                }
            }

            if (saved && openAIKey) showSavedMessage();
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [openAIKey]);

    useEffect(() => {
        // Initial fetch if key exists but model doesn't, or just to verify
        const key = localStorage.getItem('openai_api_key');
        if (key && !openAIModel) {
            fetchOpenAIModels(key);
        }
    }, []);

    const fetchOpenAIModels = async (apiKey: string) => {
        setOpenAIModelStatus('loading');
        try {
            // Using standard fetch since we need to do this from frontend
            const response = await window.fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch models');
            }

            const data = await response.json();
            const modelIds = data.data.map((m: any) => m.id);
            
            // Priority list for translation
            const priorities = ['gpt-4o', 'chatgpt-4o-latest', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'];
            let selectedModel = 'gpt-4o'; // fallback

            for (const p of priorities) {
                if (modelIds.includes(p)) {
                    selectedModel = p;
                    break;
                }
            }

            setOpenAIModel(selectedModel);
            localStorage.setItem('openai_model', selectedModel);
            setOpenAIModelStatus('success');
            
        } catch (error) {
            console.error('Error fetching OpenAI models:', error);
            setOpenAIModelStatus('error');
            // Don't overwrite existing valid model on network error
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const storedKey = localStorage.getItem('anthropic_api_key') || '';
            const storedModel = localStorage.getItem('anthropic_model') || '';
            let saved = false;

            if (anthropicKey !== storedKey) {
                localStorage.setItem('anthropic_api_key', anthropicKey);
                saved = true;
                if (anthropicKey) {
                    fetchAnthropicModels(anthropicKey);
                } else {
                    setAnthropicModel('');
                    localStorage.removeItem('anthropic_model');
                    setAnthropicModelStatus('idle');
                }
            }
            if (anthropicModel !== storedModel) {
                localStorage.setItem('anthropic_model', anthropicModel);
                saved = true;
            }

            if (saved && (anthropicKey || anthropicModel)) showSavedMessage();
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [anthropicKey]); // Only trigger on key change to avoid loops

    useEffect(() => {
        // Initial fetch if key exists but model doesn't
        const key = localStorage.getItem('anthropic_api_key');
        if (key && !anthropicModel) {
            fetchAnthropicModels(key);
        }
    }, []);

    const fetchAnthropicModels = async (apiKey: string) => {
        setAnthropicModelStatus('loading');
        try {
            // Trying the new /v1/models endpoint
            const response = await window.fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Fallback: If /v1/models is not available, we use a probe or a known good list
                    console.log('Anthropic /v1/models not available, using fallback list');
                    const fallbacks = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
                    setAnthropicModel(fallbacks[0]);
                    localStorage.setItem('anthropic_model', fallbacks[0]);
                    setAnthropicModelStatus('success');
                    return;
                }
                throw new Error('Failed to fetch models');
            }

            const data = await response.json();
            // Assuming the schema is similar to OpenAI or standard Anthropic model list
            const modelIds = data.data?.map((m: any) => m.id) || [];
            
            const priorities = [
                'claude-sonnet-4-6',
                'claude-opus-4-6',
                'claude-opus-4-5-20251101',
                'claude-haiku-4-5-20251001',
                'claude-sonnet-4-5-20250929',
                'claude-3-7-sonnet-20250219',
                'claude-3-5-sonnet-20241022',
                'claude-3-5-haiku-20241022'
            ];
            
            let selectedModel = priorities[0];
            if (modelIds.length > 0) {
                for (const p of priorities) {
                    if (modelIds.includes(p)) {
                        selectedModel = p;
                        break;
                    }
                }
            }

            setAnthropicModel(selectedModel);
            localStorage.setItem('anthropic_model', selectedModel);
            setAnthropicModelStatus('success');
            
        } catch (error) {
            console.error('Error fetching Anthropic models:', error);
            setAnthropicModelStatus('error');
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const storedKey = localStorage.getItem('gemini_api_key') || '';
            const storedModel = localStorage.getItem('gemini_model') || '';
            let saved = false;

            if (geminiKey !== storedKey) {
                localStorage.setItem('gemini_api_key', geminiKey);
                saved = true;
                if (geminiKey) {
                    fetchGeminiModels(geminiKey);
                } else {
                    setGeminiModel('');
                    localStorage.removeItem('gemini_model');
                    setGeminiModelStatus('idle');
                }
            }
            if (geminiModel !== storedModel) {
                localStorage.setItem('gemini_model', geminiModel);
                saved = true;
            }

            if (saved && (geminiKey || geminiModel)) showSavedMessage();
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [geminiKey]);

    useEffect(() => {
        const key = localStorage.getItem('gemini_api_key');
        if (key && !geminiModel) {
            fetchGeminiModels(key);
        }
    }, []);

    const fetchGeminiModels = async (apiKey: string) => {
        setGeminiModelStatus('loading');
        try {
            const response = await window.fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

            if (!response.ok) {
                throw new Error('Failed to fetch models');
            }

            const data = await response.json();
            const modelIds = data.models?.map((m: any) => m.name.replace('models/', '')) || [];
            
            const priorities = [
                'gemini-2.0-flash',
                'gemini-2.0-flash-lite-preview-02-05',
                'gemini-1.5-flash',
                'gemini-1.5-flash-8b',
                'gemini-1.5-pro'
            ];
            
            let selectedModel = 'gemini-1.5-flash'; // Fallback
            if (modelIds.length > 0) {
                for (const p of priorities) {
                    if (modelIds.includes(p)) {
                        selectedModel = p;
                        break;
                    }
                }
            }

            setGeminiModel(selectedModel);
            localStorage.setItem('gemini_model', selectedModel);
            setGeminiModelStatus('success');
            
        } catch (error) {
            console.error('Error fetching Gemini models:', error);
            setGeminiModelStatus('error');
        }
    };


    const handleSettingChange = (key: string, value: any) => {
        if (key === 'launchAtLogin') {
            setLaunchAtLogin(value);
            // TODO: Implement autostart plugin logic
        }
        if (key === 'closeBehavior') {
            setCloseBehavior(value);
            localStorage.setItem('closeBehavior', value);
        }

        showSavedMessage();
    };

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        showSavedMessage();
    };

    const handleLanguageChange = (lang: 'en' | 'ja') => {
        setLanguage(lang);
        showSavedMessage();
    }


    return (
        <div className="h-screen flex flex-col p-4 font-display text-slate-100 overflow-hidden relative">

            <header className="flex items-center gap-4 mb-4 px-2 relative z-[50]">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                        <ArrowLeft className="size-6" />
                    </Button>
                    <h1 className="text-xl font-bold">{t.settings.title}</h1>
                </div>

                <div className={`ml-auto text-xs font-medium text-green-400 bg-green-500/10 px-3 py-1 rounded-full transition-opacity duration-300 pointer-events-none ${savedMessage ? 'opacity-100' : 'opacity-0'}`}>
                    {savedMessage}
                </div>

            </header>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 h-full">
                {/* Sidebar */}
                <aside className="col-span-3 bg-slate-900/50 rounded-2xl border border-white/5 p-4 flex flex-col gap-2 h-full overflow-y-auto custom-scrollbar">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-3">Preferences</div>

                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'general' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <SettingsIcon className="size-4" />
                        {t.settings.categories.general}
                    </button>

                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'appearance' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <Palette className="size-4" />
                        {t.settings.categories.appearance}
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
                </aside>

                {/* Content Area */}
                <main className="col-span-9 bg-slate-900/30 rounded-2xl border border-white/5 p-8 overflow-y-auto custom-scrollbar h-full">

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

                                {/* Appearance section removed from General */}
                            </div>
                        </div>
                    )}
                    {activeTab === 'appearance' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                    <Palette className="size-5 text-pink-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{t.settings.appearance.title}</h2>
                                    <p className="text-sm text-slate-400">{t.settings.appearance.description}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Palette className="size-4" /> {t.settings.appearance.theme.label}
                                    </h3>
                                    <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                                                {(['galaxy', 'emerald', 'sky', 'amethyst', 'ruby', 'midnight'] as Theme[]).map((tName) => (
                                                    <button
                                                        key={tName}
                                                        onClick={() => handleThemeChange(tName)}
                                                        className={`group relative p-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${theme === tName
                                                            ? 'bg-blue-600/10 border-blue-500/50 ring-2 ring-blue-500/20'
                                                            : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/50 hover:border-white/10'
                                                            }`}
                                                    >
                                                        <div className={`size-8 rounded-full shadow-lg ${tName === 'galaxy' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' :
                                                            tName === 'emerald' ? 'bg-gradient-to-br from-emerald-400 to-teal-600' :
                                                                tName === 'sky' ? 'bg-gradient-to-br from-sky-400 to-blue-600' :
                                                                    tName === 'amethyst' ? 'bg-gradient-to-br from-fuchsia-400 to-purple-600' :
                                                                        tName === 'ruby' ? 'bg-gradient-to-br from-rose-400 to-red-600' :
                                                                            'bg-gradient-to-br from-blue-700 to-indigo-900'
                                                            }`} />
                                                        <span className={`text-xs font-medium ${theme === tName ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                            {/* @ts-ignore */}
                                                            {t.settings.appearance.theme[tName]}
                                                        </span>
                                                    </button>
                                                ))}
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
                                    <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">Detected OpenAI Model</Label>
                                    <div className="flex items-center gap-3 bg-slate-950/30 border border-white/5 rounded-xl p-3">
                                        <Cpu className={`size-4 ${openAIModelStatus === 'success' ? 'text-green-400' : openAIModelStatus === 'error' ? 'text-red-400' : 'text-slate-500'}`} />
                                        <div className="flex-1 text-sm font-medium text-slate-200">
                                            {openAIModelStatus === 'loading' ? 'Detecting available models...' : 
                                             openAIModelStatus === 'error' ? 'Failed to fetch models (check API key)' :
                                             openAIModel ? openAIModel : 'Enter API key to auto-detect'}
                                        </div>
                                        {openAIModelStatus === 'success' && (
                                            <div className="text-[10px] uppercase font-bold text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded-full">Active</div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">Automatically selected latest compatible model</p>
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
                                    <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">Detected Anthropic Model</Label>
                                    <div className="flex items-center gap-3 bg-slate-950/30 border border-white/5 rounded-xl p-3">
                                        <Cpu className={`size-4 ${anthropicModelStatus === 'success' ? 'text-green-400' : anthropicModelStatus === 'error' ? 'text-red-400' : 'text-slate-500'}`} />
                                        <div className="flex-1 text-sm font-medium text-slate-200">
                                            {anthropicModelStatus === 'loading' ? 'Detecting available models...' : 
                                             anthropicModelStatus === 'error' ? 'Failed to fetch models (check API key)' :
                                             anthropicModel ? anthropicModel : 'Enter API key to auto-detect'}
                                        </div>
                                        {anthropicModelStatus === 'success' && (
                                            <div className="text-[10px] uppercase font-bold text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded-full">Active</div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">Automatically selected latest compatible model</p>
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

                                <div className="space-y-2 group">
                                    <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">Detected Gemini Model</Label>
                                    <div className="flex items-center gap-3 bg-slate-950/30 border border-white/5 rounded-xl p-3">
                                        <Sparkles className={`size-4 ${geminiModelStatus === 'success' ? 'text-green-400' : geminiModelStatus === 'error' ? 'text-red-400' : 'text-slate-500'}`} />
                                        <div className="flex-1 text-sm font-medium text-slate-200">
                                            {geminiModelStatus === 'loading' ? 'Detecting available models...' : 
                                             geminiModelStatus === 'error' ? 'Failed to fetch models (check API key)' :
                                             geminiModel ? geminiModel : 'Enter API key to auto-detect'}
                                        </div>
                                        {geminiModelStatus === 'success' && (
                                            <div className="text-[10px] uppercase font-bold text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded-full">Active</div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">Automatically selected latest compatible model</p>
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
                                            onClick={() => handleLanguageChange('en')}
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
                                            onClick={() => handleLanguageChange('ja')}
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
            </div >
        </div >
    );
}
