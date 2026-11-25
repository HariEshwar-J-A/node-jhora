export const LANGS = ['en', 'ta', 'hi'] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'en';

/** Native-script names for the switcher, and BCP 47 tags for Intl. */
export const LANG_META: Record<Lang, { native: string; english: string; intl: string }> = {
    en: { native: 'English', english: 'English', intl: 'en' },
    ta: { native: 'தமிழ்', english: 'Tamil', intl: 'ta-IN' },
    hi: { native: 'हिन्दी', english: 'Hindi', intl: 'hi-IN' },
};

export function isLang(value: unknown): value is Lang {
    return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}
