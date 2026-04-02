import { useState, useEffect } from 'react';
import { Monitor, Power, Settings as SettingsIcon } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface GeneralTabProps {
    onSaved: () => void;
}

export function GeneralTab({ onSaved }: GeneralTabProps) {
    const { t } = useLanguage();
    const [launchAtLogin, setLaunchAtLogin] = useState(false);
    const [closeBehavior, setCloseBehavior] = useState('ask');

    useEffect(() => {
        setLaunchAtLogin(false); // Tauri 版では未実装
        setCloseBehavior(localStorage.getItem('closeBehavior') || 'ask');
    }, []);

    const handleSettingChange = (key: string, value: string | boolean) => {
        if (key === 'launchAtLogin') {
            setLaunchAtLogin(value as boolean);
            // TODO: autostart プラグインのロジックを実装
        }
        if (key === 'closeBehavior') {
            setCloseBehavior(value as string);
            localStorage.setItem('closeBehavior', value as string);
        }
        onSaved();
    };

    return (
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
                            {[
                                { value: 'minimize', label: t.settings.general.window.minimize.label, desc: t.settings.general.window.minimize.desc },
                                { value: 'quit', label: t.settings.general.window.quit.label, desc: t.settings.general.window.quit.desc },
                                { value: 'ask', label: t.settings.general.window.ask.label, desc: '' },
                            ].map(({ value, label, desc }) => (
                                <div key={value} className="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        name="closeBehavior"
                                        id={`cb_${value}`}
                                        value={value}
                                        checked={closeBehavior === value}
                                        onChange={(e) => handleSettingChange('closeBehavior', e.target.value)}
                                        className="size-4 text-blue-500 bg-slate-900 border-slate-700 focus:ring-blue-500/50 cursor-pointer"
                                    />
                                    <label htmlFor={`cb_${value}`} className="text-slate-300 cursor-pointer select-none">
                                        {label}
                                        {desc && <span className="block text-xs text-slate-500 ml-0 mt-0.5">{desc}</span>}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
