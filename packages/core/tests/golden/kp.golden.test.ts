/**
 * Golden Standard: KP System — Sub Lords
 *
 * The KP system divides each Nakshatra into sub-divisions proportional
 * to Vimshottari Dasha years. This test validates signLord, starLord,
 * subLord, and subSubLord at known longitudes.
 *
 * Planet ID mapping (Vimshottari order):
 *   8=Ketu, 3=Venus, 0=Sun, 1=Moon, 4=Mars, 7=Rahu, 5=Jupiter, 6=Saturn, 2=Mercury
 */
import { KPSubLord } from '../../src/kp/sublord.js';

describe('Golden: KP Sublord System', () => {

    describe('Sign lord (Vedic planet rulers)', () => {
        // Aries(0°): Mars(4), Taurus(30°): Venus(3), Gemini(60°): Mercury(2)
        // Cancer(90°): Moon(1), Leo(120°): Sun(0), Virgo(150°): Mercury(2)
        // Libra(180°): Venus(3), Scorpio(210°): Mars(4), Sag(240°): Jupiter(5)
        // Cap(270°): Saturn(6), Aquarius(300°): Saturn(6), Pisces(330°): Jupiter(5)
        const signLordTable: [number, number][] = [
            [0,   4], // Aries
            [30,  3], // Taurus
            [60,  2], // Gemini
            [90,  1], // Cancer
            [120, 0], // Leo
            [150, 2], // Virgo
            [180, 3], // Libra
            [210, 4], // Scorpio
            [240, 5], // Sagittarius
            [270, 6], // Capricorn
            [300, 6], // Aquarius
            [330, 5], // Pisces
        ];

        for (const [lon, expected] of signLordTable) {
            test(`lon=${lon}° → signLord=${expected}`, () => {
                const kp = KPSubLord.calculateKPSignificators(lon + 0.001);
                expect(kp.signLord).toBe(expected);
            });
        }
    });

    describe('Star lord (Nakshatra ruler)', () => {
        // Nakshatra 1 (Ashwini, 0–13.333°): Ketu(8)
        // Nakshatra 2 (Bharani, 13.333–26.667°): Venus(3)
        // Nakshatra 3 (Krittika, 26.667–40°): Sun(0)
        test('0.001° (Ashwini) → starLord=Ketu(8)', () => {
            expect(KPSubLord.calculateKPSignificators(0.001).starLord).toBe(8);
        });
        test('13.34° (Bharani start) → starLord=Venus(3)', () => {
            expect(KPSubLord.calculateKPSignificators(13.34).starLord).toBe(3);
        });
        test('26.67° (Krittika start) → starLord=Sun(0)', () => {
            expect(KPSubLord.calculateKPSignificators(26.67).starLord).toBe(0);
        });
    });

    describe('Captured reference values', () => {
        // Captured from engine run — see _capture_vargas.test.ts
        const table: Array<{ lon: number; signLord: number; starLord: number; subLord: number }> = [
            { lon:   0.0000, signLord: 4, starLord: 8, subLord: 8 },
            { lon:  30.0000, signLord: 3, starLord: 0, subLord: 7 },
            { lon:  60.0000, signLord: 2, starLord: 4, subLord: 6 },
            { lon:  90.0000, signLord: 1, starLord: 5, subLord: 1 },
            // Decimal-precise: 120/(40/3)=9.0 exactly → nakIdx=9 (Magha, Ketu's nakshatra).
            // lonInNak=0 → first sub = Ketu (id=8). Float impl gave nakIdx=8 due to rounding.
            { lon: 120.0000, signLord: 0, starLord: 8, subLord: 8 },
            { lon: 180.0000, signLord: 3, starLord: 4, subLord: 6 },
            { lon: 256.5157, signLord: 5, starLord: 3, subLord: 1 }, // Chart A Sun
            { lon:  85.9640, signLord: 2, starLord: 5, subLord: 8 }, // Chart B Sun
            { lon:  17.5490, signLord: 4, starLord: 3, subLord: 4 }, // Chart B Moon
            { lon: 100.1009, signLord: 1, starLord: 6, subLord: 3 }, // Chart A Rahu
        ];

        for (const row of table) {
            test(`lon=${row.lon}° → signLord=${row.signLord} starLord=${row.starLord}`, () => {
                const kp = KPSubLord.calculateKPSignificators(row.lon);
                expect(kp.signLord).toBe(row.signLord);
                expect(kp.starLord).toBe(row.starLord);
                expect(kp.subLord).toBe(row.subLord);
            });
        }
    });

    describe('Boundary precision', () => {
        // Nakshatra boundary at exactly 13.3333...°: must land in Bharani, not Ashwini
        test('13.3334° is in Bharani (not Ashwini)', () => {
            const kp = KPSubLord.calculateKPSignificators(13.3334);
            expect(kp.starLord).toBe(3); // Venus = Bharani
        });

        test('subLord and subSubLord are valid planet IDs [0-8]', () => {
            const validIds = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
            for (const lon of [0, 45.5, 123.75, 259.9, 359.9]) {
                const kp = KPSubLord.calculateKPSignificators(lon);
                expect(validIds.has(kp.subLord)).toBe(true);
                expect(validIds.has(kp.subSubLord)).toBe(true);
            }
        });

        test('longitude normalised: 360° = 0°', () => {
            const kp0 = KPSubLord.calculateKPSignificators(0.001);
            const kp360 = KPSubLord.calculateKPSignificators(360.001);
            expect(kp0.starLord).toBe(kp360.starLord);
        });
    });
});
