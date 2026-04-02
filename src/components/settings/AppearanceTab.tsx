import { Palette } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme, Theme } from '../../contexts/ThemeContext';

interface AppearanceTabProps {
    onSaved: () => void;
}

export function AppearanceTab({ onSaved }: AppearanceTabProps) {
    const { t } = useLanguage();
    const { theme, setTheme } = useTheme();

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        onSaved();
    };

    const themeGradients: Record<Theme, string> = {
        galaxy: 'bg-gradient-to-br from-indigo-500 to-purple-600',
        emerald: 'bg-gradient-to-br from-emerald-400 to-teal-600',
        sky: 'bg-gradient-to-br from-sky-400 to-blue-600',
        amethyst: 'bg-gradient-to-br from-fuchsia-400 to-purple-600',
        ruby: 'bg-gradient-to-br from-rose-400 to-red-600',
        midnight: 'bg-gradient-to-br from-blue-700 to-indigo-900',
    };

    return (
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
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                            {(Object.keys(themeGradients) as Theme[]).map((tName) => (
                                <button
                                    key={tName}
                                    onClick={() => handleThemeChange(tName)}
                                    className={`group relative p-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${theme === tName
                                        ? 'bg-blue-600/10 border-blue-500/50 ring-2 ring-blue-500/20'
                                        : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/50 hover:border-white/10'
                                        }`}
                                >
                                    <div className={`size-8 rounded-full shadow-lg ${themeGradients[tName]}`} />
                                    <span className={`text-xs font-medium ${theme === tName ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                        {t.settings.appearance.theme[tName as keyof typeof t.settings.appearance.theme]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
