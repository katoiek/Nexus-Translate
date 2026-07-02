import { useState, useEffect, useRef } from 'react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { Button } from './ui/button';
import { Settings, Wand2, ListPlus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { detectLanguage } from '../lib/languageUtils';
import { useTranslationEngines } from '../hooks/useTranslationEngines';
import { usePersistedState } from '../hooks/usePersistedState';
import { translationService } from '../services/TranslationService';
import { loadGlossary } from '../lib/glossary';
import { getApiKeys, STORAGE_KEYS } from '../lib/settings';
import { buildRephraseSystemPrompt, buildAlternativesSystemPrompt, Tone } from '../lib/translationPrompt';
import { logger } from '../lib/logger';
import { EngineSelector } from './translation/EngineSelector';
import { SourcePanel } from './translation/SourcePanel';
import { TargetPanel } from './translation/TargetPanel';
import { AIResultModal } from './translation/AIResultModal';

interface TranslationViewProps {
    onNavigateToSettings?: () => void;
    onRequestScreenshot?: () => void;
}

export function TranslationView({ onNavigateToSettings, onRequestScreenshot }: TranslationViewProps) {
    const { t } = useLanguage();
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    // エンジン・言語・トーンの選択は前回の状態を localStorage から復元・保存する
    // / Engine / language / tone selections are persisted to and restored from localStorage
    const [selectedEngine, setSelectedEngine] = usePersistedState<string>(STORAGE_KEYS.selectedEngine, 'offline');
    const availableEngines = useTranslationEngines();
    const [sourceLang, setSourceLang] = usePersistedState<string>(STORAGE_KEYS.sourceLang, 'auto');
    const [targetLang, setTargetLang] = usePersistedState<string>(STORAGE_KEYS.targetLang, 'jpn_Jpan');
    // 自動検出モード中に入力テキストから判定した言語（セレクター表示用）。
    // モード自体は 'auto' のまま維持し、言語設定は変更しない
    // / Language detected from the input text while in auto-detect mode (selector display only).
    //   The mode itself stays 'auto'; the persisted language settings are never changed.
    const detectedSourceLang = sourceLang === 'auto' ? detectLanguage(sourceText) : null;
    const [tone, setTone] = usePersistedState<Tone>(STORAGE_KEYS.aiTone, 'default');
    const [copiedSource, setCopiedSource] = useState(false);
    const [copiedTarget, setCopiedTarget] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [fallbackNotice, setFallbackNotice] = useState('');
    // AI アクション（言い換え/代替案）の結果モーダル / AI action (rephrase/alternatives) result modal
    const [aiOpen, setAiOpen] = useState(false);
    const [aiResult, setAiResult] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    // 進行中ストリームの識別用。古いストリームの書き込みを無視する
    // / Identifies the in-flight stream so stale chunks are ignored
    const translationIdRef = useRef(0);

    const isLLMEngine = !!availableEngines.find((e) => e.id === selectedEngine)?.isLLM;

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
        // 取り込んだテキストをそのままセットする。言語設定（入力・出力とも）は前回の選択を
        // 固定で使い、自動検出モードなら表示側で検出結果を反映する
        // / Just set the captured text. Language settings (both source and target) keep the
        //   previous selections; in auto-detect mode the detected language shows in the selector.
        const handleSmartTranslateTrigger = async () => {
            try {
                const text = await readText();
                if (text && text.trim().length > 0) {
                    setSourceText(text);
                }
            } catch {
                // Ignore error if clipboard content is not text (e.g., images)
                logger.log('Clipboard is empty or contains non-text content, ignoring trigger.');
            }
        };

        const handleOCRResult = (e: Event) => {
            const detail = (e as CustomEvent<string>).detail;
            if (detail) {
                setSourceText(detail);
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
        }, 600);

        return () => clearTimeout(timer);
    }, [sourceText, selectedEngine, targetLang, sourceLang, tone]);

    const handleTranslate = async (overrideSourceText?: string) => {
        const textToTranslate = typeof overrideSourceText === 'string' ? overrideSourceText : sourceText;

        if (!textToTranslate.trim()) {
            setTargetText('');
            return;
        }

        // 入力(元)側のみ自動判定する。出力(先)は常にユーザーが選択した言語（前回の設定）を使う
        // / Auto-detect the source (input) side only; the target (output) always uses the
        //   user's selected (last persisted) language
        const detected = detectLanguage(textToTranslate);
        let currentSource = sourceLang === 'auto' ? detected : sourceLang;
        const currentTarget = targetLang;

        if (currentSource === 'auto') {
            currentSource = 'eng_Latn';
        }

        const apiKeys = getApiKeys();

        // 新しいストリームを開始 / Begin a new stream
        const streamId = ++translationIdRef.current;
        setFallbackNotice('');
        let streamed = '';
        const onChunk = (delta: string) => {
            if (translationIdRef.current !== streamId) return; // 古いストリームは無視
            streamed += delta;
            setTargetText(streamed);
        };

        // AI 機能（トーン/用語集）は LLM エンジンのみ適用 / AI features apply to LLM engines only
        const aiOptions = isLLMEngine
            ? { tone, glossary: loadGlossary() }
            : {};

        try {
            const result = await translationService.translate(textToTranslate, {
                engine: selectedEngine,
                source: currentSource,
                target: currentTarget,
                apiKeys,
                onChunk,
                ...aiOptions,
            });
            if (translationIdRef.current === streamId) {
                setTargetText(result.text || t.translation.translationFailed);
            }
        } catch (error: unknown) {
            logger.error('[TranslationView] Translation Failed Detail:', error);

            // Ollama 失敗時は同梱 NLLB へ自動フォールバック / Auto-fallback to bundled NLLB on Ollama failure
            if (selectedEngine === 'ollama') {
                try {
                    setFallbackNotice(t.translation.ollamaFallback);
                    const fb = await translationService.translate(textToTranslate, {
                        engine: 'offline',
                        source: currentSource,
                        target: currentTarget,
                    });
                    if (translationIdRef.current === streamId) {
                        setTargetText(fb.text || t.translation.translationFailed);
                    }
                    return;
                } catch (fbError) {
                    logger.error('[TranslationView] Fallback failed:', fbError);
                }
            }

            if (translationIdRef.current === streamId) {
                const message = error instanceof Error ? error.message : String(error);
                setTargetText(message || t.translation.errorOccurred);
            }
        }
    };

    // 言い換え: 訳文を同じ言語でより自然に書き直す / Rephrase the translation in the same language
    const handleRephrase = async () => {
        if (!targetText.trim() || aiBusy) return;
        setAiOpen(true);
        setAiBusy(true);
        setAiResult('');
        try {
            await translationService.assist({
                engine: selectedEngine,
                system: buildRephraseSystemPrompt(targetLang),
                user: targetText,
                apiKeys: getApiKeys(),
                onChunk: (delta) => setAiResult((prev) => prev + delta),
            });
        } catch (error: unknown) {
            setAiResult(error instanceof Error ? error.message : String(error));
        } finally {
            setAiBusy(false);
        }
    };

    // 代替案・説明: 複数の訳し方とニュアンスを提示 / Alternatives and nuance notes
    const handleAlternatives = async () => {
        if (!sourceText.trim() || aiBusy) return;
        const detected = detectLanguage(sourceText);
        const src = sourceLang === 'auto' ? (detected === 'auto' ? 'eng_Latn' : detected) : sourceLang;
        setAiOpen(true);
        setAiBusy(true);
        setAiResult('');
        try {
            await translationService.assist({
                engine: selectedEngine,
                system: buildAlternativesSystemPrompt(src, targetLang),
                user: `Source: ${sourceText}\nCurrent translation: ${targetText}`,
                apiKeys: getApiKeys(),
                onChunk: (delta) => setAiResult((prev) => prev + delta),
            });
        } catch (error: unknown) {
            setAiResult(error instanceof Error ? error.message : String(error));
        } finally {
            setAiBusy(false);
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

                    {/* トーン選択 (LLMエンジンのみ) / Tone selector (LLM engines only) */}
                    {isLLMEngine && (
                        <select
                            value={tone}
                            onChange={(e) => setTone(e.target.value as Tone)}
                            title={t.ai.tone.label}
                            className="hidden md:block bg-slate-900/50 border border-white/10 text-slate-200 text-sm rounded-full px-4 py-2 outline-none focus:border-blue-500/50 backdrop-blur-md"
                        >
                            <option value="default">{t.ai.tone.label}: {t.ai.tone.default}</option>
                            <option value="formal">{t.ai.tone.label}: {t.ai.tone.formal}</option>
                            <option value="casual">{t.ai.tone.label}: {t.ai.tone.casual}</option>
                            <option value="business">{t.ai.tone.label}: {t.ai.tone.business}</option>
                            <option value="technical">{t.ai.tone.label}: {t.ai.tone.technical}</option>
                        </select>
                    )}

                    {/* AI アクション (LLMエンジンのみ) / AI actions (LLM engines only) */}
                    {isLLMEngine && (
                        <div className="hidden md:flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={handleRephrase} disabled={aiBusy || !targetText} title={t.ai.actions.rephrase} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                                <Wand2 className="size-5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleAlternatives} disabled={aiBusy || !targetText} title={t.ai.actions.alternatives} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                                <ListPlus className="size-5" />
                            </Button>
                        </div>
                    )}

                    <Button variant="ghost" size="icon" onClick={onNavigateToSettings} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <Settings className="size-5" />
                    </Button>
                </div>
            </header>

            {fallbackNotice && (
                <div className="flex-none mb-3 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 animate-fade-in">
                    {fallbackNotice}
                </div>
            )}

            <main className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 animate-fade-up max-w-none w-full min-h-0">
                <SourcePanel
                    sourceText={sourceText}
                    sourceLang={sourceLang}
                    detectedLang={detectedSourceLang}
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

            {aiOpen && (
                <AIResultModal
                    title={t.ai.actions.resultTitle}
                    closeLabel={t.ai.actions.close}
                    workingLabel={t.ai.actions.working}
                    busy={aiBusy}
                    result={aiResult}
                    onClose={() => setAiOpen(false)}
                />
            )}
        </div>
    );
}
