import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { NodeJHoraError, NodeJHoraErrorCode } from '../../src/errors.js';
import {
    BODY_GROUP_PLANETS,
    De431ChunkFile,
    De431LongEphemerisProvider,
    DE431_LONG_JD_TDB_END,
    DE431_LONG_JD_TDB_START,
} from '../../src/engine/provider/de431-chunk.js';
import {
    NJCE_TT_JD_MAX_REQUIRED,
    NJCE_TT_JD_MIN_REQUIRED,
} from '../../src/engine/provider/chunk-coverage.js';
import { jdTdbToEt } from '../../src/engine/provider/time.js';
import { NAIF } from '../../src/engine/spk.js';

const chunkDir =
    process.env.NJCE_DIR ??
    join(fileURLToPath(new URL('../../../ephe-long/dist', import.meta.url)));

function loadChunk(century: number, groupId: number): De431ChunkFile | undefined {
    try {
        const buf = readFileSync(join(chunkDir, `g${groupId}-c${century}.njce`));
        return new De431ChunkFile(
            buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        );
    } catch {
        return undefined;
    }
}

describe('NJCE chunk coverage constants', () => {
    test('advertised TT JD limits match DE431_LONG coverage', () => {
        expect(DE431_LONG_JD_TDB_START).toBe(NJCE_TT_JD_MIN_REQUIRED);
        expect(DE431_LONG_JD_TDB_END).toBe(NJCE_TT_JD_MAX_REQUIRED);
    });
});

describe('De431ChunkFile segment bounds', () => {
    test('never evaluates ET outside a copied Chebyshev record (no clamping)', () => {
        const chunk = loadChunk(19, BODY_GROUP_PLANETS);
        if (!chunk) {
            return;
        }
        const span = chunk.etSpanSeconds();
        expect(span).toBeDefined();
        const etPastEnd = span!.end + 1e7;
        expect(() => chunk.getState(NAIF.Sun, NAIF.SSB, etPastEnd)).toThrow(NodeJHoraError);
        try {
            chunk.getState(NAIF.Sun, NAIF.SSB, etPastEnd);
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE });
        }
    });

    test('coversGroupAtEt is false when any group body lacks a segment', () => {
        const chunk = loadChunk(19, BODY_GROUP_PLANETS);
        if (!chunk) {
            return;
        }
        const span = chunk.etSpanSeconds()!;
        const etMid = (span.start + span.end) / 2;
        expect(chunk.coversGroupAtEt(BODY_GROUP_PLANETS, etMid)).toBe(true);
        expect(chunk.coversGroupAtEt(BODY_GROUP_PLANETS, span.end + 1e6)).toBe(false);
    });
});

describe('De431LongEphemerisProvider', () => {
    test('throws EPHEMERIS_UNAVAILABLE when no chunk brackets the epoch', () => {
        const chunk = loadChunk(19, BODY_GROUP_PLANETS);
        if (!chunk) {
            return;
        }
        const provider = new De431LongEphemerisProvider((c, g) =>
            c === 19 && g === BODY_GROUP_PLANETS ? chunk : undefined,
        );
        const jdInside = 2_451_545.0;
        expect(() => provider.state(jdInside, NAIF.Sun, 'barycentric')).not.toThrow();
        const jdOutside = 2_451_545.0 + 1e9;
        expect(() => provider.state(jdOutside, NAIF.Sun, 'barycentric')).toThrow(NodeJHoraError);
    });
});

(haveEdgeChunks() ? describe : describe.skip)(
    'built NJCE files bracket advertised TT edges (requires extended build)',
    () => {
        test('century 99 or 100 group g0 covers NJCE_TT_JD_MAX_REQUIRED', () => {
            const et = jdTdbToEt(NJCE_TT_JD_MAX_REQUIRED);
            const c99 = loadChunk(99, BODY_GROUP_PLANETS);
            const c100 = loadChunk(100, BODY_GROUP_PLANETS);
            const ok =
                c99?.coversGroupAtEt(BODY_GROUP_PLANETS, et) ||
                c100?.coversGroupAtEt(BODY_GROUP_PLANETS, et);
            expect(ok).toBe(true);
        });

        test('century -100 group g0 covers NJCE_TT_JD_MIN_REQUIRED', () => {
            const et = jdTdbToEt(NJCE_TT_JD_MIN_REQUIRED);
            const c = loadChunk(-100, BODY_GROUP_PLANETS);
            expect(c?.coversGroupAtEt(BODY_GROUP_PLANETS, et)).toBe(true);
        });
    },
);

function haveEdgeChunks(): boolean {
    return Boolean(loadChunk(19, BODY_GROUP_PLANETS));
}
