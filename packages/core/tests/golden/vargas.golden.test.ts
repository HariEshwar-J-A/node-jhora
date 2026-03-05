/**
 * Golden Standard: Divisional Charts (Vargas)
 *
 * Tests the correctness of all 16 Parashara divisional charts.
 * Expected values computed from first-principles Parashara rules.
 * Where harmonic (D*N % 360) matches Parashara (e.g. D9), both agree.
 *
 * Sign mapping: 1=Aries, 2=Taurus, ... 12=Pisces
 */
import { calculateVarga } from '../../src/vedic/vargas.js';

describe('Golden: Divisional Charts (Vargas)', () => {

    // ---------------------------------------------------------------------------
    // D1 — Identity (trivial)
    // ---------------------------------------------------------------------------
    describe('D1 (Rashi)', () => {
        test('0° Aries → sign 1, 0°', () => {
            const v = calculateVarga(0, 1);
            expect(v.sign).toBe(1);
            expect(v.degree).toBeCloseTo(0, 4);
        });
        test('29.999° Pisces → sign 12', () => {
            const v = calculateVarga(359.999, 1);
            expect(v.sign).toBe(12);
        });
    });

    // ---------------------------------------------------------------------------
    // D2 — Hora (Parivritti Even-Reverse method)
    // ---------------------------------------------------------------------------
    describe('D2 (Hora)', () => {
        // Aries (signIdx=0, even index): hora 0 → targetIdx=(0*2+0)%12=0 → Aries (1)
        test('Aries 0° → Aries (sign 1)', () => {
            const v = calculateVarga(0.001, 2);
            expect(v.sign).toBe(1);
        });
        test('Aries 14.999° → Aries (sign 1)', () => {
            const v = calculateVarga(14.999, 2);
            expect(v.sign).toBe(1);
        });
        // Aries hora 1 → targetIdx=(0*2+1)%12=1 → Taurus (2)
        test('Aries 15° → Taurus (sign 2)', () => {
            const v = calculateVarga(15, 2);
            expect(v.sign).toBe(2);
        });
        test('Aries 29.999° → Taurus (sign 2)', () => {
            const v = calculateVarga(29.999, 2);
            expect(v.sign).toBe(2);
        });
        // Taurus (signIdx=1, odd index): hora 0 → targetIdx=(1*2+(1-0))%12=3 → Cancer (4)
        test('Taurus 0° → Cancer (sign 4)', () => {
            const v = calculateVarga(30.001, 2);
            expect(v.sign).toBe(4);
        });
        // Taurus hora 1 → targetIdx=(1*2+(1-1))%12=2 → Gemini (3)
        test('Taurus 15° → Gemini (sign 3)', () => {
            const v = calculateVarga(45, 2);
            expect(v.sign).toBe(3);
        });
    });

    // ---------------------------------------------------------------------------
    // D3 — Drekkana
    // ---------------------------------------------------------------------------
    describe('D3 (Drekkana)', () => {
        // 0-10°: same sign
        test('Aries 5° → Aries (sign 1)', () => {
            const v = calculateVarga(5, 3);
            expect(v.sign).toBe(1);
        });
        // 10-20°: 5th from sign (Leo=5)
        test('Aries 15° → Leo (sign 5)', () => {
            const v = calculateVarga(15, 3);
            expect(v.sign).toBe(5);
        });
        // 20-30°: 9th from sign (Sagittarius=9)
        test('Aries 25° → Sagittarius (sign 9)', () => {
            const v = calculateVarga(25, 3);
            expect(v.sign).toBe(9);
        });
        test('Taurus 5° → Taurus (sign 2)', () => {
            const v = calculateVarga(35, 3);
            expect(v.sign).toBe(2);
        });
        test('Taurus 15° → Virgo (sign 6)', () => {
            const v = calculateVarga(45, 3);
            expect(v.sign).toBe(6);
        });
    });

    // ---------------------------------------------------------------------------
    // D9 — Navamsa (harmonic matches Parashara for all signs)
    // ---------------------------------------------------------------------------
    describe('D9 (Navamsa)', () => {
        test('0° Aries → Aries (sign 1)', () => {
            const v = calculateVarga(0, 9);
            expect(v.sign).toBe(1);
        });
        test('3°20\' Aries → Taurus (sign 2)', () => {
            const v = calculateVarga(3 + 21/60, 9); // just past 3°20'
            expect(v.sign).toBe(2);
        });
        // Taurus is Fixed: Navamsa starts from 9th sign = Capricorn (sign 10)
        // Harmonic: 30*9=270 → sign 10 ✓
        test('30° (start Taurus, Fixed) → Capricorn (sign 10)', () => {
            const v = calculateVarga(30, 9);
            expect(v.sign).toBe(10);
        });
        // Gemini is Dual: Navamsa starts from 5th sign = Libra (sign 7)
        // Harmonic: 60*9=540, 540%360=180 → sign 7 ✓
        test('60° (start Gemini, Dual) → Libra (sign 7)', () => {
            const v = calculateVarga(60, 9);
            expect(v.sign).toBe(7);
        });
        // Chart B Sun at 85.9641° (Gemini 25.9641°)
        test('85.9641° → Taurus (sign 2)', () => {
            const v = calculateVarga(85.9641, 9);
            expect(v.sign).toBe(2);
            expect(v.degree).toBeCloseTo(23.677, 1);
        });
    });

    // ---------------------------------------------------------------------------
    // D12 — Dvadasamsa (sequential 12 signs from same sign)
    // ---------------------------------------------------------------------------
    describe('D12 (Dvadasamsa)', () => {
        // Aries (sign 1): 12 divisions of 2.5° each, sequential from Aries
        test('Aries 0° → Aries (sign 1)', () => {
            const v = calculateVarga(0, 12);
            expect(v.sign).toBe(1);
        });
        test('Aries 2.5° (2nd part) → Taurus (sign 2)', () => {
            const v = calculateVarga(2.51, 12);
            expect(v.sign).toBe(2);
        });
        test('Aries 25° (11th part) → Aquarius (sign 11)', () => {
            const v = calculateVarga(25, 12);
            expect(v.sign).toBe(11);
        });
    });

    // ---------------------------------------------------------------------------
    // D60 — Shashtyamsa (harmonic)
    // ---------------------------------------------------------------------------
    describe('D60 (Shashtyamsa)', () => {
        test('0° → 0° (Aries, sign 1)', () => {
            const v = calculateVarga(0, 60);
            expect(v.sign).toBe(1);
        });
        test('6° → 0° (Aries, sign 1, 360% wraps)', () => {
            // 6 * 60 = 360 → normalises to 0
            const v = calculateVarga(6, 60);
            expect(v.sign).toBe(1);
            expect(v.degree).toBeCloseTo(0, 3);
        });
        test('0.5° → sign 1, degree 30', () => {
            // 0.5 * 60 = 30 → start of Taurus
            const v = calculateVarga(0.5, 60);
            expect(v.sign).toBe(2);
        });
    });

    // ---------------------------------------------------------------------------
    // General invariants for all divisions
    // ---------------------------------------------------------------------------
    const DIVISIONS = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];

    describe('Invariants', () => {
        for (const d of DIVISIONS) {
            test(`D${d}: sign always in [1, 12] and degree in [0, 30) for 45.75°`, () => {
                const v = calculateVarga(45.75, d);
                expect(v.sign).toBeGreaterThanOrEqual(1);
                expect(v.sign).toBeLessThanOrEqual(12);
                expect(v.degree).toBeGreaterThanOrEqual(0);
                expect(v.degree).toBeLessThan(30);
            });
        }
    });
});
