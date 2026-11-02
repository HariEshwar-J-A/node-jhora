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

export function nakshatraForLongitude(longitude: number): {
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
        name: NAKSHATRA_NAMES[idx] ?? 'Unknown',
        pada,
    };
}

export function dignityLabel(planetName: string, sign1Based: number): string {
    const sign0 = sign1Based - 1;
    if (EXALTATION[planetName] === sign0) return 'Exalted';
    if (DEBILITATION[planetName] === sign0) return 'Debilitated';
    const own = OWN_SIGNS[planetName];
    if (own?.includes(sign0)) return 'Own sign';
    return '—';
}

export function signName(sign1Based: number): string {
    if (!Number.isFinite(sign1Based) || sign1Based < 1 || sign1Based > 12) return '—';
    return SIGN_NAMES[sign1Based - 1] ?? '—';
}

/** Nakshatra name from 0-based index (matches {@link TransitEvent} values). */
export function nakshatraName(index0: number): string {
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

/** Standard divisional charts shown in picker (subset of 1–150). */
export const VARGA_PICKER_DIVISIONS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 150,
] as const;
