import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { deltaT } from '../../src/engine/deltat.js';
import {
    elpMpp02W3NominalArcsec,
    meanLunarNodeElpBaseTropical,
    meanLunarNodeMeeus,
} from '../../src/engine/mean-lunar-node.js';
import { generalPrecessionLongitudeArcsec } from '../../src/engine/precession.js';

describe('ELP/MPP02 W3 nominal base', () => {
    test('J2000 W3 + p_A agrees with Meeus within ~1″', () => {
        const jdTT = 2451545.0;
        const elp = meanLunarNodeElpBaseTropical(jdTT);
        const meeus = meanLunarNodeMeeus(0);
        let d = (elp - meeus) % 360;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        expect(Math.abs(d * 3600)).toBeLessThan(1.0);
    });

    test('p_A at J2000 is near zero arcsec', () => {
        expect(Math.abs(generalPrecessionLongitudeArcsec(0))).toBeLessThan(0.01);
    });

    test('W3 nominal arcsec at J2000 matches published order of magnitude', () => {
        const w3 = elpMpp02W3NominalArcsec(0);
        expect(w3).toBeGreaterThan(450_000);
        expect(w3).toBeLessThan(451_000);
    });
});

describe('hybrid production path', () => {
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
});
