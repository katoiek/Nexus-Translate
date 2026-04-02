import { Button } from '../ui/button';
import { ArrowRightLeft, Sparkles, Copy, Check, Volume2, StopCircle } from 'lucide-react';
import { LanguageSelector } from '../LanguageSelector';
import { Translations } from '../../locales/types';

interface TargetPanelProps {
    targetText: string;
    targetLang: string;
    sourceLang: string;
    copiedTarget: boolean;
    isSpeaking: boolean;
    onLangChange: (lang: string) => void;
    onSwapLanguages: () => void;
    onCopy: () => void;
    onSpeak: () => void;
    t: Translations;
}

export function TargetPanel({
    targetText,
    targetLang,
    sourceLang,
    copiedTarget,
    isSpeaking,
    onLangChange,
    onSwapLanguages,
    onCopy,
    onSpeak,
    t,
}: TargetPanelProps) {
    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between px-2 h-10">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-transform hover:rotate-180 duration-500"
                        onClick={onSwapLanguages}
                        disabled={sourceLang === 'auto'}
                    >
                        <ArrowRightLeft className="size-4" />
                    </Button>
                    <LanguageSelector
                        value={targetLang}
                        onChange={onLangChange}
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

                {/* アクションボタン */}
                <div className="absolute bottom-4 right-4 flex items-center gap-3 z-10">
                    {targetText && (
                        <div className="flex bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onSpeak}
                                className={`h-10 w-10 rounded-lg hover:bg-white/10 ${isSpeaking ? 'text-red-400 hover:text-red-300' : 'text-blue-400 hover:text-blue-300'} transition-colors`}
                                title={isSpeaking ? "Stop" : "Listen"}
                            >
                                {isSpeaking ? <StopCircle className="size-5" /> : <Volume2 className="size-5" />}
                            </Button>
                            <div className="w-px bg-white/10 my-2" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onCopy}
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
    );
}
