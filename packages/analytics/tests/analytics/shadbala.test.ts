import { calculateUchchaBala, calculateKendraBala, calculateOjayugmarasyamsaBala, calculateSaptavargajaBala } from '../../src/shadbala.js';

describe('Shadbala - Sthana Bala', () => {
    describe('Uchcha Bala', () => {
        test('Sun at Exaltation (10 Aries)', () => {
            // 10 Aries = 10 deg
            const score = calculateUchchaBala(0, 10);
            expect(score).toBeCloseTo(60);
        });

        test('Sun at Debilitation (10 Libra)', () => {
            // 10 Libra = 190 deg
            const score = calculateUchchaBala(0, 190);
            // Diff = 180. (1/3)*(180-180) = 0.
            expect(score).toBeCloseTo(0);
        });

        test('Sun at 40 deg', () => {
            // Exalt = 10. Diff = 30.
            // (1/3)*(180-30) = 50.
            const score = calculateUchchaBala(0, 40);
            expect(score).toBeCloseTo(50);
        });
    });

    describe('Kendra Bala', () => {
        test('1st House', () => expect(calculateKendraBala(1)).toBe(60));
        test('5th House (Panapara)', () => expect(calculateKendraBala(5)).toBe(30));
        test('3rd House (Apoklima)', () => expect(calculateKendraBala(3)).toBe(15));
    });

    describe('Ojayugmarasyamsa Bala', () => {
        test('Venus (Female) in Even Rashi / Even Navamsa', () => {
            // Even Rashi (2), Even Navamsa (2). Should get 15+15=30.
            expect(calculateOjayugmarasyamsaBala(3, 2, 2)).toBe(30);
        });

        test('Sun (Male) in Odd Rashi / Odd Navamsa', () => {
            // Odd (1), Odd (1). 15+15=30.
            expect(calculateOjayugmarasyamsaBala(0, 1, 1)).toBe(30);
        });

        test('Mixed', () => {
            // Sun in Even Rashi, Odd Navamsa.
            // 0 + 15 = 15.
            expect(calculateOjayugmarasyamsaBala(0, 2, 1)).toBe(15);
        });
    });

    // Note: Saptavargaja test requires setting up detailed VargaInfo scenarios which depends on getRelationship.
    // getRelationship logic is tested nicely in relationship.test.ts, so we trust it.
    // We'll trust integration.
});
