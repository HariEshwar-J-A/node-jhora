import {
    Body,
    BODY_ASHTAKAVARGA_LAGNA_DONOR,
    PlanetPosition,
    SEVEN_GRAHAS_JHORA_ORDER,
} from '@node-jhora/core';

/**
 * Ashtakavarga Points Table (Parasara).
 * Key: Planet ID (0=Sun, 1=Moon... 6=Saturn, 99=Ascendant)
 * Value: Benefic places from itself (1-12 houses).
 *
 * Note: We map Lagna ID to 99 temporarily to distinguish it from the 7 planets.
 */

// Benefic spots from Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Lagna
// Source: BPHS
const ASHTAKAVARGA_RULES: Record<number, Record<number, number[]>> = {
    // Sun's BAV
    [Body.Sun]: {
        [Body.Sun]: [1, 2, 4, 7, 8, 9, 10, 11], // From Sun
        [Body.Moon]: [3, 6, 10, 11], // From Moon
        [Body.Mars]: [1, 2, 4, 7, 8, 9, 10, 11], // From Mars
        [Body.Mercury]: [3, 5, 6, 9, 10, 11, 12], // From Mercury
        [Body.Jupiter]: [5, 6, 9, 11], // From Jupiter
        [Body.Venus]: [6, 7, 12], // From Venus
        [Body.Saturn]: [1, 2, 4, 7, 8, 9, 10, 11], // From Saturn
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [3, 4, 6, 10, 11, 12], // From Lagna
    },
    // Moon's BAV
    [Body.Moon]: {
        [Body.Sun]: [3, 6, 7, 8, 10, 11], // From Sun
        [Body.Moon]: [1, 3, 6, 7, 10, 11], // From Moon
        [Body.Mars]: [2, 3, 5, 6, 9, 10, 11], // From Mars
        [Body.Mercury]: [1, 3, 4, 5, 7, 8, 10, 11], // From Mercury
        [Body.Jupiter]: [1, 4, 7, 8, 10, 11, 12], // From Jupiter
        [Body.Venus]: [3, 4, 5, 7, 9, 10, 11], // From Venus
        [Body.Saturn]: [3, 5, 6, 11], // From Saturn
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [3, 6, 10, 11], // From Lagna
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
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 3, 6, 10, 11],
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
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 2, 4, 6, 8, 10, 11],
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
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 2, 4, 5, 6, 7, 9, 10, 11],
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
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 2, 3, 4, 5, 8, 9, 11],
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
        [BODY_ASHTAKAVARGA_LAGNA_DONOR]: [1, 3, 4, 6, 10, 11],
    },
};

export interface AshtakavargaResult {
    bav: Record<number, number[]>; // PlanetID -> [Score in Sign 1...12]
    sav: number[]; // Community Score [Sign 1...12]
}

export class Ashtakavarga {
    /**
     * Calculates Ashtakavarga (BAV and SAV).
     * @param planets List of planets (Sun..Sat, Rahu, Ketu).
     * @param ascendantSign Ascendant Sign Index (1-based or 0-based? Let's use 1-based internally for logic ease).
     *                      Wait, input is typically 1 (Aries). My sys uses 1-based houses often but normalization can be 0.
     *                      Let's stick to 1-based Signs (1=Aries).
     */
    public static calculate(planets: PlanetPosition[], ascendantSign: number): AshtakavargaResult {
        const bav: Record<number, number[]> = {};
        // Initialize SAV (0-11, representing Signs Aries-Pisces)
        const sav = new Array(12).fill(0);

        // Planet IDs we care about: 0(Sun), 1(Mon), 2(Mer), 3(Ven), 4(Mar), 5(Jup), 6(Sat)
        const targetPlanets = [...SEVEN_GRAHAS_JHORA_ORDER];

        // Helper to get Sign (1-12)
        const getSign = (pId: number) => {
            if (pId === BODY_ASHTAKAVARGA_LAGNA_DONOR) return ascendantSign;
            const p = planets.find((pl) => pl.id === pId);
            if (!p) return 0; // Error
            return Math.floor(p.longitude / 30) + 1;
        };

        targetPlanets.forEach((targetId) => {
            // Scores for this planet across 12 signs (Aries...Pisces)
            // Initialize with 0
            const scores = new Array(12).fill(0);

            const rules = ASHTAKAVARGA_RULES[targetId];

            // Iterate through every Donor (Sun...Sat + Lagna)
            [...SEVEN_GRAHAS_JHORA_ORDER, BODY_ASHTAKAVARGA_LAGNA_DONOR].forEach((donorId) => {
                const beneficHouses = rules[donorId];
                if (!beneficHouses) return;

                const donorSign = getSign(donorId); // 1-12

                // For each benefic house (relative to donor), add a point to that sign
                beneficHouses.forEach((h) => {
                    // Sign index = (DonorSign + House - 2) % 12 ?
                    // Ex: Donor in 1 (Aries). House 1 = Aries.
                    // (1 + 1 - 1) = 1.
                    // House 2 = Tau. (1 + 2 - 1) = 2.
                    let targetSign = (donorSign + h - 1) % 12;
                    if (targetSign === 0) targetSign = 12;

                    // Map to 0-based array index (0=Aries)
                    scores[targetSign - 1]++;
                });
            });

            bav[targetId] = scores;

            // Add to SAV
            scores.forEach((s, idx) => {
                sav[idx] += s;
            });
        });

        return { bav, sav };
    }
}
