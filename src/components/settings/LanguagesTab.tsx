import { Globe } from 'lucide-react';
import { Label } from '../ui/label';
import { useLanguage } from '../../contexts/LanguageContext';

interface LanguagesTabProps {
    onSaved: () => void;
}

export function LanguagesTab({ onSaved }: LanguagesTabProps) {
    const { t, language, setLanguage } = useLanguage();

    const handleLanguageChange = (lang: 'en' | 'ja') => {
        setLanguage(lang);
        onSaved();
    };

    return (
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
    );
}
