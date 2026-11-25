import type { Lang } from './langs';

/**
 * Noto Sans Tamil / Noto Sans Devanagari (OFL-1.1, self-hosted via
 * @fontsource). Each language's script subset is fetched only after that
 * language is chosen, so English visitors never download them.
 */
const loaders: Partial<Record<Lang, () => Promise<unknown>>> = {
    ta: () =>
        Promise.all([
            import('@fontsource/noto-sans-tamil/tamil-400.css'),
            import('@fontsource/noto-sans-tamil/tamil-500.css'),
            import('@fontsource/noto-sans-tamil/tamil-600.css'),
            import('@fontsource/noto-sans-tamil/tamil-700.css'),
        ]),
    hi: () =>
        Promise.all([
            import('@fontsource/noto-sans-devanagari/devanagari-400.css'),
            import('@fontsource/noto-sans-devanagari/devanagari-500.css'),
            import('@fontsource/noto-sans-devanagari/devanagari-600.css'),
            import('@fontsource/noto-sans-devanagari/devanagari-700.css'),
        ]),
};

const started = new Set<Lang>();

export function loadScriptFonts(lang: Lang): void {
    const load = loaders[lang];
    if (!load || started.has(lang)) return;
    started.add(lang);
    void load().catch(() => {
        // System fonts still render the script; allow a retry on next switch.
        started.delete(lang);
    });
}
