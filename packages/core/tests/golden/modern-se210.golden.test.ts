/**
 * 'modern' precision profile — parity with Swiss Ephemeris 2.10.
 *
 * Expected values come from pyswisseph 2.10.03 on the DE431-based .se1 files
 * (never the Moshier fallback), with SE_SIDM_TRUE_CITRA, TRUEPOS sidereal
 * bodies, swe_get_ayanamsa_ut and swe_houses_ex(SEFLG_SIDEREAL). See the
 * fixture's `provenance` block and tools/modern-golden/. The fixture is a test
 * oracle only; no engine code reads it.
 *
 * (a) Cases dated within the observed ΔT record (up to 1 Jan 2026): every
 *     sidereal graha, both nodes, the ayanamsa, the ascendant, the MC and all
 *     twelve cusps of Whole Sign, Equal, Placidus and Porphyry must be
 *     strictly under 1″, with the profile's own ΔT model.
 *
 * (b) Cases dated after the observed record: ΔT there is a prediction, and
 *     'modern' deliberately does not copy SE 2.10's undocumented post-record
 *     extrapolation. These cases inject the oracle's own ΔT (recorded in the
 *     fixture as test data) through deltaTOverrideSeconds and assert < 1″.
 *     This VALIDATES EVERYTHING EXCEPT PREDICTED ΔT.
 *
 * Cases outside DE440s must throw a RangeError without long-range chunks;
 * with the DE431 chunks of #260 present they are checked under (a) as well,
 * otherwise skipped (pending #260), not failed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { EphemerisEngine, type PrecisionOptions } from '../../src/engine/ephemeris.js';
import { decimalYear, deltaT, LAST_OBSERVED_YEAR_MODERN } from '../../src/engine/deltat.js';
import { De431ChunkStore, nodeFsChunkLoader } from '../../src/engine/provider/index.js';

interface SeHouses {
    ret: number;
    asc: number;
    mc: number;
    cusps: number[];
}
interface SeCase {
    id: number;
    tag: string;
    utc: string;
    lat: number;
    lon: number;
    jdUT: number;
    deltaTSeconds: number;
    ayanamsa: number;
    bodies: Record<string, number>;
    houses: Record<'W' | 'E' | 'P' | 'O', SeHouses>;
}

const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/modern_se210_golden.json', import.meta.url), 'utf8'),
) as { cases: SeCase[] };

/** Strictly under 1″. Anything ≥ 1″ is a failure. */
const LIMIT_ARCSEC = 1;
/**
 * ΔT agreement with SE 2.10 inside the observed record, seconds of time.
 * From 1955 both use the same observations. Before 1955 SE applies an
 * undocumented smoothing blend that 'modern' omits (≤ 0.66 s, ≈ 0.36″ Moon).
 */
const DELTA_T_LIMIT_OBSERVED_S = 0.05;
const DELTA_T_LIMIT_PRE1955_S = 0.7;
/** DE440s coverage, JD(UT) with a day of margin for ΔT. */
const DE440S_FIRST = 2396758.5 + 1;
const DE440S_LAST = 2506331.5 - 1;

const GRAHAS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
const SYSTEMS = ['W', 'E', 'P', 'O'] as const;
const MODERN: PrecisionOptions = { precisionProfile: 'modern' };

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

const inRange = (c: SeCase) => c.jdUT > DE440S_FIRST && c.jdUT < DE440S_LAST;
const observed = (c: SeCase) => decimalYear(c.jdUT) <= LAST_OBSERVED_YEAR_MODERN;

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 30_000);

describe('SE 2.10 goldens — fixture', () => {
    test('covers the full random set', () => {
        expect(fixture.cases.length).toBe(340);
        expect(fixture.cases.filter(inRange).filter(observed).length).toBeGreaterThanOrEqual(100);
        expect(
            fixture.cases.filter(inRange).filter((c) => !observed(c)).length,
        ).toBeGreaterThanOrEqual(100);
    });
});

