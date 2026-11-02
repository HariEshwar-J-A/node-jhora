import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'aurora' | 'daylight';

const ThemeContext = createContext<{
    mode: ThemeMode;
    setMode: (m: ThemeMode) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(() => {
        if (typeof window === 'undefined') return 'aurora';
        const stored = localStorage.getItem('njh-theme');
        return stored === 'daylight' ? 'daylight' : 'aurora';
    });

    useEffect(() => {
        document.documentElement.dataset.theme = mode;
        localStorage.setItem('njh-theme', mode);
    }, [mode]);

    const value = useMemo(() => ({ mode, setMode }), [mode]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme outside provider');
    return ctx;
}
