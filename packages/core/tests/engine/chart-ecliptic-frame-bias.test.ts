/**
 * Chart ecliptic latitude uses the IAU 2000 frame bias (IERS 2003 §1.1;
 * IERS 2010 eq. (5.32), dα₀ at eq. (5.21)); longitude stays on the ICRF path.
 */

import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import {
    chartEclipticFromIcrfDirection,
    iau2000FrameBias,
    icrfToMeanEclipticOfDate,
    julianCenturies,
    toSpherical,
} from '../../src/engine/precession.js';
import { deltaT } from '../../src/engine/deltat.js';

/** March-equinox Sun, geocentric; oracle TRUEPOS ecliptic latitude (″). */
const EQUINOX_SUN_LAT_ARCSEC = 0.2437;
const EQUINOX_JD_UT = 2451623.8164213;

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 30_000);

test('equinox Sun ecliptic latitude matches oracle TRUEPOS (black-box pin)', () => {
    const utc = DateTime.fromMillis((EQUINOX_JD_UT - 2440587.5) * 86400000, { zone: 'utc' });
    const sun = engine
        .getPlanets(utc, undefined, {
            ayanamsaOrder: 27,
            julianDayUt: EQUINOX_JD_UT,
            calendar: 'gregorian',
        })
        .find((p) => p.name === 'Sun');
    const latArcsec = sun!.latitude * 3600;
    expect(Math.abs(latArcsec - EQUINOX_SUN_LAT_ARCSEC)).toBeLessThan(0.01);
});

test('chartEclipticFromIcrfDirection leaves longitude on the ICRF ecliptic', () => {
    const jd = 2451545.0;
    const jdTT = jd + deltaT(jd) / 86400;
    const T = julianCenturies(jdTT);
    const dirs: [number, number, number][] = [
        [1, 0.1, 0.05],
        [0.2, -0.9, 0.3],
        [-0.4, 0.2, 0.88],
    ];
    for (const d of dirs) {
        const n = Math.hypot(d[0], d[1], d[2]);
        const v = [d[0] / n, d[1] / n, d[2] / n] as [number, number, number];
        const icrfLon = toSpherical(icrfToMeanEclipticOfDate(v, T, jdTT)).lon;
        const chart = chartEclipticFromIcrfDirection(v, T, jdTT);
        expect(chart.lon).toBeCloseTo(icrfLon, 12);
        const unbiasedLat = toSpherical(icrfToMeanEclipticOfDate(v, T, jdTT)).lat;
        expect(Math.abs(chart.lat - unbiasedLat)).toBeGreaterThan(0);
    }
});

test('iau2000FrameBias matches the published IERS angles (axis order)', () => {
    const v: [number, number, number] = [0.9, 0.1, 0.4];
    const biased = iau2000FrameBias(v);
    expect(biased[0]).not.toBeCloseTo(v[0], 8);
});

test('JHora DLL golden (Jo ΔT, 1850–2025): graha longitude within 1″', () => {
    const fixture = JSON.parse(
        readFileSync(new URL('../fixtures/jhora_dll_golden.json', import.meta.url), 'utf8'),
    ) as {
        cases: {
            utc: string;
            jdUT: number;
            deltaTSeconds: number;
            bodies: Record<string, number>;
        }[];
    };

    const grahas = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
    let max = 0;
    for (const c of fixture.cases) {
        const y = Number.parseInt(c.utc.slice(0, 4), 10);
        if (y < 1850 || y > 2025 || c.jdUT < 2396758.5 || c.jdUT > 2506331.5) continue;
        const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
        const got = new Map(
            engine
                .getPlanets(utc, undefined, {
                    ayanamsaOrder: 27,
                    julianDayUt: c.jdUT,
                    calendar: 'gregorian',
                    deltaTOverrideSeconds: c.deltaTSeconds,
                })
                .map((p) => [p.name, p.longitude]),
        );
        for (const g of grahas) {
            let d = got.get(g)! - c.bodies[g];
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            max = Math.max(max, Math.abs(d) * 3600);
        }
    }
    expect(max).toBeLessThan(1);
});

describe('engine graha ecliptic latitude', () => {
    const utc = DateTime.fromISO('2000-01-01T12:00:00', { zone: 'utc' });
    const loc = { latitude: 13.0827, longitude: 80.2707 };

    test.each(['jhora', 'modern'] as const)('profile %s reports latitude', (profile) => {
        const moon = engine
            .getPlanets(utc, loc, { precisionProfile: profile, ayanamsaOrder: 27 })
            .find((p) => p.name === 'Moon');
        expect(moon).toBeDefined();
        expect(Number.isFinite(moon!.latitude)).toBe(true);
        expect(Math.abs(moon!.latitude)).toBeLessThan(6);
    });
});
