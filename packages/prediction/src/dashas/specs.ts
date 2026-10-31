/**
 * Published graha-year dasha definitions (BPHS chapter 46).
 * Used by {@link generateCyclicDasha}; not oracles — cite ADR 0018.
 */

export type CyclicDashaId =
    | 'ashtottari'
    | 'shodashottari'
    | 'dwadashottari'
    | 'panchottari'
    | 'shatabdika'
    | 'chaturashiti_sama'
    | 'dwisaptati_sama'
    | 'shashti_hayani';

export interface CyclicDashaSpec {
    id: CyclicDashaId;
    cycleYears: number;
    order: readonly string[];
    durationsYears: Record<string, number>;
    /** Resolve starting maha lord from moon sidereal longitude. */
    startingLord: (moonLongitude: number) => string;
}

const NAK_SPAN = 360 / 27;

export function nakshatraIndex(moonLongitude: number): number {
    const lon = ((moonLongitude % 360) + 360) % 360;
    return Math.floor(lon / NAK_SPAN) % 27;
}

function countInclusive(from: number, to: number): number {
    return ((to - from + 27) % 27) + 1;
}

function lordFromRemainder(remainder: number, modulus: number, order: readonly string[]): string {
    const r = remainder === 0 ? modulus : remainder;
    return order[r - 1]!;
}

const ASHTOTTARI_LORD_BY_NAK = [
    'Rahu',
    'Rahu',
    'Venus',
    'Venus',
    'Venus',
    'Sun',
    'Sun',
    'Sun',
    'Sun',
    'Moon',
    'Moon',
    'Moon',
    'Mars',
    'Mars',
    'Mars',
    'Mars',
    'Mercury',
    'Mercury',
    'Mercury',
    'Saturn',
    'Saturn',
    'Saturn',
    'Jupiter',
    'Jupiter',
    'Jupiter',
    'Rahu',
    'Rahu',
] as const;

const SHASHTI_HAYANI_LORD_BY_NAK = [
    'Jupiter',
    'Jupiter',
    'Jupiter',
    'Sun',
    'Sun',
    'Sun',
    'Sun',
    'Mars',
    'Mars',
    'Mars',
    'Moon',
    'Moon',
    'Moon',
    'Mars',
    'Mercury',
    'Mercury',
    'Mercury',
    'Venus',
    'Venus',
    'Venus',
    'Sun',
    'Saturn',
    'Saturn',
    'Rahu',
    'Rahu',
    'Rahu',
    'Mars',
] as const;

