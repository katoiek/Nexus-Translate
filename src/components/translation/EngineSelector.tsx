import { TranslationEngine } from '../../hooks/useTranslationEngines';

interface EngineSelectorProps {
    engines: TranslationEngine[];
    selectedEngine: string;
    onSelect: (engineId: string) => void;
}

export function EngineSelector({ engines, selectedEngine, onSelect }: EngineSelectorProps) {
    return (
        <div className="hidden md:flex bg-slate-900/50 border border-white/10 rounded-full p-1 backdrop-blur-md">
            {engines.map(e => {
                const Icon = e.icon;
                const isSelected = selectedEngine === e.id;
                return (
                    <button
                        key={e.id}
                        onClick={() => onSelect(e.id)}
                        className={`relative flex items-center gap-3 px-5 py-2 rounded-2xl text-sm font-medium transition-all duration-300 ${isSelected
                            ? 'text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {isSelected && (
                            <span className="absolute inset-0 bg-blue-600/80 rounded-2xl -z-10 animate-scale-in" />
                        )}
                        <Icon className="size-4 shrink-0" />
                        <div className="flex flex-col items-start leading-tight">
                            <span className="whitespace-nowrap">{e.name}</span>
                            {e.model && (
                                <span className="text-[10px] opacity-70 font-normal truncate max-w-[120px]">
                                    {e.model}
                                </span>
                            )}
                        </div>
                        <span className="hidden xl:inline text-[10px] opacity-40 ml-1 font-normal border-l border-white/10 pl-2">
                            {e.description}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
