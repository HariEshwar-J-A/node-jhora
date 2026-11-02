import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

const ThemeContext = createContext<{
    mode: ThemeMode;
    setMode: (m: ThemeMode) => void;
    toggle: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(() => {
        if (typeof window === 'undefined') return 'dark';
        const stored = localStorage.getItem('njh-theme');
        if (stored === 'light' || stored === 'dark') return stored;
        if (stored === 'daylight') return 'light';
        return 'dark';
    });

    useEffect(() => {
        document.documentElement.dataset.theme = mode;
        localStorage.setItem('njh-theme', mode);
    }, [mode]);

    const value = useMemo(
        () => ({
            mode,
            setMode,
            toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
        }),
        [mode],
    );
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme outside provider');
    return ctx;
}
