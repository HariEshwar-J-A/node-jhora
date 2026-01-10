import { YogaEngine, YOGA_LIBRARY, ChartData, YogaResult } from '../src/index.js';
import { PlanetPosition } from '@node-jhora/core';

describe('Yoga Engine', () => {

    const createChart = (planetData: Partial<PlanetPosition>[], cusps: number[]): ChartData => {
        // Defaults
        const planets: PlanetPosition[] = planetData.map(p => ({
            id: p.id || 0,
            name: p.name || 'Unknown',
            longitude: p.longitude || 0,
            latitude: p.latitude || 0,
            distance: p.distance || 0,
            speed: p.speed || 0,
            declination: 0,
            ...p
        }));

        return {
            planets,
            cusps,
            ascendant: cusps[0]
        };
    };

    test('Gaja Kesari Yoga (Jupiter in Kendra from Moon)', () => {
        // Moon in Aries (0-30), Jupiter in Cancer (90-120). 
        // Cancer is 4th from Aries (1, 2, 3, 4). Kendra.
        const chart = createChart([
            { name: 'Moon', longitude: 10 },    // Aries
            { name: 'Jupiter', longitude: 100 } // Cancer
        ], new Array(12).fill(0).map((_, i) => i * 30));

        const results = YogaEngine.findYogas(chart, YOGA_LIBRARY);
        const gajaKesari = results.find(r => r.yoga.key === 'GAJA_KESARI');

        expect(gajaKesari).toBeDefined();
        if (gajaKesari) {
            expect(gajaKesari.triggeringPlanets).toContain('Jupiter');
        }
    });

    test('Hamsa Yoga (Jupiter in Kendra from Lagna & Exalted)', () => {
        // Lagna in Aries (0).
        // Jupiter in Cancer (Exalted) (90-120).
        // 4th House = Cancer. Kendra + Exaltation = Hamsa.
        const chart = createChart([
            { name: 'Jupiter', longitude: 95 } // Cancer
        ], new Array(12).fill(0).map((_, i) => i * 30)); // 0, 30, 60...

        const results = YogaEngine.findYogas(chart, YOGA_LIBRARY);
        const hamsa = results.find(r => r.yoga.key === 'HAMSA_YOGA');

        expect(hamsa).toBeDefined();
    });

    test('Dharma-Karma Adhipati Yoga (9th & 10th Lords Conjunction)', () => {
        // Lagna Aries.
        // 9th House = Sagittarius. Lord = Jupiter.
        // 10th House = Capricorn. Lord = Saturn.
        // Conjunction: Both in same sign. Let's put them in Leo (120-150).
        const chart = createChart([
            { name: 'Jupiter', longitude: 130 },
            { name: 'Saturn', longitude: 135 }
        ], new Array(12).fill(0).map((_, i) => i * 30));

        const results = YogaEngine.findYogas(chart, YOGA_LIBRARY);
        const dka = results.find(r => r.yoga.key === 'DHARMA_KARMA_ADHIPATI');

        expect(dka).toBeDefined();
        if (dka) {
            expect(dka.triggeringPlanets).toContain('Jupiter');
            expect(dka.triggeringPlanets).toContain('Saturn');
        }
    });

    test('Negative Test: No Yoga when condition fails', () => {
        // Moon in Aries, Jupiter in Taurus (2nd from Moon, not Kendra).
        const chart = createChart([
            { name: 'Moon', longitude: 10 },
            { name: 'Jupiter', longitude: 40 }
        ], new Array(12).fill(0).map((_, i) => i * 30));

        const results = YogaEngine.findYogas(chart, YOGA_LIBRARY);
        const gajaKesari = results.find(r => r.yoga.key === 'GAJA_KESARI');

        expect(gajaKesari).toBeUndefined();
    });
});
