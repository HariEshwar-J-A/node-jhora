/**
 * Astrometric parity: DE440 engine vs JPL Horizons.
 *
 * This is the engine's foundation test. It validates the apparent-place chain —
 * ΔT, light-time, gravitational deflection, aberration, precession, nutation —
 * in isolation from any ayanamsa model, by comparing tropical apparent
 * longitudes against JPL Horizons across the full de440s.bsp date range.
 *
 * The engine reports sidereal longitudes in the *mean* ecliptic of date, so the
 * comparison adds back the ayanamsa and the nutation in longitude to recover the
 * apparent (true-equinox) value that Horizons publishes.
 */

import { DateTime }        from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { nutation }        from '../../src/engine/nutation.js';
import { deltaT }          from '../../src/engine/deltat.js';
import {
    HORIZONS_EPOCHS,
    TOLERANCE_ARCSEC,
    FUTURE_TOLERANCE_ARCSEC,
    LAST_OBSERVED_DELTAT_YEAR,
} from '../fixtures/horizons_golden.js';

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 30_000);

/** Signed angular difference a − b, wrapped to (−180, 180], in arcseconds. */
function deltaArcsec(a: number, b: number): number {
    let d = a - b;
    if (d >  180) d -= 360;
    if (d < -180) d += 360;
    return d * 3600;
}

describe.each(HORIZONS_EPOCHS)('Horizons parity — $label', (epoch) => {
    let apparent: Map<string, { lon: number; lat: number }>;

    // Past ΔT is measured, future ΔT is guesswork — and Horizons freezes it
    // rather than extrapolating, so future epochs get their own budget.
    const tol = epoch.utc.year <= LAST_OBSERVED_DELTAT_YEAR
        ? TOLERANCE_ARCSEC
        : FUTURE_TOLERANCE_ARCSEC;

    beforeAll(() => {
        const utc  = DateTime.fromObject(epoch.utc, { zone: 'utc' });
        const jd   = engine.julday(utc);
        const ayan = engine.getAyanamsa(jd);
        const T    = (jd + deltaT(jd) / 86400 - 2451545.0) / 36525;
        const dpsi = nutation(T).dpsi;

        apparent = new Map();
        // Horizons publishes apparent places; the engine defaults to geometric
        // for JHora parity, so this comparison must ask for apparent explicitly.
        for (const p of engine.getPlanets(utc, undefined, { positionMode: 'apparent' })) {
            // sidereal (mean equinox) → tropical apparent (true equinox)
            apparent.set(p.name, {
                lon: ((p.longitude + ayan + dpsi) % 360 + 360) % 360,
                lat: p.latitude,
            });
        }
    });

    test('engine JD matches the fixture JD', () => {
        const jd = engine.julday(DateTime.fromObject(epoch.utc, { zone: 'utc' }));
        expect(Math.abs(jd - epoch.jd)).toBeLessThan(1e-6);
    });

    for (const body of epoch.bodies) {
        test(`${body.name} longitude within ${tol.longitude}″`, () => {
            const got = apparent.get(body.name);
            expect(got).toBeDefined();
            expect(Math.abs(deltaArcsec(got!.lon, body.lon)))
                .toBeLessThanOrEqual(tol.longitude);
        });

        test(`${body.name} latitude within ${tol.latitude}″`, () => {
            const got = apparent.get(body.name);
            expect(got).toBeDefined();
            expect(Math.abs((got!.lat - body.lat) * 3600))
                .toBeLessThanOrEqual(tol.latitude);
        });
    }
});

// ---------------------------------------------------------------------------
// Regression guards for the specific defects this rewrite fixed
// ---------------------------------------------------------------------------

describe('Astrometry regression guards', () => {
    const utc = DateTime.fromObject(HORIZONS_EPOCHS[2].utc, { zone: 'utc' });

    test('ΔT is applied — 1998 value is ~63 s, not zero', () => {
        const jd = engine.julday(utc);
        expect(engine.getDeltaT(jd)).toBeGreaterThan(60);
        expect(engine.getDeltaT(jd)).toBeLessThan(66);
    });

    test('daily motion is physically correct (Moon ≈ 11–15°/day)', () => {
        const moon = engine.getPlanets(utc, undefined, { positionMode: 'apparent' }).find(p => p.name === 'Moon')!;
        expect(Math.abs(moon.speed)).toBeGreaterThan(11);
        expect(Math.abs(moon.speed)).toBeLessThan(15.5);
    });

    test('retrogression is detected — Mercury is retrograde on 1998-12-06', () => {
        const mercury = engine.getPlanets(utc, undefined, { positionMode: 'apparent' }).find(p => p.name === 'Mercury')!;
        expect(mercury.speed).toBeLessThan(0);
    });

    test('the Sun is never retrograde', () => {
        for (const epoch of HORIZONS_EPOCHS) {
            const sun = engine
                .getPlanets(DateTime.fromObject(epoch.utc, { zone: 'utc' }), undefined, { positionMode: 'apparent' })
                .find(p => p.name === 'Sun')!;
            expect(sun.speed).toBeGreaterThan(0.9);
            expect(sun.speed).toBeLessThan(1.1);
        }
    });

    test('Ketu is exactly 180° from Rahu at every epoch', () => {
        for (const epoch of HORIZONS_EPOCHS) {
            const ps   = engine.getPlanets(DateTime.fromObject(epoch.utc, { zone: 'utc' }));
            const rahu = ps.find(p => p.name === 'Rahu')!;
            const ketu = ps.find(p => p.name === 'Ketu')!;
            expect(Math.abs(Math.abs(rahu.longitude - ketu.longitude) - 180)).toBeLessThan(1e-9);
        }
    });

    test('the mean node regresses; the true node oscillates about it', () => {
        const mean = engine.getPlanets(utc, undefined, { nodeType: 'mean' })
            .find(p => p.name === 'Rahu')!;
        const tru  = engine.getPlanets(utc, undefined, { nodeType: 'true' })
            .find(p => p.name === 'Rahu')!;

        expect(mean.speed).toBeLessThan(0);
        // nodeType was previously ignored, so the two were bit-identical
        expect(tru.longitude).not.toBeCloseTo(mean.longitude, 6);
        // ...but the true node stays within ~1.6° of the mean node
        let d = tru.longitude - mean.longitude;
        if (d >  180) d -= 360;
        if (d < -180) d += 360;
        expect(Math.abs(d)).toBeLessThan(2.0);
    });
});
