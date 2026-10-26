/**
 * JHora parity — the hard < 1″ contract.
 *
 * Expected values come from the Swiss Ephemeris 2.02.01 DLL that ships inside
 * Jagannatha Hora 8.0, called with JHora's own conventions (see the
 * `provenance` block of the fixture and tools/jhora-dll-golden/). The fixture
 * is a test oracle only; no engine code reads it.
 *
 * Every sidereal graha, both nodes, the ayanamsa, the ascendant, the MC and
 * all twelve cusps of Equal, Placidus and Porphyry must stay strictly under
 * 1″. Whole-sign cusps are JHora's sidereal "each rasi a house", i.e. the
 * sign of the DLL ascendant (SE's own 'W' uses the tropical sign, which JHora
 * does not display). ΔT is checked separately in seconds of time.
 *
 * Cases outside DE440s (1849-12-26 … 2150-01-22) must throw EPHEMERIS_UNAVAILABLE;
 * their parity checks are skipped pending #260 (long-range ephemeris), not
 * failed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { deltaT } from '../../src/engine/deltat.js';
import { De431ChunkStore, nodeFsChunkLoader } from '../../src/engine/provider/index.js';

interface DllHouses {
    ret: number;
    asc: number;
    mc: number;
    cusps: number[];
}
interface DllCase {
    id: number;
    tag: string;
    utc: string;
    lat: number;
    lon: number;
    jdUT: number;
    deltaTSeconds: number;
    ayanamsa: number;
    bodies: Record<string, number>;
    houses: Record<'W' | 'E' | 'P' | 'O', DllHouses>;
}

const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/jhora_dll_golden.json', import.meta.url), 'utf8'),
) as { cases: DllCase[] };

/** Strictly under 1″. Anything ≥ 1″ is a failure. */
const LIMIT_ARCSEC = 1;
/** ΔT agreement with the DLL, seconds of time (≈0.004″ of Moon motion per 0.3 s). */
const DELTA_T_LIMIT_S = 0.3;
/** DE440s coverage, JD(UT) with a day of margin for ΔT. */
const DE440S_FIRST = 2396758.5 + 1;
const DE440S_LAST = 2506331.5 - 1;

const GRAHAS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
const SYSTEMS = ['W', 'E', 'P', 'O'] as const;

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

const inRange = (c: DllCase) => c.jdUT > DE440S_FIRST && c.jdUT < DE440S_LAST;

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 30_000);

describe('JHora DLL goldens — fixture', () => {
    test('covers the full random set', () => {
        expect(fixture.cases.length).toBe(340);
        expect(fixture.cases.filter(inRange).length).toBeGreaterThanOrEqual(300);
    });
});

/** Every output's gap to the DLL that is not strictly under 1″ (and ΔT/JD drift). */
function parityFailures(engine: EphemerisEngine, c: DllCase): string[] {
    const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
    const jd = engine.julday(utc);
    expect(Math.abs(jd - c.jdUT) * 86400).toBeLessThan(1e-3);
    expect(Math.abs(deltaT(jd) - c.deltaTSeconds)).toBeLessThan(DELTA_T_LIMIT_S);

    const failures: string[] = [];
    const check = (label: string, got: number, expected: number) => {
        const err = gapArcsec(got, expected);
        if (!(err < LIMIT_ARCSEC)) failures.push(`${label} ${err.toFixed(3)}″`);
    };

    check('ayanamsa', engine.getAyanamsa(jd, 27), c.ayanamsa);

    const loc = { latitude: c.lat, longitude: c.lon };
    const lon = (nodeType: 'mean' | 'true') =>
        new Map(
            engine
                .getPlanets(utc, loc, { ayanamsaOrder: 27, nodeType })
                .map((p) => [p.name, p.longitude]),
        );
    const tru = lon('true');
    const mean = lon('mean');
    for (const g of GRAHAS) check(g, tru.get(g)!, c.bodies[g]);
    check('Rahu true', tru.get('Rahu')!, c.bodies.TrueNode);
    check('Ketu true', tru.get('Ketu')!, c.bodies.TrueNode + 180);
    check('Rahu mean', mean.get('Rahu')!, c.bodies.MeanNode);
    check('Ketu mean', mean.get('Ketu')!, c.bodies.MeanNode + 180);

    for (const s of SYSTEMS) {
        const got = engine.getHouses(jd, c.lat, c.lon, s, true, 27);
        const exp = c.houses[s];
        check(`${s} asc`, got.ascendant, exp.asc);
        check(`${s} mc`, got.mc, exp.mc);
        const cusps =
            s === 'W'
                ? Array.from({ length: 12 }, (_, i) => Math.floor(exp.asc / 30) * 30 + 30 * i)
                : exp.cusps;
        cusps.forEach((v, i) => check(`${s} cusp ${i + 1}`, got.cusps[i], v));
    }

    return failures;
}

describe.each(fixture.cases.filter(inRange))('JHora parity — #$id $tag $utc', (c) => {
    test('every output is < 1″ from the JHora DLL', () => {
        expect(parityFailures(engine, c)).toEqual([]);
    });
});

const outOfRange = fixture.cases.filter((c) => !inRange(c));
/** DE431 chunks from @node-jhora/ephe-long (opt-in; see packages/ephe-long/README.md). */
const chunkDir =
    process.env.NJCE_DIR ?? fileURLToPath(new URL('../../../ephe-long/dist', import.meta.url));
const haveChunks =
    existsSync(join(chunkDir, 'g0-c18.njce')) && existsSync(join(chunkDir, 'g1-c21.njce'));

describe.each(outOfRange)('outside DE440s — #$id $utc', (c) => {
    test('throws EPHEMERIS_UNAVAILABLE naming DE440s without long-range chunks', () => {
        const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
        expect(() => engine.getPlanets(utc, undefined, { ayanamsaOrder: 27 })).toThrow(
            /DE440s coverage/,
        );
    });
});

// Parity for these epochs needs the DE431 long-range chunks of #260, which are
// a 2 GB opt-in build. Skipped (pending #260 data in CI), not failed, when absent.
(haveChunks ? describe : describe.skip)('outside DE440s with DE431 chunks (pending #260)', () => {
    let longEngine: EphemerisEngine;
    beforeAll(async () => {
        const store = new De431ChunkStore(nodeFsChunkLoader(chunkDir));
        await Promise.all(
            outOfRange.map((c) => store.ensureForJd(c.jdUT + c.deltaTSeconds / 86400)),
        );
        longEngine = new EphemerisEngine();
        longEngine.setChunkStore(store);
        await longEngine.initialize();
    }, 120_000);

    test.each(outOfRange)('#$id $utc every output is < 1″ from the JHora DLL', (c) => {
        expect(parityFailures(longEngine, c)).toEqual([]);
    });
});
