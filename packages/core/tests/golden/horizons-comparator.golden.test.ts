/**
 * Integration: Horizons golden cases through @node-jhora/testkit comparator.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DateTime } from 'luxon';
import { parseGoldenCorpus, expectGolden, signedAngleDeltaDegrees } from '@node-jhora/testkit';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { nutation } from '../../src/engine/nutation.js';
import { deltaT } from '../../src/engine/deltat.js';
import { HORIZONS_ENGINE_COMPARE_BODIES } from '../fixtures/horizons_golden.js';

const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../fixtures/horizons.golden.json',
);
const HORIZONS_CASES = parseGoldenCorpus(readFileSync(fixturePath, 'utf8'));

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 30_000);

function actualFor(golden: (typeof HORIZONS_CASES)[number]): Record<string, number> {
    const utc = DateTime.fromISO(golden.input.instant, { zone: 'utc' });
    const jd = engine.julday(utc);
    // Apparent places subtract the apparent ayanamsa, so add that back.
    const ayan = engine.getAyanamsa(jd, undefined, 0, 'apparent');
    const T = (jd + deltaT(jd) / 86400 - 2451545.0) / 36525;
    const dpsi = nutation(T).dpsi;

    const actual: Record<string, number> = {};
    for (const p of engine.getPlanets(utc, undefined, { positionMode: 'apparent' })) {
        const lon = (((p.longitude + ayan + dpsi) % 360) + 360) % 360;
        actual[`horizons.planets.${p.name}.lon`] = lon;
        actual[`horizons.planets.${p.name}.lat`] = p.latitude;
    }
    return actual;
}

function planetPaths(golden: (typeof HORIZONS_CASES)[number]): string[] {
    const compare = new Set<string>(HORIZONS_ENGINE_COMPARE_BODIES);
    return Object.keys(golden.expected).filter((path) => {
        if (!path.startsWith('horizons.planets.')) return false;
        const name = path.slice('horizons.planets.'.length).replace(/\.(lon|lat)$/, '');
        return compare.has(name);
    });
}

describe('Horizons golden comparator', () => {
    for (const golden of HORIZONS_CASES) {
        test(`${golden.id}: apparent longitudes and latitudes`, () => {
            expectGolden(golden, actualFor(golden), { only: planetPaths(golden) });
        });

        // Mutation check: push every arcsecond path 1″ past its tolerance, away
        // from the engine's own residual, so |Δ| > limit. For the 1″ paths
        // that is a 2″ perturbation. Each one alone must fail the case.
        test(`${golden.id}: a perturbation of tolerance + 1″ (2″ on 1″ paths) fails`, () => {
            const actual = actualFor(golden);
            const only = planetPaths(golden);
            let checked = 0;
            for (const path of only) {
                const { value, tolerance } = golden.expected[path];
                if (tolerance.type !== 'arcsec') continue;
                const residual = signedAngleDeltaDegrees(value as number, actual[path]);
                const shift = ((residual >= 0 ? 1 : -1) * (tolerance.arcsec + 1)) / 3600;
                const perturbed = { ...actual, [path]: actual[path] + shift };
                expect(() => expectGolden(golden, perturbed, { only })).toThrow(path);
                checked++;
            }
            expect(checked).toBe(only.length);
        });
    }
});
