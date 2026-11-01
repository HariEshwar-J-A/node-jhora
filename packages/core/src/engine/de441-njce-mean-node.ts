/**
 * DE441 secular mean-node sampler from NJCE441 chunks (same Chebyshev records as BSP).
 */

import type { De441MeanNodeSampler } from './de441-mean-lunar-node.js';
import { eraDtdbGeocenterSecondsSecularPrefill } from './dtdb-secular-prefill.js';
import type { De431ChunkFile } from './provider/de431-chunk.js';
import { BODY_GROUP_EMB } from './provider/de431-chunk.js';
import { DE441_NATIVE_JD_TDB_END, DE441_NATIVE_JD_TDB_START } from './provider/de441-chunk.js';
import {
    createNjceMoonSeqScratch,
    njceEmbChunkAtJdTdb,
    njceMoonGeocentricRelativeAtEt,
    njceResetMoonSeqScratch,
} from './provider/njce-mean-node-chunk.js';
import { J2000_JD, SECONDS_PER_DAY } from './provider/time.js';
import type { EphemerisState } from './provider/types.js';

export function createDe441NjceMeanNodeSampler(
    getChunk: (century: number, groupId: number) => De431ChunkFile | undefined,
): De441MeanNodeSampler {
    let cachedChunk: De431ChunkFile | undefined;
    const seqScratch = createNjceMoonSeqScratch();

    function moonGeocentricState(jdTdb: number): EphemerisState | null {
        if (jdTdb < DE441_NATIVE_JD_TDB_START || jdTdb > DE441_NATIVE_JD_TDB_END) {
            return null;
        }
        const et = (jdTdb - J2000_JD) * SECONDS_PER_DAY;
        try {
            let chunk = cachedChunk;
            if (!chunk?.coversGroupAtEt(BODY_GROUP_EMB, et)) {
                chunk = njceEmbChunkAtJdTdb(getChunk, jdTdb);
                cachedChunk = chunk;
            }
            return njceMoonGeocentricRelativeAtEt(chunk, et, seqScratch);
        } catch {
            cachedChunk = undefined;
            return null;
        }
    }

    function fillEpochGridSamples(
        anchorJdTT: number,
        nMin: number,
        nMax: number,
        stepDays: number,
        visit: (jdTT: number, state: EphemerisState) => void,
    ): void {
        cachedChunk = undefined;
        let chunk: De431ChunkFile | undefined;
        const scratch = createNjceMoonSeqScratch();
        for (let n = nMin; n <= nMax; n++) {
            const jdTT = anchorJdTT + n * stepDays;
            const jdTdb = jdTT + eraDtdbGeocenterSecondsSecularPrefill(jdTT) / 86400.0;
            if (jdTdb < DE441_NATIVE_JD_TDB_START || jdTdb > DE441_NATIVE_JD_TDB_END) {
                continue;
            }
            const et = (jdTdb - J2000_JD) * SECONDS_PER_DAY;
            try {
                if (!chunk?.coversGroupAtEt(BODY_GROUP_EMB, et)) {
                    chunk = njceEmbChunkAtJdTdb(getChunk, jdTdb);
                    njceResetMoonSeqScratch(scratch);
                }
                visit(jdTT, njceMoonGeocentricRelativeAtEt(chunk, et, scratch));
            } catch {
                chunk = undefined;
                cachedChunk = undefined;
            }
        }
        cachedChunk = chunk;
    }

    function fillSortedJdSamples(
        jdTTList: readonly number[],
        visit: (jdTT: number, state: EphemerisState) => void,
    ): void {
        cachedChunk = undefined;
        let chunk: De431ChunkFile | undefined;
        const scratch = createNjceMoonSeqScratch();
        for (const jdTT of jdTTList) {
            const jdTdb = jdTT + eraDtdbGeocenterSecondsSecularPrefill(jdTT) / 86400.0;
            if (jdTdb < DE441_NATIVE_JD_TDB_START || jdTdb > DE441_NATIVE_JD_TDB_END) {
                continue;
            }
            const et = (jdTdb - J2000_JD) * SECONDS_PER_DAY;
            try {
                if (!chunk?.coversGroupAtEt(BODY_GROUP_EMB, et)) {
                    chunk = njceEmbChunkAtJdTdb(getChunk, jdTdb);
                    njceResetMoonSeqScratch(scratch);
                }
                visit(jdTT, njceMoonGeocentricRelativeAtEt(chunk, et, scratch));
            } catch {
                chunk = undefined;
                cachedChunk = undefined;
            }
        }
        cachedChunk = chunk;
    }

    return {
        jdTdbMin: DE441_NATIVE_JD_TDB_START,
        jdTdbMax: DE441_NATIVE_JD_TDB_END,
        moonGeocentricState,
        fillEpochGridSamples,
        fillSortedJdSamples,
    };
}
