import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { computeVertex, trueObliquity } from '../../src/engine/coordinates.js';
import { EphemerisEngine, type PrecisionOptions } from '../../src/engine/ephemeris.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../../../ephe/de440s.bsp', import.meta.url))),
);

const LIMIT_ARCSEC = 1;

const J2000_JD = 2451545.0;

const latitudePins = JSON.parse(
    readFileSync(new URL('../fixtures/vertex_se210_latitude_pins.json', import.meta.url), 'utf8'),
) as {
    samples: { lat: number; vertex: number }[];
};

const sweepPins = JSON.parse(
    readFileSync(new URL('../fixtures/vertex_sweep_pins.json', import.meta.url), 'utf8'),
) as {
    samples: {
        jd: number;
        lat: number;
        lon: number;
        deltaTJhora: number;
        deltaTModern: number;
        jhoraVertex: number;
        modernVertex: number;
    }[];
};

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

describe('Vertex — precision profiles vs oracles', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize({ kernel });
    });

    describe('modern profile (pyswisseph 2.10 / SE_SIDM_TRUE_CITRA sidereal houses)', () => {
        const modern: PrecisionOptions = { precisionProfile: 'modern' };

        test.each(latitudePins.samples.map((s) => [s.lat, s.vertex] as const))(
            'φ = %s° at J2000 within 1″ of SE 2.10 sidereal vertex',
            (lat, vertex) => {
                const got = engine.getHouses(J2000_JD, lat, 0, 'W', true, 27, 0, undefined, modern);
                expect(gapArcsec(got.vertex, vertex)).toBeLessThan(LIMIT_ARCSEC);
            },
        );
    });

    describe('jhora profile (JHora DLL sweep oracle)', () => {
        const jhora: PrecisionOptions = { precisionProfile: 'jhora' };

        test.each(sweepPins.samples.map((s) => [s.id, s.lat, s] as const))(
            'sweep case #%i φ = %s° within 1″ of DLL oracle (oracle ΔT)',
            (_id, _lat, sample) => {
                const got = engine.getHouses(
                    sample.jd,
                    sample.lat,
                    sample.lon,
                    'W',
                    true,
                    27,
                    0,
                    undefined,
                    { ...jhora, deltaTOverrideSeconds: sample.deltaTJhora },
                );
                expect(gapArcsec(got.vertex, sample.jhoraVertex)).toBeLessThan(LIMIT_ARCSEC);
            },
        );
    });

    describe('modern profile sweep oracle (oracle ΔT)', () => {
        const modern: PrecisionOptions = { precisionProfile: 'modern' };

        test.each(sweepPins.samples.map((s) => [s.id, s.lat, s] as const))(
            'sweep case #%i φ = %s° within 1″ of pyswisseph oracle',
            (_id, _lat, sample) => {
                const got = engine.getHouses(
                    sample.jd,
                    sample.lat,
                    sample.lon,
                    'W',
                    true,
                    27,
                    0,
                    undefined,
                    { ...modern, deltaTOverrideSeconds: sample.deltaTModern },
                );
                expect(gapArcsec(got.vertex, sample.modernVertex)).toBeLessThan(LIMIT_ARCSEC);
            },
        );
    });

    test('tropical vertex is identical across profiles at equator and high latitude', () => {
        const lats = [0, 0.0001, -0.5, 60, 89.9];
        for (const lat of lats) {
            const j = engine.getHouses(J2000_JD, lat, 0, 'W', false, 27, 0, undefined, {
                precisionProfile: 'jhora',
            });
            const m = engine.getHouses(J2000_JD, lat, 0, 'W', false, 27, 0, undefined, {
                precisionProfile: 'modern',
            });
            // Profiles use different ΔT at J2000; tropical vertex should still match within float noise.
            expect(gapArcsec(j.vertex, m.vertex)).toBeLessThan(1e-6);
        }
    });

    test('φ = 0 tropical vertex matches SE equator limit (180°) within 0.3″', () => {
        const eps = trueObliquity(J2000_JD);
        const ramc = 280.457072438026;
        const v = computeVertex(ramc, 0, eps);
        expect(gapArcsec(v, 180)).toBeLessThanOrEqual(0.3);
    });
});
