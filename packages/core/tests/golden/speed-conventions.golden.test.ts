/**
 * Locks daily-motion conventions inferred from oracle black-box probes (ADR 0008).
 */
import { beforeAll, describe, expect, test } from '@jest/globals';
import { DateTime } from 'luxon';

import { getAyanamsa } from '../../src/engine/ayanamsa.js';
import { withDeltaTContext } from '../../src/engine/deltat.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';

/** Oracle black-box SP-B1: symmetric FD step indistinguishable from SPK derivative. */
const ORACLE_FD_STEP_DAYS = 0.001;

const CASE = {
    year: 2000,
    month: 10,
    day: 19,
    hour: 21,
    minute: 49,
    second: 15,
    lat: 12.7843,
    lon: -101.8386,
};

/** nj-fullrange-oracle-kit case 48 — speeds in deg/day. */
const ORACLE_JHORA_SUN = 0.993948553849;
const ORACLE_MODERN_SUN = 0.9939102766857663;

describe('speed conventions (ADR 0008, case 48)', () => {
    let eph: EphemerisEngine;

    beforeAll(async () => {
        eph = EphemerisEngine.getInstance();
        await eph.initialize();
    });

    const dt = () =>
        DateTime.fromObject(
            {
                year: CASE.year,
                month: CASE.month,
                day: CASE.day,
                hour: CASE.hour,
                minute: CASE.minute,
                second: CASE.second,
            },
            { zone: 'utc' },
        );

    test('jhora speed is tropical rate (not sidereal 1 s FD); modern subtracts ayanamsa rate', () => {
        const jd0 = eph.julday(dt());
        const loc = { latitude: CASE.lat, longitude: CASE.lon };
        const h = ORACLE_FD_STEP_DAYS;
        const ayanRate =
            (getAyanamsa(27, jd0 + h, 'geometric') - getAyanamsa(27, jd0 - h, 'geometric')) /
            (2 * h);

        const siderealFd = (profile: 'jhora' | 'modern') =>
            withDeltaTContext({ profile }, () => {
                const lon = (jd: number) =>
                    eph
                        .getPlanets(dt(), loc, {
                            ayanamsaOrder: 27,
                            nodeType: 'true',
                            precisionProfile: profile,
                            positionMode: 'geometric',
                            julianDayUt: jd,
                        })
                        .find((p) => p.name === 'Sun')!.longitude;
                let d = lon(jd0 + h) - lon(jd0 - h);
                if (d > 180) d -= 360;
                if (d < -180) d += 360;
                return d / (2 * h);
            });

        const jhoraSpeed = withDeltaTContext(
            { profile: 'jhora' },
            () =>
                eph
                    .getPlanets(dt(), loc, {
                        ayanamsaOrder: 27,
                        nodeType: 'true',
                        precisionProfile: 'jhora',
                        positionMode: 'geometric',
                    })
                    .find((p) => p.name === 'Sun')!.speed,
        );
        const modernSpeed = withDeltaTContext(
            { profile: 'modern' },
            () =>
                eph
                    .getPlanets(dt(), loc, {
                        ayanamsaOrder: 27,
                        nodeType: 'true',
                        precisionProfile: 'modern',
                        positionMode: 'geometric',
                    })
                    .find((p) => p.name === 'Sun')!.speed,
        );

        expect(Math.abs(jhoraSpeed - ORACLE_JHORA_SUN) * 3600).toBeLessThan(0.01);
        expect(Math.abs(modernSpeed - ORACLE_MODERN_SUN) * 3600).toBeLessThan(0.01);

        // jhora ≈ tropical analytic; sidereal FD is lower by ayan rate.
        expect(Math.abs(jhoraSpeed - siderealFd('jhora')) * 3600).toBeGreaterThan(0.1);
        expect(Math.abs(jhoraSpeed - siderealFd('jhora') - ayanRate) * 3600).toBeLessThan(0.02);

        // modern ≈ tropical − ayan_rate ≈ sidereal FD at 1 s.
        expect(Math.abs(modernSpeed - (jhoraSpeed - ayanRate)) * 3600).toBeLessThan(0.01);
        expect(Math.abs(modernSpeed - siderealFd('modern')) * 3600).toBeLessThan(0.03);

        // O3 (SP-B2): jhora oracle speed ≈ tropical rate; sidereal FD lower by ayan rate (~0.138″/d).
        const jhoraSun = withDeltaTContext(
            { profile: 'jhora' },
            () =>
                eph
                    .getPlanets(dt(), loc, {
                        ayanamsaOrder: 27,
                        nodeType: 'true',
                        precisionProfile: 'jhora',
                        positionMode: 'geometric',
                    })
                    .find((p) => p.name === 'Sun')!.speed,
        );
        const sidJhora = siderealFd('jhora');
        expect(Math.abs(jhoraSun - sidJhora - ayanRate) * 3600).toBeLessThan(0.02);
    });
});
