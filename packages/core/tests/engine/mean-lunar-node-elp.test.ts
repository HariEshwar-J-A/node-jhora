import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { deltaT } from '../../src/engine/deltat.js';
import { meanLunarNodeFromJdTT, meanLunarNodeMeeus } from '../../src/engine/mean-lunar-node.js';

describe('mean lunar node (Meeus eq. 47.7)', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = new EphemerisEngine();
        await engine.initialize();
    }, 30_000);

    test('mean node at 2000 CE matches Meeus eq. 47.7', () => {
        const dt = DateTime.fromObject(
            { year: 2000, month: 6, day: 15, hour: 12 },
            { zone: 'utc' },
        );
        const jd = engine.julday(dt);
        const rahu = engine
            .getPlanets(
                dt,
                { latitude: 13.08, longitude: 80.27 },
                {
                    ayanamsaOrder: 27,
                    nodeType: 'mean',
                    julianDayUt: jd,
                },
            )
            .find((p) => p.name === 'Rahu')!.longitude;
        const jdTT = jd + deltaT(jd) / 86400;
        const trop = meanLunarNodeMeeus((jdTT - 2451545) / 36525);
        const ayan = engine.getAyanamsa(jd, 27, 0, 'geometric');
        let sid = (trop - ayan) % 360;
        if (sid < 0) sid += 360;
        let d = (rahu - sid) % 360;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        expect(Math.abs(d * 3600)).toBeLessThan(0.001);
    });

    test('meanLunarNodeFromJdTT equals Meeus at J2000', () => {
        const jdTT = 2451545.0;
        expect(meanLunarNodeFromJdTT(jdTT)).toBeCloseTo(meanLunarNodeMeeus(0), 10);
    });
});