/** Largest gap per output and every gap that is not strictly under 1″. */
function parity(
    eng: EphemerisEngine,
    c: SeCase,
    precision: PrecisionOptions,
): { failures: string[]; max: number } {
    const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
    const jd = eng.julday(utc);
    expect(Math.abs(jd - c.jdUT) * 86400).toBeLessThan(1e-3);

    const failures: string[] = [];
    let max = 0;
    const check = (label: string, got: number, expected: number) => {
        const err = gapArcsec(got, expected);
        max = Math.max(max, err);
        if (!(err < LIMIT_ARCSEC)) failures.push(`${label} ${err.toFixed(3)}″`);
    };

    check('ayanamsa', eng.getAyanamsa(jd, 27, 0, undefined, precision), c.ayanamsa);

    const loc = { latitude: c.lat, longitude: c.lon };
    const lon = (nodeType: 'mean' | 'true') =>
        new Map(
            eng
                .getPlanets(utc, loc, { ayanamsaOrder: 27, nodeType, ...precision })
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
        const got = eng.getHouses(jd, c.lat, c.lon, s, true, 27, 0, undefined, precision);
        const exp = c.houses[s];
        check(`${s} asc`, got.ascendant, exp.asc);
        check(`${s} mc`, got.mc, exp.mc);
        exp.cusps.forEach((v, i) => check(`${s} cusp ${i + 1}`, got.cusps[i], v));
    }
    return { failures, max };
}

function deltaTGap(c: SeCase): number {
    return Math.abs(deltaT(c.jdUT, 'modern') - c.deltaTSeconds);
}

describe.each(fixture.cases.filter(inRange).filter(observed))(
    '(a) modern parity, observed ΔT — #$id $tag $utc',
    (c) => {
        test("every output is < 1″ from SE 2.10 with modern's own ΔT", () => {
            const limit =
                decimalYear(c.jdUT) < 1955 ? DELTA_T_LIMIT_PRE1955_S : DELTA_T_LIMIT_OBSERVED_S;
            expect(deltaTGap(c)).toBeLessThan(limit);
            expect(parity(engine, c, MODERN).failures).toEqual([]);
        });
    },
);

describe.each(fixture.cases.filter(inRange).filter((c) => !observed(c)))(
    '(b) modern parity, oracle ΔT injected (validates everything except predicted ΔT) — #$id $tag $utc',
    (c) => {
        test('every output is < 1″ from SE 2.10 with deltaTOverrideSeconds = SE ΔT', () => {
            const precision = { ...MODERN, deltaTOverrideSeconds: c.deltaTSeconds };
            expect(parity(engine, c, precision).failures).toEqual([]);
        });
    },
);

const outOfRange = fixture.cases.filter((c) => !inRange(c));
/** DE431 chunks from @node-jhora/ephe-long (opt-in; see packages/ephe-long/README.md). */
const chunkDir =
    process.env.NJCE_DIR ?? fileURLToPath(new URL('../../../ephe-long/dist', import.meta.url));
const haveChunks =
    existsSync(join(chunkDir, 'g0-c18.njce')) && existsSync(join(chunkDir, 'g1-c21.njce'));

describe.each(outOfRange)('outside DE440s — #$id $utc', (c) => {
    test('throws a RangeError naming the supported range without long-range chunks', () => {
        const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
        expect(() => engine.getPlanets(utc, undefined, { ayanamsaOrder: 27, ...MODERN })).toThrow(
            RangeError,
        );
    });
});

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

    test.each(outOfRange.filter(observed))(
        '(a) #$id $utc every output is < 1″ from SE 2.10',
        (c) => {
            expect(deltaTGap(c)).toBeLessThan(DELTA_T_LIMIT_PRE1955_S);
            expect(parity(longEngine, c, MODERN).failures).toEqual([]);
        },
    );
    test.each(outOfRange.filter((c) => !observed(c)))(
        '(b) #$id $utc every output is < 1″ with oracle ΔT injected (excludes predicted ΔT)',
        (c) => {
            const precision = { ...MODERN, deltaTOverrideSeconds: c.deltaTSeconds };
            expect(parity(longEngine, c, precision).failures).toEqual([]);
        },
    );
});
