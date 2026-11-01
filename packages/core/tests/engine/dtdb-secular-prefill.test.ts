import {
    buildDtdbSecularPrefillTable,
    DTDB_SECULAR_PREFILL_NODE_DAYS,
    maxSecularDtdbInterpErrorSeconds,
    setDtdbSecularPrefillTable,
    setForceExactDtdbSecularPrefillForTests,
} from '../../src/engine/dtdb-secular-prefill.js';
import {
    clearDe441MeanNodeCaches,
    de441SecularMeanNodeDeg,
    setDe441MeanNodeSampler,
} from '../../src/engine/de441-mean-lunar-node.js';
import { createDe441NjceMeanNodeSampler } from '../../src/engine/de441-njce-mean-node.js';
import {
    De441ChunkStore,
    nodeFsChunkLoader,
    prefetchNjceForSecularMeanNode,
    preloadNodeFsChunkLoaderModules,
} from '../../src/engine/provider/index.js';
import { readFileSync } from 'node:fs';

const Y_MINUS_10K = -1_931_455;
const Y_PLUS_10K = 5_256_455;
const HALF_WINDOW_JD = 250 * 365.25;
const DRACONIC_HALF = 6798.383 / 2;

function secularBounds(anchorJd: number): { jdLo: number; jdHi: number } {
    return {
        jdLo: anchorJd - HALF_WINDOW_JD - DRACONIC_HALF,
        jdHi: anchorJd + HALF_WINDOW_JD + DRACONIC_HALF,
    };
}

function signedDeltaArcsec(a: number, b: number): number {
    let d = (a - b) * 3600;
    d = ((d + 5400) % 3600) - 1800;
    return d;
}

const FIXTURE = JSON.parse(
    readFileSync(new URL('../fixtures/truth_deep_era.json', import.meta.url), 'utf8'),
) as {
    de441MeanNode: { id: string; jdTT: number }[];
};

describe('ΔTDB secular prefill cubic Lagrange', () => {
    test('reports max Fairhead ΔTDB interpolation error (seconds) on 4 d grid', () => {
        for (const anchor of [Y_MINUS_10K, Y_PLUS_10K]) {
            const { jdLo, jdHi } = secularBounds(anchor);
            const maxErrSec = maxSecularDtdbInterpErrorSeconds(
                anchor,
                jdLo,
                jdHi,
                DTDB_SECULAR_PREFILL_NODE_DAYS,
                4,
            );
            // eslint-disable-next-line no-console -- PR / ADR evidence
            console.log(
                `dtdbSecularPrefillMaxErrSec anchor=${anchor} nodeDays=${DTDB_SECULAR_PREFILL_NODE_DAYS} maxErrSec=${maxErrSec}`,
            );
            expect(maxErrSec).toBeLessThan(1);
        }
    });

    test('production spacing: Ω vs exact TT→TDB ≤ 1e−6″ per DE441 epoch (NJCE441)', () => {
        const chunkDir = process.env.NJCE441_DIR;
        if (!chunkDir) {
            return;
        }

        const rows: { id: string; omegaDeltaArcsec: number }[] = [];
        let maxOmega = 0;

        return preloadNodeFsChunkLoaderModules().then(async () => {
            const store = new De441ChunkStore(nodeFsChunkLoader(chunkDir), {
                minCentury: -120,
                maxCentury: 160,
            });

            for (const ref of FIXTURE.de441MeanNode) {
                prefetchNjceForSecularMeanNode(store, ref.jdTT);
                setDe441MeanNodeSampler(createDe441NjceMeanNodeSampler(store.asGetter()));

                clearDe441MeanNodeCaches();
                setForceExactDtdbSecularPrefillForTests(true);
                const exact = de441SecularMeanNodeDeg(ref.jdTT);

                clearDe441MeanNodeCaches();
                setForceExactDtdbSecularPrefillForTests(false);
                const { jdLo, jdHi } = secularBounds(ref.jdTT);
                setDtdbSecularPrefillTable(
                    buildDtdbSecularPrefillTable(
                        ref.jdTT,
                        jdLo,
                        jdHi,
                        DTDB_SECULAR_PREFILL_NODE_DAYS,
                    ),
                );
                const interp = de441SecularMeanNodeDeg(ref.jdTT);
                setDtdbSecularPrefillTable(undefined);

                const delta = Math.abs(signedDeltaArcsec(interp!, exact!));
                rows.push({ id: ref.id, omegaDeltaArcsec: delta });
                maxOmega = Math.max(maxOmega, delta);
                expect(delta).toBeLessThanOrEqual(1e-6);
            }

            // eslint-disable-next-line no-console -- PR evidence
            console.log(
                'dtdbSecularPrefillOmegaDeltaArcsec',
                JSON.stringify({
                    nodeDays: DTDB_SECULAR_PREFILL_NODE_DAYS,
                    maxOmegaArcsec: maxOmega,
                    rows,
                }),
            );
        });
    }, 900_000);
});
