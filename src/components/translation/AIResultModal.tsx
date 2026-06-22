import { useState } from 'react';
import { Sparkles, X, Copy, Check } from 'lucide-react';

interface AIResultModalProps {
    title: string;
    closeLabel: string;
    workingLabel: string;
    busy: boolean;
    result: string;
    onClose: () => void;
}

export function AIResultModal({ title, closeLabel, workingLabel, busy, result, onClose }: AIResultModalProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // noop
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-[min(640px,90vw)] max-h-[80vh] flex flex-col bg-slate-900 border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                    <Sparkles className="size-5 text-violet-400" />
                    <h3 className="flex-1 text-base font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label={closeLabel}>
                        <X className="size-5" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                    {busy && !result ? (
                        <div className="text-sm text-slate-400 animate-pulse">{workingLabel}</div>
                    ) : (
                        <pre className="whitespace-pre-wrap break-words text-sm text-slate-100 font-display leading-relaxed">{result}</pre>
                    )}
                </div>

                <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5">
                    <button
                        onClick={handleCopy}
                        disabled={!result}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {copied ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="text-sm text-white bg-blue-600/80 hover:bg-blue-600 px-4 py-1.5 rounded-lg transition-colors"
                    >
                        {closeLabel}
                    </button>
                </footer>
            </div>
        </div>
    );
}
