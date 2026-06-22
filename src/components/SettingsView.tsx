import { useState } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Settings as SettingsIcon, Cpu, Globe, Palette, Boxes, BookMarked } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GeneralTab } from './settings/GeneralTab';
import { AppearanceTab } from './settings/AppearanceTab';
import { AITab } from './settings/AITab';
import { OllamaTab } from './settings/OllamaTab';
import { GlossaryTab } from './settings/GlossaryTab';
import { LanguagesTab } from './settings/LanguagesTab';

interface SettingsViewProps {
    onBack: () => void;
}

type Tab = 'general' | 'appearance' | 'ollama' | 'ai' | 'glossary' | 'languages';

export function SettingsView({ onBack }: SettingsViewProps) {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [savedMessage, setSavedMessage] = useState('');

    const showSavedMessage = () => {
        setSavedMessage(t.common.saved || 'Saved');
        setTimeout(() => setSavedMessage(''), 2000);
    };

    return (
        <div className="h-screen flex flex-col p-6 font-display overflow-hidden relative">
            <header className="flex items-center gap-4 mb-4 px-2 relative z-[50]">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                        <ArrowLeft className="size-6" />
                    </Button>
                    <h1 className="text-xl font-bold">{t.settings.title}</h1>
                </div>

                <div className={`ml-auto text-xs font-medium text-green-400 bg-green-500/10 px-3 py-1 rounded-full transition-opacity duration-300 pointer-events-none ${savedMessage ? 'opacity-100' : 'opacity-0'}`}>
                    {savedMessage}
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 h-full">
                {/* サイドバー */}
                <aside className="col-span-3 bg-slate-900/50 rounded-2xl border border-white/5 p-4 flex flex-col gap-2 h-full overflow-y-auto custom-scrollbar">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-3">Preferences</div>

                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'general' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <SettingsIcon className="size-4" />
                        {t.settings.categories.general}
                    </button>

                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'appearance' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <Palette className="size-4" />
                        {t.settings.categories.appearance}
                    </button>

                    <button
                        onClick={() => setActiveTab('ollama')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'ollama' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <Boxes className="size-4" />
                        {t.settings.categories.ollama}
                    </button>

                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'ai' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <Cpu className="size-4" />
                        {t.settings.categories.externalAi}
                    </button>

                    <button
                        onClick={() => setActiveTab('glossary')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'glossary' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <BookMarked className="size-4" />
                        {t.ai.glossary.title}
                    </button>

                    <button
                        onClick={() => setActiveTab('languages')}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'languages' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                    >
                        <Globe className="size-4" />
                        {t.settings.categories.languages}
                    </button>
                </aside>

                {/* コンテンツエリア */}
                <main className="col-span-9 bg-slate-900/30 rounded-2xl border border-white/5 p-8 overflow-y-auto custom-scrollbar h-full">
                    {activeTab === 'general' && <GeneralTab onSaved={showSavedMessage} />}
                    {activeTab === 'appearance' && <AppearanceTab onSaved={showSavedMessage} />}
                    {activeTab === 'ollama' && <OllamaTab onSaved={showSavedMessage} />}
                    {activeTab === 'ai' && <AITab onSaved={showSavedMessage} />}
                    {activeTab === 'glossary' && <GlossaryTab onSaved={showSavedMessage} />}
                    {activeTab === 'languages' && <LanguagesTab onSaved={showSavedMessage} />}
                </main>
            </div>
        </div>
    );
}
