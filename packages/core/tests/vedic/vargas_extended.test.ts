import { calculateVarga } from '../../src/vedic/vargas.js';

describe('Extended vargas (published rules)', () => {
    test('D5 Aries 3° → Aries (odd first part)', () => {
        expect(calculateVarga(3, 5).sign).toBe(1);
    });

    test('D5 Taurus 3° → Taurus (even first part)', () => {
        expect(calculateVarga(33, 5).sign).toBe(2);
    });

    test('D6 Aries 2° → Aries; 7° → Taurus', () => {
        expect(calculateVarga(2, 6).sign).toBe(1);
        expect(calculateVarga(7, 6).sign).toBe(2);
    });

    test('D8 Taurus (fixed) first part starts Leo', () => {
        expect(calculateVarga(30.5, 8).sign).toBe(5);
    });

    test('D11 Aries first part uses Pisces start (BPHS antizodiacal)', () => {
        expect(calculateVarga(0.5, 11).sign).toBe(12);
    });

    test('D81 navamsa-of-navamsa matches double D9', () => {
        const lon = 84.511;
        const once = calculateVarga(lon, 9);
        const manual = calculateVarga(once.longitude, 9);
        const d81 = calculateVarga(lon, 81, { d81Scheme: 'nav_navamsa' });
        expect(d81.sign).toBe(manual.sign);
        expect(d81.longitude).toBeCloseTo(manual.longitude, 6);
    });

    test('each varga part maps to sign 1–12', () => {
        for (const d of [5, 6, 8, 11, 81, 108, 144, 150]) {
            for (let deg = 0; deg < 30; deg += 0.7) {
                const v = calculateVarga(deg, d);
                expect(v.sign).toBeGreaterThanOrEqual(1);
                expect(v.sign).toBeLessThanOrEqual(12);
            }
        }
    });
});
