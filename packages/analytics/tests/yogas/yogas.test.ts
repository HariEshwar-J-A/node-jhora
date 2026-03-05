
import { YogaEngine, ChartData } from '../../src/yogas/engine.js';
import { YOGA_LIBRARY } from '../../src/yogas/library.js';

describe('Yoga Engine', () => {

    test('Detects Hamsa Yoga (Jupiter Exalted in Kendra)', () => {
        // Jupiter in Cancer (Exalted) in 1st House (Ascendant Cancer)
        const chart: ChartData = {
            ascendant: 90, // Cancer 0
            cusps: [90, 120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60], // Equal houses
            planets: [
                { id: 5, name: 'Jupiter', longitude: 95, distance: 1, speed: 1, latitude: 0, declination: 0 } as any // Cancer 5
            ]
        };

        const results = YogaEngine.findYogas(chart, YOGA_LIBRARY);
        expect(results.some(r => r.yoga.name === 'Hamsa Yoga')).toBe(true);
    });

    test('Detects Gaja Kesari Yoga (Jupiter in Kendra from Moon)', () => {
        // Moon in Aries (0-30), Jupiter in Cancer (90-120).
        // Jupiter is in 4th from Moon.
        const chart: ChartData = {
            ascendant: 0,
            cusps: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
            planets: [
                { id: 1, name: 'Moon', longitude: 10, distance: 1, speed: 1, latitude: 0, declination: 0 } as any, // Aries
                { id: 5, name: 'Jupiter', longitude: 100, distance: 1, speed: 1, latitude: 0, declination: 0 } as any // Cancer
            ]
        };

        const results = YogaEngine.findYogas(chart, YOGA_LIBRARY);
        expect(results.some(r => r.yoga.name === 'Gaja Kesari Yoga')).toBe(true);
    });

    test('Does NOT detect Yoga when conditions fail', () => {
        // Jupiter in Leo (Not Exalted/Own) in 1st House.
        const chart: ChartData = {
            ascendant: 120, // Leo
            cusps: [120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60, 90],
            planets: [
                { id: 5, name: 'Jupiter', longitude: 125, distance: 1, speed: 1, latitude: 0, declination: 0 } as any // Leo
            ]
        };

        const results = YogaEngine.findYogas(chart, YOGA_LIBRARY);
        expect(results.some(r => r.yoga.name === 'Hamsa Yoga')).toBe(false);
    });
});
