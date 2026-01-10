import { calculateVarga, calculateD9 } from '../../src/vedic/vargas.js';
import { calculatePanchanga } from '../../src/vedic/panchanga.js';
import { DateTime } from 'luxon';

describe('Vedic Layer', () => {
    describe('Vargas', () => {
        test('D9 Calculation (Aries 0)', () => {
            // 0 deg Aries -> 1st Navamsa of Aries = Aries
            const v = calculateD9(0);
            expect(v.sign).toBe(1); // Aries
            expect(v.degree).toBe(0);
        });

        test('D9 Calculation (Aries 3:20)', () => {
            // 3 deg 20 min = 3.3333 deg. End of 1st Navamsa.
            // 3.3333 * 9 = 30.0
            // Technically start of Taurus Navamsa? Or end of Aries? 
            // 3.33333... is the boundary.
            // Let's test mid-Navamsa. 1.5 deg Aries.
            // 1.5 * 9 = 13.5 -> Aries sign (1), 13.5 result logic?
            // Wait, calculateVarga formula: long * div % 360.
            // 1.5 * 9 = 13.5. 13.5 % 30 = 13.5 deg. Sign floor(13.5/30) = 0 (Aries).
            // Logic holds.
            const v = calculateD9(1.5);
            expect(v.sign).toBe(1);
        });

        test('D9 Calculation (Gemini 0)', () => {
            // 60 deg.
            // 60 * 9 = 540. 540 % 360 = 180.
            // 180 / 30 = 6 -> Libra (7th sign).
            // Logic: 0 Gemini is 7th Navamsa from Aries?
            // No. Navamsa of Gems starts at Libra. Correct.
            const v = calculateD9(60);
            expect(v.sign).toBe(7); // Libra
        });
    });

    describe('Panchanga', () => {
        test('Tithi Calculation (New Moon)', () => {
            // Sun = 0, Moon = 12. Diff = 12. 12/12 = 1. Tithi 2?
            // No. (12-0)/12 = 1.0. Tithi index floor(1)+1 = 2.
            // Wait. 0-12 degrees is Pratipada (1).
            // 12 degrees exact is end of Pratipada.

            // Case 1: Sun 10, Moon 15. Diff 5. 5/12 = 0.41. Index 1. Shukla Pratipada.
            let res = calculatePanchanga(10, 15, DateTime.now());
            expect(res.tithi.index).toBe(1);
            expect(res.tithi.name).toContain('Shukla 1');

            // Case 2: Sun 10, Moon 10 (Amavasya point). Diff 0. Index 1.
            // Wait. 0 diff is Amavasya end / Pratipada start?
            // Ideally 0 is the exact conjunction. Usually counted as Amavasya until passed.
            // But strict Math floor(0/12) + 1 = 1.
            // Let's check typical definitions.
            // 0-12 deg is Shukla Pratipada. So 0.0001 is Pratipada.
        });

        test('Nakshatra Calculation (Ashwini)', () => {
            // Moon at 10 deg.
            // 10 / 13.333 = 0.75. Index 0 (Ashwini).
            const res = calculatePanchanga(0, 10, DateTime.now());
            expect(res.nakshatra.name).toBe('Ashwini');
        });

        test('Vara Calculation (Sunrise logic)', () => {
            // Sunday (Luxon 7). 5 AM. Before sunrise (6 AM default).
            // Should be Saturday.
            const date = DateTime.fromObject({ year: 2023, month: 1, day: 1, hour: 5 }); // Jan 1 2023 was Sunday
            // Luxon weekday 7 (Sun).
            // Before sunrise -> Saturday (6).
            const res = calculatePanchanga(0, 0, date);
            expect(res.vara.name).toBe('Shanivara'); // Saturday

            // 7 AM. After sunrise. Should be Sunday.
            const date2 = DateTime.fromObject({ year: 2023, month: 1, day: 1, hour: 7 });
            const res2 = calculatePanchanga(0, 0, date2);
            expect(res2.vara.name).toBe('Ravivara'); // Sunday
        });
    });
});
