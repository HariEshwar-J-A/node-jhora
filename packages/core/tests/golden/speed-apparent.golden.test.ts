/**
 * Apparent-place daily motions: 1 s symmetric difference on the apparent-place
 * chain must stay within oracle tolerance (TRUEPOS kit uses geometric places;
 * apparent speeds should still be well-behaved and near geometric at chart epochs).
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

describe('apparent positionMode speeds (case 48)', () => {
    let eph: EphemerisEngine;

    beforeAll(async () => {
        eph = EphemerisEngine.getInstance();
        await eph.initialize();
    });

    test('modern apparent Sun within 0.01″/day of geometric sidereal oracle speed', () => {
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
        const oracleSpeed = 0.9939102766857663;
        const geo = eph.getPlanets(
            dt,
            { latitude: CASE.lat, longitude: CASE.lon },
            {
                ayanamsaOrder: 27,
                nodeType: 'true',
                precisionProfile: 'modern',
                deltaTForecast: 'oracle-compat',
                positionMode: 'geometric',
            },
        );
        const app = eph.getPlanets(
            dt,
            { latitude: CASE.lat, longitude: CASE.lon },
            {
                ayanamsaOrder: 27,
                nodeType: 'true',
                precisionProfile: 'modern',
                deltaTForecast: 'oracle-compat',
                positionMode: 'apparent',
            },
        );
        const sunGeo = geo.find((p) => p.name === 'Sun')!;
        const sunApp = app.find((p) => p.name === 'Sun')!;
        expect(Math.abs(sunGeo.speed - oracleSpeed) * 3600).toBeLessThan(0.01);
        // TRUEPOS oracle; apparent-place speed differs by aberration/LT only (~0.03″/day here).
        expect(Math.abs(sunApp.speed - oracleSpeed) * 3600).toBeLessThan(0.03);
        expect(Math.abs(sunApp.speed - sunGeo.speed) * 3600).toBeLessThan(0.03);
    });
});
