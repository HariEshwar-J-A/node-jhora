import { Body, BODY_ASHTAKAVARGA_LAGNA_DONOR } from '@node-jhora/core';

/**
 * Ashtakavarga Rules (BPHS Standard)
 * Defines benefic points (Bindus) for each of the 7 planets relative to 8 reference points.
 * Planets: 0=Sun, 1=Moon, 2=Mer, 3=Ven, 4=Mar, 5=Jup, 6=Sat
 * Reference Points: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Lagna (99)
 */

export interface AshtakavargaRuleSet {
    [donorId: number]: number[]; // donorId -> array of benefic house numbers (1-12)
}

export const ASHTAKAVARGA_RULES: Record<number, AshtakavargaRuleSet> = {
    // Sun's BAV
    [Body.Sun]: {
        [Body.Sun]: [1, 2, 4, 7, 8, 9, 10, 11], // From Sun
        [Body.Moon]: [3, 6, 10, 11],             // From Moon
        [Body.Mars]: [1, 2, 4, 7, 8, 9, 10, 11], // From Mars
        [Body.Mercury]: [3, 5, 6, 9, 10, 11, 12],   // From Mercury
        [Body.Jupiter]: [5, 6, 9, 11],              // From Jupiter
        [Body.Venus]: [6, 7, 12],                 // From Venus
        [Body.Saturn]: [1, 2, 4, 7, 8, 9, 10, 11], // From Saturn
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [3, 4, 6, 10, 11, 12]      // From Lagna
    },
    // Moon's BAV
    [Body.Moon]: {
        [Body.Sun]: [3, 6, 7, 8, 10, 11],       // From Sun
        [Body.Moon]: [1, 3, 6, 7, 10, 11],       // From Moon
        [Body.Mars]: [2, 3, 5, 6, 9, 10, 11],    // From Mars
        [Body.Mercury]: [1, 3, 4, 5, 7, 8, 10, 11], // From Mercury
        [Body.Jupiter]: [1, 4, 7, 8, 10, 11, 12],   // From Jupiter
        [Body.Venus]: [3, 4, 5, 7, 9, 10, 11],    // From Venus
        [Body.Saturn]: [3, 5, 6, 11],              // From Saturn
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [3, 6, 10, 11]             // From Lagna
    },
    // Mars's BAV
    [Body.Mars]: {
        [Body.Sun]: [3, 5, 6, 10, 11],
        [Body.Moon]: [3, 6, 11],
        [Body.Mars]: [1, 2, 4, 7, 8, 10, 11],
        [Body.Mercury]: [3, 5, 6, 11],
        [Body.Jupiter]: [6, 10, 11, 12],
        [Body.Venus]: [6, 8, 11, 12],
        [Body.Saturn]: [1, 4, 7, 8, 9, 10, 11],
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 3, 6, 10, 11]
    },
    // Mercury's BAV
    [Body.Mercury]: {
        [Body.Sun]: [5, 6, 9, 11, 12],
        [Body.Moon]: [2, 4, 6, 8, 10, 11],
        [Body.Mars]: [1, 2, 4, 7, 8, 9, 10, 11],
        [Body.Mercury]: [1, 3, 5, 6, 9, 10, 11, 12],
        [Body.Jupiter]: [6, 8, 11, 12],
        [Body.Venus]: [1, 2, 3, 4, 5, 8, 9, 11],
        [Body.Saturn]: [1, 2, 4, 7, 8, 9, 10, 11],
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 2, 4, 6, 8, 10, 11]
    },
    // Jupiter's BAV
    [Body.Jupiter]: {
        [Body.Sun]: [1, 2, 3, 4, 7, 8, 9, 10, 11],
        [Body.Moon]: [2, 5, 7, 9, 11],
        [Body.Mars]: [1, 2, 4, 7, 8, 10, 11],
        [Body.Mercury]: [1, 2, 4, 5, 6, 9, 10, 11],
        [Body.Jupiter]: [1, 2, 3, 4, 7, 8, 10, 11],
        [Body.Venus]: [2, 5, 6, 9, 10, 11],
        [Body.Saturn]: [3, 5, 6, 12],
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 2, 4, 5, 6, 7, 9, 10, 11]
    },
    // Venus's BAV
    [Body.Venus]: {
        [Body.Sun]: [8, 11, 12],
        [Body.Moon]: [1, 2, 3, 4, 5, 8, 9, 11, 12],
        [Body.Mars]: [3, 4, 6, 9, 11, 12],
        [Body.Mercury]: [3, 5, 6, 9, 11],
        [Body.Jupiter]: [5, 8, 9, 10, 11],
        [Body.Venus]: [1, 2, 3, 4, 5, 8, 9, 10, 11],
        [Body.Saturn]: [3, 4, 5, 8, 9, 10, 11],
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 2, 3, 4, 5, 8, 9, 11]
    },
    // Saturn's BAV
    [Body.Saturn]: {
        [Body.Sun]: [1, 2, 4, 7, 8, 10, 11],
        [Body.Moon]: [3, 6, 11],
        [Body.Mars]: [3, 5, 6, 10, 11, 12],
        [Body.Mercury]: [6, 8, 9, 10, 11, 12],
        [Body.Jupiter]: [5, 6, 11, 12],
        [Body.Venus]: [6, 11, 12],
        [Body.Saturn]: [3, 5, 6, 11],
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 3, 4, 6, 10, 11]
    }
};
