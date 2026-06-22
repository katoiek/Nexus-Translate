import { useState, useEffect } from 'react';
import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useLanguage } from '../../contexts/LanguageContext';
import { loadGlossary, saveGlossary } from '../../lib/glossary';
import { GlossaryEntry } from '../../lib/translationPrompt';

interface GlossaryTabProps {
    onSaved: () => void;
}

export function GlossaryTab({ onSaved }: GlossaryTabProps) {
    const { t } = useLanguage();
    const [entries, setEntries] = useState<GlossaryEntry[]>([]);
    const [source, setSource] = useState('');
    const [target, setTarget] = useState('');

    useEffect(() => {
        setEntries(loadGlossary());
    }, []);

    const persist = (next: GlossaryEntry[]) => {
        setEntries(next);
        saveGlossary(next);
        onSaved();
    };

    const handleAdd = () => {
        if (!source.trim() || !target.trim()) return;
        persist([...entries, { source: source.trim(), target: target.trim() }]);
        setSource('');
        setTarget('');
    };

    const handleRemove = (index: number) => {
        persist(entries.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <BookMarked className="size-5 text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">{t.ai.glossary.title}</h2>
                    <p className="text-sm text-slate-400">{t.ai.glossary.description}</p>
                </div>
            </div>

            {/* 追加フォーム / Add form */}
            <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                    <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.ai.glossary.source}</Label>
                    <Input
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder={t.ai.glossary.sourcePlaceholder}
                        className="bg-slate-950/50 border-white/10 text-slate-100 h-11 rounded-xl"
                    />
                </div>
                <div className="flex-1 space-y-2">
                    <Label className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">{t.ai.glossary.target}</Label>
                    <Input
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                        placeholder={t.ai.glossary.targetPlaceholder}
                        className="bg-slate-950/50 border-white/10 text-slate-100 h-11 rounded-xl"
                    />
                </div>
                <button
                    onClick={handleAdd}
                    className="inline-flex items-center gap-1.5 text-sm text-white bg-emerald-600/80 hover:bg-emerald-600 px-4 h-11 rounded-xl transition-colors"
                >
                    <Plus className="size-4" />{t.ai.glossary.add}
                </button>
            </div>

            {/* 一覧 / List */}
            <div className="space-y-2">
                {entries.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">{t.ai.glossary.empty}</p>
                ) : (
                    entries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 bg-slate-950/30 border border-white/5 rounded-xl p-3">
                            <span className="flex-1 text-sm text-slate-200">{entry.source}</span>
                            <span className="text-slate-500">→</span>
                            <span className="flex-1 text-sm text-slate-200">{entry.target}</span>
                            <button
                                onClick={() => handleRemove(index)}
                                className="text-slate-500 hover:text-red-400 transition-colors"
                                aria-label={t.ai.glossary.remove}
                            >
                                <Trash2 className="size-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