export const CYCLIC_DASHA_SPECS: Record<CyclicDashaId, CyclicDashaSpec> = {
    ashtottari: {
        id: 'ashtottari',
        cycleYears: 108,
        order: ['Sun', 'Moon', 'Mars', 'Mercury', 'Saturn', 'Jupiter', 'Rahu', 'Venus'],
        durationsYears: {
            Sun: 6,
            Moon: 15,
            Mars: 8,
            Mercury: 17,
            Saturn: 10,
            Jupiter: 19,
            Rahu: 12,
            Venus: 21,
        },
        startingLord: (moonLon) => ASHTOTTARI_LORD_BY_NAK[nakshatraIndex(moonLon)]!,
    },
    shodashottari: {
        id: 'shodashottari',
        cycleYears: 116,
        order: ['Sun', 'Mars', 'Jupiter', 'Saturn', 'Ketu', 'Moon', 'Mercury', 'Venus'],
        durationsYears: {
            Sun: 11,
            Mars: 12,
            Jupiter: 13,
            Saturn: 14,
            Ketu: 15,
            Moon: 16,
            Mercury: 17,
            Venus: 18,
        },
        startingLord: (moonLon) => {
            const n = nakshatraIndex(moonLon);
            const count = countInclusive(7, n); // Pushya = 7
            return lordFromRemainder(count % 8, 8, CYCLIC_DASHA_SPECS.shodashottari.order);
        },
    },
    dwadashottari: {
        id: 'dwadashottari',
        cycleYears: 112,
        order: ['Sun', 'Jupiter', 'Ketu', 'Mercury', 'Rahu', 'Mars', 'Saturn', 'Moon'],
        durationsYears: {
            Sun: 7,
            Jupiter: 9,
            Ketu: 11,
            Mercury: 13,
            Rahu: 15,
            Mars: 17,
            Saturn: 19,
            Moon: 21,
        },
        startingLord: (moonLon) => {
            const n = nakshatraIndex(moonLon);
            const count = countInclusive(n, 26); // birth nak → Revati
            return lordFromRemainder(count % 8, 8, CYCLIC_DASHA_SPECS.dwadashottari.order);
        },
    },
    panchottari: {
        id: 'panchottari',
        cycleYears: 105,
        order: ['Sun', 'Mercury', 'Saturn', 'Mars', 'Venus', 'Moon', 'Jupiter'],
        durationsYears: {
            Sun: 12,
            Mercury: 13,
            Saturn: 14,
            Mars: 15,
            Venus: 16,
            Moon: 17,
            Jupiter: 18,
        },
        startingLord: (moonLon) => {
            const n = nakshatraIndex(moonLon);
            const count = countInclusive(16, n); // Anuradha = 16
            return lordFromRemainder(count % 7, 7, CYCLIC_DASHA_SPECS.panchottari.order);
        },
    },
    shatabdika: {
        id: 'shatabdika',
        cycleYears: 100,
        order: ['Sun', 'Moon', 'Venus', 'Mercury', 'Jupiter', 'Mars', 'Saturn'],
        durationsYears: {
            Sun: 5,
            Moon: 5,
            Venus: 10,
            Mercury: 10,
            Jupiter: 20,
            Mars: 20,
            Saturn: 30,
        },
        startingLord: (moonLon) => {
            const n = nakshatraIndex(moonLon);
            const count = countInclusive(26, n); // Revati → birth
            return lordFromRemainder(count % 7, 7, CYCLIC_DASHA_SPECS.shatabdika.order);
        },
    },
    chaturashiti_sama: {
        id: 'chaturashiti_sama',
        cycleYears: 84,
        order: ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'],
        durationsYears: {
            Sun: 12,
            Moon: 12,
            Mars: 12,
            Mercury: 12,
            Jupiter: 12,
            Venus: 12,
            Saturn: 12,
        },
        startingLord: (moonLon) => {
            const n = nakshatraIndex(moonLon);
            const count = countInclusive(14, n); // Swati = 14
            return lordFromRemainder(count % 7, 7, CYCLIC_DASHA_SPECS.chaturashiti_sama.order);
        },
    },
    dwisaptati_sama: {
        id: 'dwisaptati_sama',
        cycleYears: 72,
        order: ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu'],
        durationsYears: {
            Sun: 9,
            Moon: 9,
            Mars: 9,
            Mercury: 9,
            Jupiter: 9,
            Venus: 9,
            Saturn: 9,
            Rahu: 9,
        },
        startingLord: (moonLon) => {
            const n = nakshatraIndex(moonLon);
            const count = countInclusive(18, n); // Mula = 18
            return lordFromRemainder(count % 8, 8, CYCLIC_DASHA_SPECS.dwisaptati_sama.order);
        },
    },
    shashti_hayani: {
        id: 'shashti_hayani',
        cycleYears: 60,
        order: ['Jupiter', 'Sun', 'Mars', 'Moon', 'Mercury', 'Venus', 'Saturn', 'Rahu'],
        durationsYears: {
            Jupiter: 10,
            Sun: 10,
            Mars: 10,
            Moon: 6,
            Mercury: 6,
            Venus: 6,
            Saturn: 6,
            Rahu: 6,
        },
        startingLord: (moonLon) => SHASHTI_HAYANI_LORD_BY_NAK[nakshatraIndex(moonLon)]!,
    },
};
