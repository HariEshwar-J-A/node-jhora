/** Localized jyotisha labels. Every helper falls back to the raw English value. */
import { type Lang } from './langs';
import {
    AYANAMSA_LABELS_BY_LANG,
    DASHA_LEVELS_BY_LANG,
    DASHA_SYSTEM_NAMES,
    HOUSE_LABELS_BY_LANG,
    KARAKA_NAMES,
    KARANA_NAMES,
    KUTA_NAMES,
    NAKSHATRA_NAMES_BY_LANG,
    PAKSHA,
    PLANET_NAMES,
    PLANET_SHORT,
    RETRO_MARK,
    SIGN_NAMES_BY_LANG,
    TITHI_NAMES_BY_LANG,
    VARA_NAMES_BY_LANG,
    VARGA_NAMES_BY_LANG,
    YOGA_NAMES_BY_LANG,
    YOGA_RULE_NAMES,
    YOGINI_NAMES,
} from './terms';

function pick<T extends string>(table: Record<T, string>, key: string): string | undefined {
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key as T] : undefined;
}

export function planetName(name: string, lang: Lang = 'en'): string {
    return pick(PLANET_NAMES[lang], name) ?? name;
}

export function planetShort(name: string, lang: Lang = 'en'): string {
    return pick(PLANET_SHORT[lang], name) ?? name.slice(0, 2);
}

export function retroMark(lang: Lang = 'en'): string {
    return RETRO_MARK[lang];
}

/** 1-based sign → name. */
export function localSignName(sign1Based: number, lang: Lang = 'en'): string {
    if (!Number.isFinite(sign1Based) || sign1Based < 1 || sign1Based > 12) return '—';
    return SIGN_NAMES_BY_LANG[lang][sign1Based - 1] ?? '—';
}

/** English sign name (as returned by the engine) → localized. */
export function signFromEnglish(name: string, lang: Lang = 'en'): string | undefined {
    const index = SIGN_NAMES_BY_LANG.en.indexOf(name);
    return index >= 0 ? SIGN_NAMES_BY_LANG[lang][index] : undefined;
}

/** 0-based nakshatra index → name. */
export function localNakshatraName(index0: number, lang: Lang = 'en'): string {
    if (!Number.isFinite(index0) || index0 < 0 || index0 > 26) return '—';
    return NAKSHATRA_NAMES_BY_LANG[lang][index0] ?? '—';
}

/** Engine nakshatra name → localized (accepts the "Dhanishta" spelling too). */
export function nakshatraFromEnglish(name: string, lang: Lang = 'en'): string {
    const normalized = name === 'Dhanishta' ? 'Dhanishtha' : name;
    const index = NAKSHATRA_NAMES_BY_LANG.en.indexOf(normalized);
    if (index < 0 || lang === 'en') return name;
    return NAKSHATRA_NAMES_BY_LANG[lang][index] ?? name;
}

/**
 * Tithi label from the engine's 1–30 index (preferred) or its English name
 * ("Shukla 5", "Purnima", "Amavasya"). English output is the engine's text.
 */
export function tithiLabel(tithi: { index?: number; name?: string }, lang: Lang = 'en'): string {
    const english = tithi.name ?? '—';
    if (lang === 'en') return english;
    let index = typeof tithi.index === 'number' ? tithi.index : NaN;
    if (!Number.isFinite(index) && tithi.name) {
        if (tithi.name === 'Purnima') index = 15;
        else if (tithi.name === 'Amavasya') index = 30;
        else {
            const m = /^(Shukla|Krishna)\s+(\d{1,2})$/.exec(tithi.name);
            if (m) index = (m[1] === 'Shukla' ? 0 : 15) + Number(m[2]);
        }
    }
    if (!Number.isFinite(index) || index < 1 || index > 30) return english;
    const p = PAKSHA[lang];
    if (index === 15) return p.purnima;
    if (index === 30) return p.amavasya;
    const paksha = index <= 15 ? p.shukla : p.krishna;
    const within = index <= 15 ? index : index - 15;
    return `${paksha} ${TITHI_NAMES_BY_LANG[lang][within - 1]}`;
}

function byEnglishIndex(
    table: Record<Lang, readonly string[]>,
    value: { index?: number; name?: string },
    lang: Lang,
    indexBase: 0 | 1,
): string {
    const english = value.name ?? '—';
    if (lang === 'en') return english;
    let i = value.name ? table.en.indexOf(value.name) : -1;
    if (i < 0 && typeof value.index === 'number') i = value.index - indexBase;
    return table[lang][i] ?? english;
}

export function panchangaYogaName(yoga: { index?: number; name?: string }, lang: Lang = 'en') {
    return byEnglishIndex(YOGA_NAMES_BY_LANG, yoga, lang, 1);
}

export function varaName(vara: { index?: number; name?: string }, lang: Lang = 'en') {
    return byEnglishIndex(VARA_NAMES_BY_LANG, vara, lang, 0);
}

export function karanaName(name: string | undefined, lang: Lang = 'en'): string {
    if (!name) return '—';
    return pick(KARANA_NAMES[lang], name) ?? name;
}

export function vargaName(division: number, lang: Lang = 'en'): string | undefined {
    return VARGA_NAMES_BY_LANG[lang][division];
}

export function localVargaTitle(division: number, lang: Lang = 'en'): string {
    const name = vargaName(division, lang);
    return name ? `D${division} ${name}` : `D${division}`;
}

export function dashaLevelName(level: number, lang: Lang = 'en'): string {
    return DASHA_LEVELS_BY_LANG[lang][level] ?? '';
}

export function dashaSystemName(key: string, lang: Lang = 'en'): string {
    return (
        pick(DASHA_SYSTEM_NAMES[lang], key) ??
        key
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .replace(/^./, (c) => c.toUpperCase())
    );
}

/** Dasha period lord: a planet, a sign (rasi dashas) or a yogini. */
export function dashaLordName(lord: string, lang: Lang = 'en'): string {
    if (lang === 'en') return lord;
    return (
        pick(PLANET_NAMES[lang], lord) ??
        signFromEnglish(lord, lang) ??
        pick(YOGINI_NAMES[lang], lord) ??
        lord
    );
}

export function karakaName(key: string, lang: Lang = 'en'): string {
    return pick(KARAKA_NAMES[lang], key) ?? key;
}

export function kutaName(name: string, lang: Lang = 'en'): string {
    return pick(KUTA_NAMES[lang], name) ?? name;
}

export function yogaRuleName(yoga: { key?: string; name: string }, lang: Lang = 'en'): string {
    if (lang === 'en' || !yoga.key) return yoga.name;
    return pick(YOGA_RULE_NAMES[lang], yoga.key.toUpperCase()) ?? yoga.name;
}

export function ayanamsaLabel(id: string, lang: Lang = 'en'): string {
    return (
        AYANAMSA_LABELS_BY_LANG[lang][id] ?? AYANAMSA_LABELS_BY_LANG.en[id] ?? id.replace(/_/g, ' ')
    );
}

export function houseSystemLabel(id: string, lang: Lang = 'en'): string {
    return HOUSE_LABELS_BY_LANG[lang][id] ?? HOUSE_LABELS_BY_LANG.en[id] ?? id.replace(/_/g, ' ');
}
