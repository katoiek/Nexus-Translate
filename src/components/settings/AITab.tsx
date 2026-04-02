import { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles, Cpu } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useLanguage } from '../../contexts/LanguageContext';
import { logger } from '../../lib/logger';

type ModelStatus = 'idle' | 'loading' | 'success' | 'error';

interface AITabProps {
    onSaved: () => void;
}

export function AITab({ onSaved }: AITabProps) {
    const { t } = useLanguage();

    const [openAIKey, setOpenAIKey] = useState('');
    const [openAIModel, setOpenAIModel] = useState('');
    const [openAIModelStatus, setOpenAIModelStatus] = useState<ModelStatus>('idle');

    const [anthropicKey, setAnthropicKey] = useState('');
    const [anthropicModel, setAnthropicModel] = useState('');
    const [anthropicModelStatus, setAnthropicModelStatus] = useState<ModelStatus>('idle');

    const [geminiKey, setGeminiKey] = useState('');
    const [geminiModel, setGeminiModel] = useState('');
    const [geminiModelStatus, setGeminiModelStatus] = useState<ModelStatus>('idle');

    // 初期値ロード
    useEffect(() => {
        setOpenAIKey(localStorage.getItem('openai_api_key') || '');
        setOpenAIModel(localStorage.getItem('openai_model') || '');
        setAnthropicKey(localStorage.getItem('anthropic_api_key') || '');
        setAnthropicModel(localStorage.getItem('anthropic_model') || '');
        setGeminiKey(localStorage.getItem('gemini_api_key') || '');
        setGeminiModel(localStorage.getItem('gemini_model') || '');
    }, []);

    // OpenAI キー変更時の自動保存
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const storedKey = localStorage.getItem('openai_api_key') || '';
            if (openAIKey !== storedKey) {
                localStorage.setItem('openai_api_key', openAIKey);
                if (openAIKey) {
                    fetchOpenAIModels(openAIKey);
                    onSaved();
                    window.dispatchEvent(new CustomEvent('settings-updated'));
                } else {
                    setOpenAIModel('');
                    localStorage.removeItem('openai_model');
                    setOpenAIModelStatus('idle');
                }
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [openAIKey]);

    // OpenAI の初期モデル取得
    useEffect(() => {
        const key = localStorage.getItem('openai_api_key');
        if (key && !openAIModel) {
            fetchOpenAIModels(key);
        }
    }, []);

    const fetchOpenAIModels = async (apiKey: string) => {
        setOpenAIModelStatus('loading');
        try {
            const response = await window.fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!response.ok) throw new Error('Failed to fetch models');

            const data = await response.json();
            const modelIds = data.data.map((m: { id: string }) => m.id);
            const priorities = ['gpt-4o', 'chatgpt-4o-latest', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'];
            let selectedModel = 'gpt-4o';
            for (const p of priorities) {
                if (modelIds.includes(p)) { selectedModel = p; break; }
            }
            setOpenAIModel(selectedModel);
            localStorage.setItem('openai_model', selectedModel);
            setOpenAIModelStatus('success');
        } catch (error) {
            logger.error('Error fetching OpenAI models:', error);
            setOpenAIModelStatus('error');
        }
    };

    // Anthropic キー変更時の自動保存
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const storedKey = localStorage.getItem('anthropic_api_key') || '';
            if (anthropicKey !== storedKey) {
                localStorage.setItem('anthropic_api_key', anthropicKey);
                if (anthropicKey) {
                    fetchAnthropicModels(anthropicKey);
                    onSaved();
                    window.dispatchEvent(new CustomEvent('settings-updated'));
                } else {
                    setAnthropicModel('');
                    localStorage.removeItem('anthropic_model');
                    setAnthropicModelStatus('idle');
                }
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [anthropicKey]);

    // Anthropic の初期モデル取得
    useEffect(() => {
        const key = localStorage.getItem('anthropic_api_key');
        if (key && !anthropicModel) {
            fetchAnthropicModels(key);
        }
    }, []);

    const fetchAnthropicModels = async (apiKey: string) => {
        setAnthropicModelStatus('loading');
        try {
            const response = await window.fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    logger.log('Anthropic /v1/models not available, using fallback list');
                    const fallback = 'claude-3-7-sonnet-20250219';
                    setAnthropicModel(fallback);
                    localStorage.setItem('anthropic_model', fallback);
                    setAnthropicModelStatus('success');
                    return;
                }
                throw new Error('Failed to fetch models');
            }

            const data = await response.json();
            const modelIds = data.data?.map((m: { id: string }) => m.id) || [];
            const priorities = [
                'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-sonnet-4-5-20250929',
                'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'
            ];
            let selectedModel = priorities[0];
            for (const p of priorities) {
                if (modelIds.includes(p)) { selectedModel = p; break; }
            }
            setAnthropicModel(selectedModel);
            localStorage.setItem('anthropic_model', selectedModel);
            setAnthropicModelStatus('success');
        } catch (error) {
            logger.error('Error fetching Anthropic models:', error);
            setAnthropicModelStatus('error');
        }
    };

    // Gemini キー変更時の自動保存
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const storedKey = localStorage.getItem('gemini_api_key') || '';
            if (geminiKey !== storedKey) {
                localStorage.setItem('gemini_api_key', geminiKey);
                if (geminiKey) {
                    fetchGeminiModels(geminiKey);
                    onSaved();
                    window.dispatchEvent(new CustomEvent('settings-updated'));
                } else {
                    setGeminiModel('');
                    localStorage.removeItem('gemini_model');
                    setGeminiModelStatus('idle');
                }
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [geminiKey]);

    // Gemini の初期モデル取得
    useEffect(() => {
        const key = localStorage.getItem('gemini_api_key');
        if (key && !geminiModel) {
            fetchGeminiModels(key);
        }
    }, []);

    const fetchGeminiModels = async (apiKey: string) => {
        setGeminiModelStatus('loading');
        try {
            const response = await window.fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            );
            if (!response.ok) throw new Error('Failed to fetch models');

            const data = await response.json();
            const modelIds = data.models?.map((m: { name: string }) => m.name.replace('models/', '')) || [];
            const priorities = ['gemini-2.0-flash', 'gemini-2.0-flash-lite-preview-02-05', 'gemini-1.5-flash', 'gemini-1.5-pro'];
            let selectedModel = 'gemini-1.5-flash';
            for (const p of priorities) {
                if (modelIds.includes(p)) { selectedModel = p; break; }
            }
            setGeminiModel(selectedModel);
            localStorage.setItem('gemini_model', selectedModel);
            setGeminiModelStatus('success');
        } catch (error) {
            logger.error('Error fetching Gemini models:', error);
            setGeminiModelStatus('error');
        }
    };

    const ModelStatusBadge = ({ status, model }: { status: ModelStatus; model: string }) => (
        <div className="flex items-center gap-3 bg-slate-950/30 border border-white/5 rounded-xl p-3">
            <Cpu className={`size-4 ${status === 'success' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-slate-500'}`} />
            <div className="flex-1 text-sm font-medium text-slate-200">
                {status === 'loading' ? 'Detecting available models...' :
                    status === 'error' ? 'Failed to fetch models (check API key)' :
                        model || 'Enter API key to auto-detect'}
            </div>
            {status === 'success' && (
                <div className="text-[10px] uppercase font-bold text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded-full">Active</div>
            )}
        </div>
    );

    return (
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
                {/* OpenAI */}
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
                    <ModelStatusBadge status={openAIModelStatus} model={openAIModel} />
                    <p className="text-xs text-slate-500 ml-1">Automatically selected latest compatible model</p>
                </div>

                {/* Anthropic */}
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
                    <ModelStatusBadge status={anthropicModelStatus} model={anthropicModel} />
                    <p className="text-xs text-slate-500 ml-1">Automatically selected latest compatible model</p>
                </div>

                {/* Gemini */}
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
                    <ModelStatusBadge status={geminiModelStatus} model={geminiModel} />
                    <p className="text-xs text-slate-500 ml-1">Automatically selected latest compatible model</p>
                </div>
            </div>
        </div>
    );
}
