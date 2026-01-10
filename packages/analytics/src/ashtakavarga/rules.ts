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
    0: {
        0: [1, 2, 4, 7, 8, 9, 10, 11], // From Sun
        1: [3, 6, 10, 11],             // From Moon
        4: [1, 2, 4, 7, 8, 9, 10, 11], // From Mars
        2: [3, 5, 6, 9, 10, 11, 12],   // From Mercury
        5: [5, 6, 9, 11],              // From Jupiter
        3: [6, 7, 12],                 // From Venus
        6: [1, 2, 4, 7, 8, 9, 10, 11], // From Saturn
        99: [3, 4, 6, 10, 11, 12]      // From Lagna
    },
    // Moon's BAV
    1: {
        0: [3, 6, 7, 8, 10, 11],       // From Sun
        1: [1, 3, 6, 7, 10, 11],       // From Moon
        4: [2, 3, 5, 6, 9, 10, 11],    // From Mars
        2: [1, 3, 4, 5, 7, 8, 10, 11], // From Mercury
        5: [1, 4, 7, 8, 10, 11, 12],   // From Jupiter
        3: [3, 4, 5, 7, 9, 10, 11],    // From Venus
        6: [3, 5, 6, 11],              // From Saturn
        99: [3, 6, 10, 11]             // From Lagna
    },
    // Mars's BAV
    4: {
        0: [3, 5, 6, 10, 11],
        1: [3, 6, 11],
        4: [1, 2, 4, 7, 8, 10, 11],
        2: [3, 5, 6, 11],
        5: [6, 10, 11, 12],
        3: [6, 8, 11, 12],
        6: [1, 4, 7, 8, 9, 10, 11],
        99: [1, 3, 6, 10, 11]
    },
    // Mercury's BAV
    2: {
        0: [5, 6, 9, 11, 12],
        1: [2, 4, 6, 8, 10, 11],
        4: [1, 2, 4, 7, 8, 9, 10, 11],
        2: [1, 3, 5, 6, 9, 10, 11, 12],
        5: [6, 8, 11, 12],
        3: [1, 2, 3, 4, 5, 8, 9, 11],
        6: [1, 2, 4, 7, 8, 9, 10, 11],
        99: [1, 2, 4, 6, 8, 10, 11]
    },
    // Jupiter's BAV
    5: {
        0: [1, 2, 3, 4, 7, 8, 9, 10, 11],
        1: [2, 5, 7, 9, 11],
        4: [1, 2, 4, 7, 8, 10, 11],
        2: [1, 2, 4, 5, 6, 9, 10, 11],
        5: [1, 2, 3, 4, 7, 8, 10, 11],
        3: [2, 5, 6, 9, 10, 11],
        6: [3, 5, 6, 12],
        99: [1, 2, 4, 5, 6, 7, 9, 10, 11]
    },
    // Venus's BAV
    3: {
        0: [8, 11, 12],
        1: [1, 2, 3, 4, 5, 8, 9, 11, 12],
        4: [3, 4, 6, 9, 11, 12],
        2: [3, 5, 6, 9, 11],
        5: [5, 8, 9, 10, 11],
        3: [1, 2, 3, 4, 5, 8, 9, 10, 11],
        6: [3, 4, 5, 8, 9, 10, 11],
        99: [1, 2, 3, 4, 5, 8, 9, 11]
    },
    // Saturn's BAV
    6: {
        0: [1, 2, 4, 7, 8, 10, 11],
        1: [3, 6, 11],
        4: [3, 5, 6, 10, 11, 12],
        2: [6, 8, 9, 10, 11, 12],
        5: [5, 6, 11, 12],
        3: [6, 11, 12],
        6: [3, 5, 6, 11],
        99: [1, 3, 4, 6, 10, 11]
    }
};
