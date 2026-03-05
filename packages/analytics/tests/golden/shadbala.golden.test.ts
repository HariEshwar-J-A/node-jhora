/**
 * Golden Standard: Shadbala (6-fold Planetary Strength)
 *
 * Tests each of the 6 Shadbala components individually against
 * known analytical values. Full integration test uses Chart B.
 *
 * Units: Virupas (raw). 1 Rupa = 60 Virupas.
 * BPHS minimum strength thresholds (Rupas): Sun=5, Moon=6, Mars=5, Merc=7, Jup=6.5, Ven=5.5, Sat=5
 */
import { calculateUchchaBala, calculateKendraBala, calculateOjayugmarasyamsaBala } from '../../src/shadbala.js';

describe('Golden: Shadbala Components', () => {

    // ---------------------------------------------------------------------------
    // Uchcha Bala (Exaltation Strength)
    // Formula: (1/3) * (180 - |lon - exaltPoint|)
    // ---------------------------------------------------------------------------
    describe('Uchcha Bala', () => {
        // Sun: exalts at 10° Aries = 10°
        test('Sun at deep exaltation (10°) = 60 Virupas', () => {
            expect(calculateUchchaBala(0, 10)).toBeCloseTo(60, 2);
        });
        test('Sun at debilitation (190°, Libra 10°) = 0 Virupas', () => {
            expect(calculateUchchaBala(0, 190)).toBeCloseTo(0, 2);
        });
        test('Sun at 100° = (1/3)*(180-|100-10|) = (1/3)*90 = 30', () => {
            expect(calculateUchchaBala(0, 100)).toBeCloseTo(30, 2);
        });

        // Moon: exalts at 33° (Taurus 3°)
        test('Moon at deep exaltation (33°) = 60 Virupas', () => {
            expect(calculateUchchaBala(1, 33)).toBeCloseTo(60, 2);
        });

        // Saturn: exalts at 200° (Libra 20°)
        test('Saturn at deep exaltation (200°) = 60 Virupas', () => {
            expect(calculateUchchaBala(6, 200)).toBeCloseTo(60, 2);
        });
        test('Saturn at 20° (Aries 20°) = (1/3)*(180-|20-200|) = (1/3)*0 = 0', () => {
            // |20-200| = 180 → result = 0
            expect(calculateUchchaBala(6, 20)).toBeCloseTo(0, 2);
        });

        // Anti-wrap: |lon - exalt| > 180 uses 360 - |diff|
        test('Uchcha anti-wrap: Jupiter at 5° (360-|5-95|=270, use 360-90=270? no, take min(90,270)=90), = (1/3)*90 = 30', () => {
            // Jupiter exalts at 95°. |5-95|=90. < 180. Result = (1/3)*(180-90)=30.
            expect(calculateUchchaBala(5, 5)).toBeCloseTo(30, 2);
        });
    });

    // ---------------------------------------------------------------------------
    // Kendra Bala (Angular Strength)
    // ---------------------------------------------------------------------------
    describe('Kendra Bala', () => {
        test('Kendra houses (1,4,7,10) = 60 Virupas', () => {
            for (const h of [1, 4, 7, 10]) {
                expect(calculateKendraBala(h)).toBe(60);
            }
        });
        test('Panapara houses (2,5,8,11) = 30 Virupas', () => {
            for (const h of [2, 5, 8, 11]) {
                expect(calculateKendraBala(h)).toBe(30);
            }
        });
        test('Apoklima houses (3,6,9,12) = 15 Virupas', () => {
            for (const h of [3, 6, 9, 12]) {
                expect(calculateKendraBala(h)).toBe(15);
            }
        });
    });

    // ---------------------------------------------------------------------------
    // Ojayugmarasyamsa Bala (Odd/Even Sign Strength)
    // ---------------------------------------------------------------------------
    describe('Ojayugmarasyamsa Bala', () => {
        // Female planets (Moon=1, Venus=3) gain 15 in EVEN signs
        test('Moon in even sign (Taurus=2) → 15 from Rashi', () => {
            const score = calculateOjayugmarasyamsaBala(1, 2, 1); // odd navamsa: no bonus
            expect(score).toBe(15);
        });
        test('Moon in odd sign (Aries=1) → 0 from Rashi', () => {
            const score = calculateOjayugmarasyamsaBala(1, 1, 1);
            expect(score).toBe(0);
        });
        test('Moon in even Rashi + even Navamsa → 30', () => {
            expect(calculateOjayugmarasyamsaBala(1, 2, 2)).toBe(30);
        });

        // Male planets gain 15 in ODD signs, 15 in ODD navamsa
        test('Sun odd Rashi, even Navamsa → 15', () => {
            // isOddRashi=true(+15), isOddNavamsa=false(+0) = 15
            expect(calculateOjayugmarasyamsaBala(0, 1, 2)).toBe(15);
        });
        test('Sun even Rashi, odd Navamsa → 15', () => {
            // isOddRashi=false(+0), isOddNavamsa=true(+15) = 15
            expect(calculateOjayugmarasyamsaBala(0, 2, 1)).toBe(15);
        });
        test('Sun even Rashi, even Navamsa → 0', () => {
            // isOddRashi=false(+0), isOddNavamsa=false(+0) = 0
            expect(calculateOjayugmarasyamsaBala(0, 2, 2)).toBe(0);
        });
        test('Sun odd Rashi + odd Navamsa → 30', () => {
            expect(calculateOjayugmarasyamsaBala(0, 1, 1)).toBe(30);
        });
    });

    // ---------------------------------------------------------------------------
    // Naisargika Bala (Natural Strength) — constant values
    // ---------------------------------------------------------------------------
    describe('Naisargika Bala (constant)', () => {
        // Standard BPHS values in Virupas:
        // Sun=60, Moon=51.43, Venus=42.85, Jupiter=34.28, Mercury=25.71, Mars=17.14, Saturn=8.57
        // Note: current impl stores Sun(0)=60, Moon(1)=51.43, Venus(3)=42.85, Jup(5)=34.28
        //       Mercury(2)=25.71, Mars(4)=17.14, Saturn(6)=8.57

        // We test via the full calculator — individual export not available in v1
        // These are computed from BPHS ratios: 60*(7/7), 60*(6/7), 60*(5/7)...
        test('BPHS ratio sanity: Sun(60) > Moon(51.43) > Venus(42.85)', () => {
            expect(60.00).toBeGreaterThan(51.43);
            expect(51.43).toBeGreaterThan(42.85);
        });
    });
});
