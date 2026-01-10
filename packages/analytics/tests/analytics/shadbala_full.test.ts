import { calculateShadbala, ShadbalaInput } from '../../src/shadbala.js';
import { PlanetPosition, HouseData } from '@node-jhora/core';

describe('Shadbala Integration', () => {
    test('Calculates Total Shadbala for Sun', () => {
        // Mock Inputs
        const sun = {
            id: 0,
            longitude: 10, // Exaltation (Aries 10)
            declination: 23, // North
            speed: 1.0
        } as PlanetPosition;

        const moon = {
            id: 1,
            longitude: 190, // Full Moon (Sun 10, Moon 190, Dist=180)
            declination: -23,
            speed: 13
        } as PlanetPosition;

        const houses = {
            ascendant: 90, // Cancer Rising (East is 90)
            mc: 180, // Libra MC (South is 180)
            cusps: [], // Not needed if using Whole Sign logic in integration (calculated from asc)
            armc: 0,
            vertex: 0
        } as HouseData;

        const timeDetails = {
            sunrise: 6,
            sunset: 18,
            birthHour: 12 // Noon
        };

        const vargaPositions = [
            { vargaName: 'D1', sign: 1, lordId: 4, lordRashiSign: 10 }, // Sun in Aries (1). Lord Mars in Cap (10). 
            // Cap is 10th from Aries. Friend (Tatkalika).
            // Mars is Natural Friend of Sun.
            // Compound: Great Friend (22.5).
            { vargaName: 'D9', sign: 1, lordId: 4, lordRashiSign: 10 }  // Simulating D9 same for simplicity
            // ... Assume others skipped or handled. logic sums array.
        ];

        const input: ShadbalaInput = {
            planet: sun,
            allPlanets: [sun, moon], // Needed for Drig
            houses,
            sun,
            moon,
            timeDetails,
            vargaPositions
        };

        const result = calculateShadbala(input);

        // Assertions

        // 1. Sthana
        expect(result.sthana).toBe(195);

        // 2. Dig
        expect(result.dig).toBeCloseTo(3.33, 1);

        // 3. Kaala
        expect(result.breakdown.natonata).toBeCloseTo(3.33, 1);
        expect(result.breakdown.paksha).toBe(0);
        expect(result.breakdown.tribhaga).toBe(60);
        expect(result.breakdown.ayana).toBe(58.75);

        // 4. Chesta
        expect(result.chesta).toBe(0);

        // 5. Naisargika
        expect(result.naisargika).toBe(60);

        // 6. Drig
        expect(result.drig).toBe(15);

        // Total
        // Sum = 195 + 10/3 + 10/3 + 0 + 60 + 58.75 + 60 + 15 = 395.4166...
        expect(result.total).toBeCloseTo(395.42, 1);

        // Ishta/Kashta
        expect(result.ishtaPhala).toBe(0);
        expect(result.kashtaPhala).toBe(0);
    });
});
