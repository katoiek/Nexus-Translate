import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';
import { POPULAR_LANGUAGES, ALL_LANGUAGES, Language } from '../data/languages';
import { cn } from '../lib/utils';

interface LanguageSelectorProps {
	value: string;
	onChange: (code: string) => void;
	label?: string; // e.g. "Select Source Language"
	excludeAuto?: boolean;
}

export function LanguageSelector({ value, onChange, label = 'Select Language', excludeAuto = false }: LanguageSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [openUpwards, setOpenUpwards] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const containerRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Initial selected language name
	const selectedLangName = useMemo(() => {
		if (value === 'auto') return '言語を自動検出';
		const lang = [...POPULAR_LANGUAGES, ...ALL_LANGUAGES].find(l => l.code === value);
		return lang ? lang.name : value;
	}, [value]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	useEffect(() => {
		if (isOpen && containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();
			// Adjust drop direction if near bottom of the viewport
			const spaceBelow = window.innerHeight - rect.bottom;
			if (spaceBelow < 350 && rect.top > spaceBelow) {
				setOpenUpwards(true);
			} else {
				setOpenUpwards(false);
			}

			if (searchInputRef.current) {
				setTimeout(() => searchInputRef.current?.focus(), 50);
			}
		} else {
			setSearchQuery('');
		}
	}, [isOpen]);

	const filteredLanguages = useMemo(() => {
		if (!searchQuery) return { popular: POPULAR_LANGUAGES, all: ALL_LANGUAGES };

		const lowerQuery = searchQuery.toLowerCase();
		const filterFn = (l: Language) =>
			l.name.toLowerCase().includes(lowerQuery) ||
			l.code.toLowerCase().includes(lowerQuery);

		return {
			popular: POPULAR_LANGUAGES.filter(filterFn),
			all: ALL_LANGUAGES.filter(filterFn)
		};
	}, [searchQuery]);

	const handleSelect = (code: string) => {
		onChange(code);
		setIsOpen(false);
	};

	return (
		<div className="relative" ref={containerRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 bg-slate-900/50 hover:bg-slate-800/80 active:bg-slate-800 border border-white/10 rounded-lg px-3 py-2 transition-all duration-200 min-w-[160px] justify-between group"
				aria-label={label}
			>
				<span className="text-sm font-medium text-slate-200 truncate max-w-[140px]">
					{selectedLangName}
				</span>
				<ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
			</button>

			{isOpen && (
				<div className={cn(
					"absolute left-0 w-[500px] max-w-[90vw] bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 flex flex-col max-h-[45vh] animate-in fade-in zoom-in-95 duration-100",
					openUpwards ? "bottom-full mb-2 origin-bottom-left" : "top-full mt-2 origin-top-left"
				)}>
					{/* Search Header */}
					<div className="p-3 border-b border-white/5 bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
							<input
								ref={searchInputRef}
								type="text"
								placeholder="言語を検索します..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full bg-slate-950/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
							/>
						</div>
					</div>

					<div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
						{/* Auto Detect Option (only if not excluded and no search query) */}
						{!excludeAuto && !searchQuery && (
							<div className="mb-2">
								<div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1 mb-1">
									すべての言語
								</div>
								<button
									onClick={() => handleSelect('auto')}
									className={cn(
										"w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
										value === 'auto'
											? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
											: "text-slate-300 hover:bg-white/5 hover:text-white"
									)}
								>
									<div className="flex items-center gap-2">
										<span className={cn(value === 'auto' ? "text-blue-200" : "text-slate-500", "text-xs font-mono opacity-0")}>auto</span>
										<span>言語を自動検出</span>
									</div>
									{value === 'auto' && <Check className="size-4" />}
								</button>
								<div className="h-px bg-white/5 my-2 mx-3" />
							</div>
						)}

						{/* Popular Languages */}
						{(filteredLanguages.popular.length > 0) && (
							<div className="mb-4">
								<div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1 mb-1">
									よく使われる言語
								</div>
								<div className="grid grid-cols-2 gap-1">
									{filteredLanguages.popular.map(lang => (
										<button
											key={lang.code}
											onClick={() => handleSelect(lang.code)}
											className={cn(
												"text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
												value === lang.code
													? "bg-blue-600/20 text-blue-100 border border-blue-500/30"
													: "text-slate-300 hover:bg-white/5 hover:text-white"
											)}
										>
											<span className="truncate">{lang.name}</span>
											{value === lang.code && <Check className="size-3 text-blue-400" />}
										</button>
									))}
								</div>
							</div>
						)}

						{/* All Languages */}
						{filteredLanguages.all.length > 0 && (
							<div>
								<div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1 mb-1">
									すべての言語
								</div>
								<div className="grid grid-cols-2 gap-1">
									{filteredLanguages.all.map(lang => (
										<button
											key={lang.code}
											onClick={() => handleSelect(lang.code)}
											className={cn(
												"text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
												value === lang.code
													? "bg-blue-600/20 text-blue-100 border border-blue-500/30"
													: "text-slate-300 hover:bg-white/5 hover:text-white"
											)}
										>
											<span className="truncate">{lang.name}</span>
											{value === lang.code && <Check className="size-3 text-blue-400" />}
										</button>
									))}
								</div>
							</div>
						)}

						{/* No Results */}
						{filteredLanguages.popular.length === 0 && filteredLanguages.all.length === 0 && (
							<div className="p-8 text-center text-slate-500 text-sm">
								言語が見つかりませんでした
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
