import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Copy, Check } from 'lucide-react';
import { LanguageSelector } from '../LanguageSelector';
import { Translations } from '../../locales/types';

interface SourcePanelProps {
    sourceText: string;
    sourceLang: string;
    copiedSource: boolean;
    onTextChange: (text: string) => void;
    onLangChange: (lang: string) => void;
    onCopy: () => void;
    onOCR: () => void;
    t: Translations;
}

export function SourcePanel({
    sourceText,
    sourceLang,
    copiedSource,
    onTextChange,
    onLangChange,
    onCopy,
    onOCR,
    t,
}: SourcePanelProps) {
    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between px-2 h-10 flex-none">
                <LanguageSelector
                    value={sourceLang}
                    onChange={onLangChange}
                    label="原文の言語を選択"
                />
            </div>

            <div className="glass flex-1 rounded-3xl relative group transition-all duration-300 hover:bg-slate-900/60 hover:shadow-blue-900/20 min-h-0 overflow-hidden">
                <div className="absolute inset-0 p-6">
                    <Textarea
                        placeholder={t.translation.placeholder}
                        className="w-full h-full resize-none !border-0 bg-transparent text-xl p-0 leading-relaxed font-light text-slate-100 placeholder:text-slate-600 focus-visible:ring-0 selection:bg-blue-500/30 pb-12 overflow-y-auto shadow-none !outline-none"
                        value={sourceText}
                        onChange={(e) => onTextChange(e.target.value)}
                    />
                </div>

                <div className="absolute bottom-4 right-4 flex items-center gap-3 z-10">
                    <span className="text-xs text-slate-600 font-mono mr-2">{sourceText.length} {t.translation.chars}</span>

                    <div className="flex bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 gap-1 border border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onCopy}
                            className="h-10 w-10 rounded-lg hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                            title={t.translation.copyText}
                        >
                            {copiedSource ? <Check className="size-5 text-green-400" /> : <Copy className="size-5" />}
                        </Button>
                        <div className="w-px bg-white/10 my-2" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onOCR}
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
    );
}
