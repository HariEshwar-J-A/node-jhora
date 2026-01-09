import { calculateHouseCusps, calculateBhavaSandhi } from '../../src/vedic/houses.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { DateTime } from 'luxon';

describe('House Systems', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize();
    });

    // Test location: Chennai (13.08 N, 80.27 E)
    // Date: 2000-01-01 12:00 UTC
    const date = DateTime.fromObject({ year: 2000, month: 1, day: 1, hour: 12 }, { zone: 'utc' });
    const lat = 13.0827;
    const lon = 80.2707;

    test('Calculates Whole Sign Houses', () => {
        const res = calculateHouseCusps(date, lat, lon, 'WholeSign');

        expect(res.system).toBe('WholeSign');
        expect(res.ascendant).toBeDefined();
        expect(res.cusps.length).toBe(12);

        // Verify Equal 30 deg
        const diff1 = (res.cusps[1] - res.cusps[0]);
        // handle wrap
        const diffNorm = diff1 < 0 ? diff1 + 360 : diff1;
        expect(diffNorm).toBeCloseTo(30);

        // Verify Cusp 1 is start of Ascendant Sign
        // Ascendant for Jan 1 2000 12:00 UTC Chennai is likely Pisces or Aries.
        // Let's check Ascendant sign.
        const ascSignStart = Math.floor(res.ascendant / 30) * 30;
        expect(res.cusps[0]).toBe(ascSignStart);
    });

    test('Calculates Placidus Houses (Fallback to Porphyry)', () => {
        const res = calculateHouseCusps(date, lat, lon, 'Placidus');
        // Fallback behavior
        expect(res.system).toBe('Porphyry');
        expect(res.cusps.length).toBe(12);

        expect(res.ascendant).toBeDefined();
        // Check Ascendant value for verification (approx)
        // Jan 1 2000 12:00 UTC Chennai.
        // Sidereal Ascendant should be Pisces or Aries. 
        // 0-30 deg = Aries (No, 0-30 is Aries in regular 0-360 counting if 0=Aries).
        // 350-20 deg range (Pisces/Aries).
        // Let's log it to be sure.
        console.log(`Ascendant: ${res.ascendant}, MC: ${res.mc}`);
    });

    test('Bhava Sandhi (Middle) Calculation', () => {
        // Simple case: Equal 30 deg houses starting at 0
        const cusps = Array.from({ length: 12 }, (_, i) => i * 30);
        const sandhis = calculateBhavaSandhi(cusps);

        expect(sandhis[0].start).toBe(0);
        expect(sandhis[0].middle).toBe(15);
        expect(sandhis[0].end).toBe(30);
    });
});
