/**
 * Longitude speed (deg/day) vs full-range oracle kit (JHora DLL / pyswisseph 2.10).
 * Case 48: 2000-10-19 grid point inside DE440s (modern-era isolation).
 */
import { beforeAll, describe, expect, test } from '@jest/globals';
import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';

const CASE = {
    y: 2000,
    m: 10,
    d: 19,
    H: 21,
    M: 49,
    S: 15,
    lat: 12.7843,
    lon: -101.8386,
};

/** From oracle_jhora.json / oracle_modern.json (nj-fullrange-oracle-kit, 2026-10-26). */
const ORACLE_JHORA: Record<string, number> = {
    Sun: 0.993948553849,
    Moon: 14.096165650297,
    Mercury: -0.179299969596,
    Venus: 1.213823043018,
    Mars: 0.621580664947,
    Jupiter: -0.066960736907,
    Saturn: -0.061057993027,
    Rahu: 0.000711084031,
};

const ORACLE_MODERN: Record<string, number> = {
    Sun: 0.9939102766857663,
    Moon: 14.09612747272103,
    Mercury: -0.179338248119906,
    Venus: 1.213784765841571,
    Mars: 0.6215423877720735,
    Jupiter: -0.06699901411383506,
    Saturn: -0.06109627021567726,
    Rahu: 0.0006728534517570731,
};

const BODIES = Object.keys(ORACLE_JHORA);

describe('speed oracle (case 48, modern era)', () => {
    let eph: EphemerisEngine;

    beforeAll(async () => {
        eph = EphemerisEngine.getInstance();
        await eph.initialize();
    });

    for (const profile of ['jhora', 'modern'] as const) {
        const oracle = profile === 'jhora' ? ORACLE_JHORA : ORACLE_MODERN;
        for (const body of BODIES) {
            test(`${body} ${profile} within 1″/day`, () => {
                const dt = DateTime.fromObject(
                    {
                        year: CASE.y,
                        month: CASE.m,
                        day: CASE.d,
                        hour: CASE.H,
                        minute: CASE.M,
                        second: CASE.S,
                    },
                    { zone: 'utc' },
                );
                const ps = eph.getPlanets(
                    dt,
                    { latitude: CASE.lat, longitude: CASE.lon },
                    {
                        ayanamsaOrder: 27,
                        nodeType: 'true',
                        precisionProfile: profile,
                        ...(profile === 'modern'
                            ? { deltaTForecast: 'oracle-compat' as const }
                            : {}),
                        positionMode: 'geometric',
                    },
                );
                const p = ps.find((x) => x.name === body);
                expect(p).toBeDefined();
                const errArcsecDay = Math.abs(p!.speed - oracle[body]) * 3600;
                expect(errArcsecDay).toBeLessThan(0.01);
            });
        }
    }
});
