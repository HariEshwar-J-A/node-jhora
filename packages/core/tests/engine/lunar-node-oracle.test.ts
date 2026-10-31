/**
 * Hard gate, years 0..2150, against the JHora and modern node oracles.
 *
 * Mean node (Meeus eq. 47.7, geometric True Chitra) — jhora oracle ~0.5″ in DE440s window.
 * True-node longitude is under 1″ and true-node speed is under 1″/day on
 * every case that can be evaluated, including years 0..414.
 *
 * Dates inside DE440s always run. Dates before that need the optional DE431
 * chunks (packages/ephe-long/dist); without them that block is skipped, the
 * same way the SE 2.10 golden treats long-range dates. The mean-node gate
 * does not need chunks and is never skipped.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { De431ChunkStore, nodeFsChunkLoader } from '../../src/engine/provider/index.js';
import {
    NODE_CASES,
    MEAN_MODES,
    civilUtc,
    decimalYearOf,
    gapArcsec,
    inDe440s,
    inWindow,
    fixtureJd,
    meanSidereal,
    oracleOf,
    trueNode,
    trueNodeModes,
    type NodeCase,
    type NodeMode,
} from './lunar-node-oracle-support.js';

const LIMIT_MEAN_ARCSEC: Record<NodeMode, number> = {
    J: 0.55,
    Jo: 0.55,
    M: 0.65,
    Mo: 0.65,
};

const chunkDir =
    process.env.NJCE_DIR ?? fileURLToPath(new URL('../../../ephe-long/dist', import.meta.url));
const haveChunks =
    existsSync(join(chunkDir, 'g0-c18.njce')) && existsSync(join(chunkDir, 'g1-c21.njce'));

const windowCases = NODE_CASES.filter(inWindow);

let engine: EphemerisEngine;
let longEngine: EphemerisEngine | undefined;

beforeAll(async () => {
    engine = new EphemerisEngine();
    await engine.initialize();
    if (!haveChunks) return;
    const store = new De431ChunkStore(nodeFsChunkLoader(chunkDir));
    const outside = windowCases.filter((c) => !inDe440s(c.jd));
    await Promise.all(outside.map((c) => store.ensureForJd(c.jd)));
    longEngine = new EphemerisEngine();
    longEngine.setChunkStore(store);
    await longEngine.initialize();
}, 120_000);

describe('fixture calendar', () => {
    test('proleptic Gregorian labels reproduce the oracle Julian day', () => {
        const failures: string[] = [];
        let max = 0;
        for (const c of NODE_CASES) {
            const jd = fixtureJd(engine, c);
            const days = Math.abs(jd - c.jd);
            max = Math.max(max, days);
            if (!(days < 1e-6)) {
                failures.push(`#${c.id} y=${c.y} Δjd=${days.toExponential(3)} d`);
            }
        }
        expect(failures).toEqual([]);
        expect(max).toBeLessThan(1e-6);
    });
});

/** Published osculating-node floor on DE440s (see true-node-accuracy.golden.test.ts). */
const LIMIT_TRUE_ARCSEC = 0.65;
const LIMIT_TRUE_SPEED_ARCSEC = 0.2;

describe('mean node, years 0..2150', () => {
    test('every jhora and modern comparison is under 1″', () => {
        expect(windowCases.length).toBeGreaterThan(200);
        const failures: string[] = [];
        const max: Record<NodeMode, number> = { J: 0, Jo: 0, M: 0, Mo: 0 };
        for (const c of windowCases) {
            expect(civilUtc(c).isValid).toBe(true);
            for (const mode of MEAN_MODES) {
                const err = gapArcsec(meanSidereal(engine, c, mode), oracleOf(c, mode).mean.lon);
                max[mode] = Math.max(max[mode], err);
                if (!(err < LIMIT_MEAN_ARCSEC[mode]))
                    failures.push(`#${c.id} ${c.y} ${mode} ${err.toFixed(3)}″`);
            }
        }
        expect(failures).toEqual([]);
        for (const mode of MEAN_MODES) expect(max[mode]).toBeLessThan(LIMIT_MEAN_ARCSEC[mode]);
    });
});

function checkTrue(eng: EphemerisEngine, cases: readonly NodeCase[], label: string): void {
    const failures: string[] = [];
    let checked = 0;
    for (const c of cases) {
        const modes = trueNodeModes(decimalYearOf(eng, c));
        for (const mode of modes) {
            const got = trueNode(eng, c, mode);
            const exp = oracleOf(c, mode).true;
            const lon = gapArcsec(got.lon, exp.lon);
            const spd = gapArcsec(got.speed, exp.speed);
            checked += 1;
            if (!(lon < LIMIT_TRUE_ARCSEC))
                failures.push(`${label} #${c.id} ${c.y} ${mode} lon ${lon.toFixed(3)}″`);
            if (!(spd < LIMIT_TRUE_SPEED_ARCSEC))
                failures.push(`${label} #${c.id} ${c.y} ${mode} speed ${spd.toFixed(3)}″/d`);
        }
    }
    expect(checked).toBeGreaterThan(0);
    expect(failures).toEqual([]);
}

describe('true node inside DE440s, years 0..2150', () => {
    test('longitude under 1″ and speed under 1″/day, both oracles', () => {
        checkTrue(
            engine,
            windowCases.filter((c) => inDe440s(c.jd)),
            'de440s',
        );
    });
});

(haveChunks ? describe : describe.skip)(
    'true node before DE440s, years 0..2150 (DE431 chunks)',
    () => {
        test('longitude under 1″ and speed under 1″/day, both oracles', () => {
            checkTrue(
                longEngine!,
                windowCases.filter((c) => !inDe440s(c.jd)),
                'de431',
            );
        });
    },
);

/**
 * The old ~2″ early-CE true-node residual was the ecliptic of date, not the
 * chunk interpolant. On the DE440s span the two kernels must agree closely.
 */
(haveChunks ? describe : describe.skip)('DE431 chunks on the DE440s overlap', () => {
    test('true-node longitude stays within 0.05″ of DE440s', async () => {
        const rows = windowCases.filter((c) => inDe440s(c.jd));
        expect(rows.length).toBeGreaterThan(50);
        const store = new De431ChunkStore(nodeFsChunkLoader(chunkDir));
        await Promise.all(rows.map((c) => store.ensureForJd(c.jd)));
        const de431 = new EphemerisEngine();
        de431.setChunkStore(store);
        de431.setEphemerisPolicy('de431_long');
        await de431.initialize();
        const failures: string[] = [];
        let max = 0;
        for (const c of rows) {
            for (const mode of ['J', 'Jo'] as const) {
                const err = gapArcsec(trueNode(engine, c, mode).lon, trueNode(de431, c, mode).lon);
                max = Math.max(max, err);
                if (!(err < 0.05)) failures.push(`#${c.id} y=${c.y} ${mode} ${err.toFixed(4)}″`);
            }
        }
        expect(failures).toEqual([]);
        expect(max).toBeLessThan(0.05);
    }, 180_000);
});
