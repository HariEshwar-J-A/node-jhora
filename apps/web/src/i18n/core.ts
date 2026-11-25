import { en, type MessageKey, type Messages } from './locales/en';
import { hi } from './locales/hi';
import { ta } from './locales/ta';
import { DEFAULT_LANG, LANG_META, type Lang } from './langs';

export type { MessageKey, Messages } from './locales/en';

export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

export const DICTIONARIES: Record<Lang, Partial<Messages>> = { en, ta, hi };

function interpolate(template: string, vars?: Vars): string {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in vars ? String(vars[name]) : whole,
    );
}

/** Look up `key` in `lang`, falling back to English, then to the key itself. */
export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
    const local = DICTIONARIES[lang]?.[key];
    const template = local && local.length > 0 ? local : (en[key] ?? key);
    return interpolate(template, vars);
}

export function translator(lang: Lang): Translate {
    return (key, vars) => translate(lang, key, vars);
}

/** English translator for non-React callers that do not pass one. */
export const tEn: Translate = translator(DEFAULT_LANG);

export function intlLocale(lang: Lang): string {
    return LANG_META[lang].intl;
}

/**
 * Format a number for display. Tamil and Hindi use Western (Latin) digits,
 * which is the everyday convention in both, and Intl's default for ta-IN/hi-IN.
 */
export function formatNumber(lang: Lang, value: number, fractionDigits?: number): string {
    if (!Number.isFinite(value)) return String(value);
    return new Intl.NumberFormat(intlLocale(lang), {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
        useGrouping: false,
    }).format(value);
}
