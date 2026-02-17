import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'galaxy' | 'emerald' | 'sky' | 'amethyst' | 'ruby' | 'midnight';

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	saveTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState<Theme>(() => {
		const saved = localStorage.getItem('theme');
		return (saved as Theme) || 'galaxy';
	});

	useEffect(() => {
		const root = window.document.body;
		root.setAttribute('data-theme', theme);
		// Removed auto-save to localStorage
	}, [theme]);

	const saveTheme = () => {
		localStorage.setItem('theme', theme);
	};

	return (
		<ThemeContext.Provider value={{ theme, setTheme, saveTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
}
