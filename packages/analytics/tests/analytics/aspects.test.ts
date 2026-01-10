import { calculateDrishtiValue, calculateDrigBala } from '../../src/aspects.js';
import { PlanetPosition } from '@node-jhora/core';

describe('Shadbala - Drig Bala (Aspects)', () => {

    describe('Drishti Value', () => {
        test('180 degrees (7th House) is 60 for any planet', () => {
            expect(calculateDrishtiValue(180, 0)).toBe(60); // Sun
            expect(calculateDrishtiValue(180, 5)).toBe(60); // Jup
        });

        test('90 degrees (4th House) Standard vs Special', () => {
            // Standard Formula 90-120: (120-Angle)/2 + 30.
            // At 90: 30/2 + 30 = 45.

            // Sun (No special):
            expect(calculateDrishtiValue(90, 0)).toBe(45);

            // Mars (Special +15): 45 + 15 = 60.
            expect(calculateDrishtiValue(90, 4)).toBe(60);
        });

        test('120 degrees (5th House) Standard vs Special', () => {
            // Standard 120-150: 150-Angle.
            // At 120: 30.

            // Sun:
            expect(calculateDrishtiValue(120, 0)).toBe(30);

            // Jupiter (Special +30): 30 + 30 = 60.
            expect(calculateDrishtiValue(120, 5)).toBe(60);
        });

        test('60 degrees (3rd House) Standard vs Special', () => {
            // Standard 60-90: (Angle-60) + 15.
            // At 60: 15.

            // Sun:
            expect(calculateDrishtiValue(60, 0)).toBe(15);

            // Saturn (Special +45): 15 + 45 = 60.
            expect(calculateDrishtiValue(60, 6)).toBe(60);
        });

        test('No Aspect (e.g. 10 degrees)', () => {
            expect(calculateDrishtiValue(10, 0)).toBe(0);
        });
    });

    describe('Drig Bala Summation', () => {
        const target = { id: 0, longitude: 0 } as PlanetPosition; // Sun at 0

        test('Benefic Aspect Adds Strength', () => {
            // Jupiter (Benefic) at 180 (Full Aspect 60).
            const planets = [
                target,
                { id: 5, longitude: 180 } as PlanetPosition
            ];

            // Angle = 0 - 180 = -180 -> 180. 
            // Drishti = 60.
            // Benefic adds 60/4 = 15.
            expect(calculateDrigBala(target, planets)).toBe(15);
        });

        test('Malefic Aspect Subtracts Strength', () => {
            // Saturn (Malefic) at 180 (Full Aspect 60).
            const planets = [
                target,
                { id: 6, longitude: 180 } as PlanetPosition
            ];

            // Malefic subtracts 60/4 = 15.
            expect(calculateDrigBala(target, planets)).toBe(-15);
        });

        test('Mixed Aspects', () => {
            // Jup (180) -> +15.
            // Sat (180) -> -15.
            // Net 0.
            const planets = [
                target,
                { id: 5, longitude: 180 } as PlanetPosition,
                { id: 6, longitude: 180 } as PlanetPosition
            ];
            expect(calculateDrigBala(target, planets)).toBe(0);
        });
    });
});
