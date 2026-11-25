import {
    localNakshatraName,
    localSignName,
    localVargaTitle,
    nakshatraFromEnglish,
} from '../i18n/astro';
import type { Lang } from '../i18n/langs';
import { SIGN_NAMES } from './format';

const NAKSHATRA_NAMES = [
    'Ashwini',
    'Bharani',
    'Krittika',
    'Rohini',
    'Mrigashira',
    'Ardra',
    'Punarvasu',
    'Pushya',
    'Ashlesha',
    'Magha',
    'Purva Phalguni',
    'Uttara Phalguni',
    'Hasta',
    'Chitra',
    'Swati',
    'Vishakha',
    'Anuradha',
    'Jyeshtha',
    'Mula',
    'Purva Ashadha',
    'Uttara Ashadha',
    'Shravana',
    'Dhanishtha',
    'Shatabhisha',
    'Purva Bhadrapada',
    'Uttara Bhadrapada',
    'Revati',
] as const;

const EXALTATION: Record<string, number> = {
    Sun: 0,
    Moon: 1,
    Mars: 9,
    Mercury: 5,
    Jupiter: 3,
    Venus: 11,
    Saturn: 6,
};

const DEBILITATION: Record<string, number> = {
    Sun: 6,
    Moon: 7,
    Mars: 3,
    Mercury: 11,
    Jupiter: 9,
    Venus: 5,
    Saturn: 0,
};

const OWN_SIGNS: Record<string, number[]> = {
    Sun: [4],
    Moon: [3],
    Mars: [0, 7],
    Mercury: [2, 5],
    Jupiter: [8, 11],
    Venus: [1, 6],
    Saturn: [9, 10],
};

export function nakshatraForLongitude(
    longitude: number,
    lang: Lang = 'en',
): {
    index: number;
    name: string;
    pada: number;
} {
    const n = ((longitude % 360) + 360) % 360;
    const span = 360 / 27;
    const idx = Math.floor(n / span);
    const frac = ((n / span - idx) * 100) % 100;
    const pada = Math.min(4, Math.floor(frac / 25) + 1);
    return {
        index: idx + 1,
        name: NAKSHATRA_NAMES[idx] ? nakshatraFromEnglish(NAKSHATRA_NAMES[idx], lang) : '—',
        pada,
    };
}

export type DignityKey = 'exalted' | 'debilitated' | 'own';

export function dignityKey(planetName: string, sign1Based: number): DignityKey | undefined {
    const sign0 = sign1Based - 1;
    if (EXALTATION[planetName] === sign0) return 'exalted';
    if (DEBILITATION[planetName] === sign0) return 'debilitated';
    const own = OWN_SIGNS[planetName];
    if (own?.includes(sign0)) return 'own';
    return undefined;
}

export function dignityLabel(planetName: string, sign1Based: number): string {
    const key = dignityKey(planetName, sign1Based);
    if (key === 'exalted') return 'Exalted';
    if (key === 'debilitated') return 'Debilitated';
    if (key === 'own') return 'Own sign';
    return '—';
}

export function signName(sign1Based: number, lang: Lang = 'en'): string {
    if (lang !== 'en') return localSignName(sign1Based, lang);
    if (!Number.isFinite(sign1Based) || sign1Based < 1 || sign1Based > 12) return '—';
    return SIGN_NAMES[sign1Based - 1] ?? '—';
}

/** Nakshatra name from 0-based index (matches {@link TransitEvent} values). */
export function nakshatraName(index0: number, lang: Lang = 'en'): string {
    if (lang !== 'en') return localNakshatraName(index0, lang);
    if (!Number.isFinite(index0) || index0 < 0 || index0 > 26) return '—';
    return NAKSHATRA_NAMES[index0] ?? '—';
}

export function degreeInSignDms(degree: number): string {
    const d = Math.floor(degree);
    const mFloat = (degree - d) * 60;
    const m = Math.floor(mFloat);
    const s = Math.floor((mFloat - m) * 60);
    return `${d}°${m}'${s}"`;
}

/** Display names for the divisional charts. D1 is Rashi, D9 Navamsa, D10 Dasamsa. */
export const VARGA_NAMES: Record<number, string> = {
    1: 'Rashi',
    2: 'Hora',
    3: 'Drekkana',
    4: 'Chaturthamsa',
    5: 'Panchamsa',
    6: 'Shashthamsa',
    7: 'Saptamsa',
    8: 'Ashtamsa',
    9: 'Navamsa',
    10: 'Dasamsa',
    11: 'Rudramsa',
    12: 'Dwadasamsa',
    16: 'Shodasamsa',
    20: 'Vimsamsa',
    24: 'Siddhamsa',
    27: 'Bhamsa',
    30: 'Trimsamsa',
    40: 'Khavedamsa',
    45: 'Akshavedamsa',
    60: 'Shashtiamsa',
    81: 'Navanavamsa',
    108: 'Ashtottaramsa',
    144: 'Dwadasdwadasamsa',
    150: 'Nadiamsa',
};

export function vargaTitle(division: number, lang: Lang = 'en'): string {
    if (lang !== 'en') return localVargaTitle(division, lang);
    const name = VARGA_NAMES[division];
    return name ? `D${division} ${name}` : `D${division}`;
}

/** Standard divisional charts shown in picker (subset of 1–150). */
export const VARGA_PICKER_DIVISIONS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 150,
] as const;
