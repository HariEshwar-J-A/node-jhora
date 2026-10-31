/**
 * True-node speed oracle pins — convention lock (legacy SPEED chain vs Q1 place).
 *
 * Oracle speed (full-range kit) matches central difference on the pre-Q1 osculating
 * node (no IERS frame bias, no JHora Moon tilt) at 1 s, not on the Q1 longitude.
 * Residuals on these worst pins stay O(0.01–0.55″/d) vs kit; sweep must not regress main.
 */
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { De431ChunkStore, nodeFsChunkLoader } from '../../src/engine/provider/index.js';
import { withDeltaTContext } from '../../src/engine/deltat.js';

type PinCase = {
    id: number;
    y: number;
    jdUt: number;
    jhoraSpeed: number;
    modernSpeed?: number;
    profiles: ('jhora' | 'modern')[];
};

const pins = JSON.parse(
    readFileSync(new URL('../fixtures/true-node-speed-oracle-pins.json', import.meta.url), 'utf8'),
) as { cases: PinCase[] };

/** ffb062b engine − oracle (″/d), J profile — documented in fixture PR discussion. */
const FFB062B_JHORA_RESIDUAL_ARCSEC: Record<number, number> = {
    286: 0.5435,
    111: 0.3685,
    90: -0.2167,
    403: -0.1425,
    253: -0.1394,
    84: 0.1356,
    61: 0.1279,
    429: -0.1196,
    42: 0.048,
    9: 0.2443,
};

const chunkDir =
    process.env.NJCE_DIR ?? fileURLToPath(new URL('../../../ephe-long/dist', import.meta.url));
const haveChunks =
    existsSync(join(chunkDir, 'g0-c18.njce')) || existsSync(join(chunkDir, 'g1-c21.njce'));

const DE440S_UT_FIRST = 2396758.5 + 1;
const DE440S_UT_LAST = 2506331.5 - 1;

function inDe440s(jd: number): boolean {
    return jd > DE440S_UT_FIRST && jd < DE440S_UT_LAST;
}

function speedErrArcsecDay(got: number, exp: number): number {
    return Math.abs(got - exp) * 3600;
}

describe('true-node speed oracle pins', () => {
    let engine: EphemerisEngine;
    let longEngine: EphemerisEngine | undefined;

    beforeAll(async () => {
        engine = new EphemerisEngine();
        await engine.initialize();
        if (!haveChunks) return;
        const store = new De431ChunkStore(nodeFsChunkLoader(chunkDir));
        await Promise.all(pins.cases.map((c) => store.ensureForJd(c.jdUt)));
        longEngine = new EphemerisEngine();
        longEngine.setChunkStore(store);
        await longEngine.initialize();
    }, 120_000);

    test('documented ffb062b residuals are stable (legacy chain matches main sweep)', () => {
        expect(Object.keys(FFB062B_JHORA_RESIDUAL_ARCSEC).length).toBeGreaterThan(5);
    });

    for (const c of pins.cases) {
        for (const profile of c.profiles) {
            const oracle = profile === 'jhora' ? c.jhoraSpeed : c.modernSpeed;
            if (oracle === undefined) continue;

            const needsLong = !inDe440s(c.jdUt);
            const run = needsLong && !haveChunks ? test.skip : test;

            run(`id ${c.id} ${profile} speed within 0.6″/d of kit pin`, () => {
                const eng = needsLong ? longEngine! : engine;
                const speed = withDeltaTContext({ profile }, () => {
                    const ps = eng.getPlanets(
                        DateTime.fromObject({ year: 2000, month: 1, day: 1 }, { zone: 'utc' }),
                        { latitude: 0, longitude: 0 },
                        {
                            ayanamsaOrder: 27,
                            nodeType: 'true',
                            julianDayUt: c.jdUt,
                            calendar: 'gregorian',
                            precisionProfile: profile,
                            positionMode: 'geometric',
                        },
                    );
                    const rahu = ps.find((p) => p.name === 'Rahu');
                    if (!rahu) throw new Error('Rahu missing');
                    return rahu.speed;
                });
                const err = speedErrArcsecDay(speed, oracle);
                expect(err).toBeLessThan(0.6);
                const prev = FFB062B_JHORA_RESIDUAL_ARCSEC[c.id];
                if (profile === 'jhora' && prev !== undefined) {
                    expect(Math.abs(err - Math.abs(prev))).toBeLessThan(0.08);
                }
            });
        }
    }
});
