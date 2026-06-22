import { useState, useEffect, useCallback } from 'react';
import { Boxes, RefreshCw, Download, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useLanguage } from '../../contexts/LanguageContext';
import { ollamaService, OllamaState, RECOMMENDED_MODELS, PullProgress } from '../../services/OllamaService';
import { logger } from '../../lib/logger';

interface OllamaTabProps {
    onSaved: () => void;
}

export function OllamaTab({ onSaved }: OllamaTabProps) {
    const { t } = useLanguage();

    const [baseUrl, setBaseUrl] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [state, setState] = useState<OllamaState>({ status: 'not-running', models: [] });
    const [loading, setLoading] = useState(false);
    const [pulling, setPulling] = useState<string | null>(null);
    const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const next = await ollamaService.getState();
            setState(next);
        } catch (e) {
            logger.error('[OllamaTab] getState failed', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setBaseUrl(ollamaService.getBaseUrl());
        setSelectedModel(ollamaService.getSelectedModel());
        refresh();
    }, [refresh]);

    // URL 変更を保存（デバウンス）して再検出 / Save URL (debounced) and re-detect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (baseUrl !== ollamaService.getBaseUrl()) {
                ollamaService.setBaseUrl(baseUrl);
                refresh();
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [baseUrl, refresh]);

    const handleSelectModel = (model: string) => {
        setSelectedModel(model);
        ollamaService.setSelectedModel(model);
        onSaved();
        window.dispatchEvent(new CustomEvent('settings-updated'));
    };

    const handlePull = async (model: string) => {
        setPulling(model);
        setPullProgress(null);
        try {
            await ollamaService.pull(model, (p) => setPullProgress(p));
            await refresh();
            handleSelectModel(model);
        } catch (e) {
            logger.error('[OllamaTab] pull failed', e);
        } finally {
            setPulling(null);
            setPullProgress(null);
        }
    };

    const statusBadge = () => {
        if (state.status === 'running') {
            return { icon: CheckCircle2, color: 'text-green-400', text: t.settings.ollama.statusRunning };
        }
        if (state.status === 'no-models') {
            return { icon: AlertTriangle, color: 'text-amber-400', text: t.settings.ollama.statusNoModels };
        }
        return { icon: AlertTriangle, color: 'text-red-400', text: t.settings.ollama.statusNotRunning };
    };

    const badge = statusBadge();
    const BadgeIcon = badge.icon;

    const formatBytes = (n?: number) => {
        if (!n) return '';
        const gb = n / 1e9;
        return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`;
    };

    const pullPercent = pullProgress?.completed && pullProgress?.total
        ? Math.round((pullProgress.completed / pullProgress.total) * 100)
        : null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Boxes className="size-5 text-violet-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">{t.settings.ollama.title}</h2>
                    <p className="text-sm text-slate-400">{t.settings.ollama.description}</p>
                </div>
            </div>

            {/* 状態 / Status */}
            <div className="flex items-center gap-3 bg-slate-950/30 border border-white/5 rounded-xl p-3">
                <BadgeIcon className={`size-4 ${badge.color}`} />
                <div className="flex-1 text-sm font-medium text-slate-200">{badge.text}</div>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {t.settings.ollama.refresh}
                </button>
            </div>

            {/* 未接続ガイド / Not-running guide */}
            {state.status === 'not-running' && (
                <div className="space-y-3 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <p className="text-sm text-slate-300">{t.settings.ollama.notRunningHelp}</p>
                    <button
                        onClick={() => openUrl('https://ollama.com/download').catch(logger.error)}
                        className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
                    >
                        <ExternalLink className="size-3.5" />
                        {t.settings.ollama.installGuide}
                    </button>
                </div>
            )}

            {/* Server URL */}
            <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.settings.ollama.baseUrlLabel}</Label>
                <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="bg-slate-950/50 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 h-11 rounded-xl"
                />
            </div>

            {/* モデル選択 / Model selection */}
            {state.models.length > 0 && (
                <div className="space-y-2">
                    <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.settings.ollama.modelLabel}</Label>
                    <select
                        value={selectedModel}
                        onChange={(e) => handleSelectModel(e.target.value)}
                        className="w-full bg-slate-950/50 border border-white/10 text-slate-100 h-11 rounded-xl px-3 focus:border-violet-500/50 outline-none"
                    >
                        <option value="">{t.settings.ollama.modelPlaceholder}</option>
                        {state.models.map((m) => (
                            <option key={m.name} value={m.name}>
                                {m.name}{m.parameterSize ? ` · ${m.parameterSize}` : ''}{m.size ? ` · ${formatBytes(m.size)}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* 推奨モデル取得 / Pull recommended models */}
            <div className="space-y-3">
                <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.settings.ollama.recommended}</Label>
                {state.status === 'no-models' && (
                    <p className="text-xs text-amber-400/80 ml-1">{t.settings.ollama.noModelsHelp}</p>
                )}
                <div className="flex flex-col gap-2">
                    {RECOMMENDED_MODELS.map((model) => {
                        const installed = state.models.some((m) => m.name === model || m.name.startsWith(model.split(':')[0] + ':'));
                        const isPulling = pulling === model;
                        return (
                            <div key={model} className="flex items-center gap-3 bg-slate-950/30 border border-white/5 rounded-xl p-3">
                                <Boxes className="size-4 text-slate-500" />
                                <div className="flex-1 text-sm font-medium text-slate-200">{model}</div>
                                {isPulling ? (
                                    <span className="text-xs text-violet-300">
                                        {t.settings.ollama.pulling}{pullPercent !== null ? ` ${pullPercent}%` : ''}
                                    </span>
                                ) : installed ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                        <CheckCircle2 className="size-3.5" />{t.settings.ollama.pullDone}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handlePull(model)}
                                        disabled={!!pulling}
                                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <Download className="size-3.5" />{t.settings.ollama.pull}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
