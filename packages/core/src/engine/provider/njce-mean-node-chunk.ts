// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * NJCE chunk helpers for DE441 secular mean-node sampling (not exported from `@node-jhora/core`).
 */

import { NodeJHoraError, NodeJHoraErrorCode } from '../../errors.js';
import { evalRecordAtSInto, type Vec3 } from '../chebyshev.js';
import { NAIF } from '../spk.js';
import {
    BODY_GROUP_EMB,
    centuryIndex,
    De431ChunkFile,
    jdTdbToAstronomicalYear,
} from './de431-chunk.js';
import { J2000_JD, SECONDS_PER_DAY } from './time.js';
import type { EphemerisState } from './types.js';

interface ChunkSegment {
    target: number;
    center: number;
    init: number;
    intlen: number;
    rsize: number;
    n: number;
    data: Float64Array;
}

interface SeqCursor {
    seg: ChunkSegment;
    recordIdx: number;
}

type ChunkWithSegments = {
    readonly segments: ChunkSegment[];
    readonly groupId: number;
    readonly centuryIndex: number;
};

function asChunkWithSegments(chunk: De431ChunkFile): ChunkWithSegments {
    return chunk as unknown as ChunkWithSegments;
}

function findSegment(
    chunk: ChunkWithSegments,
    target: number,
    center: number,
    et: number,
): ChunkSegment | undefined {
    for (const seg of chunk.segments) {
        if (seg.target !== target || seg.center !== center) continue;
        const end = seg.init + seg.n * seg.intlen;
        if (et < seg.init || et > end) continue;
        return seg;
    }
    return undefined;
}

function evalStateSequential(
    chunk: ChunkWithSegments,
    target: number,
    center: number,
    et: number,
    cursor: SeqCursor | undefined,
    out: Vec3,
): SeqCursor {
    let seg = cursor?.seg;
    if (!seg || et < seg.init || et > seg.init + seg.n * seg.intlen) {
        seg = findSegment(chunk, target, center, et);
        if (!seg) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `De431ChunkFile g${chunk.groupId}-c${chunk.centuryIndex}: no segment for ` +
                    `target=${target} center=${center} at ET=${et}`,
                {
                    century: chunk.centuryIndex,
                    groupId: chunk.groupId,
                    et,
                    target,
                    center,
                },
            );
        }
        const recordIdx = Math.min(
            seg.n - 1,
            Math.max(0, Math.floor((et - seg.init) / seg.intlen)),
        );
        cursor = { seg, recordIdx };
    } else {
        let idx = cursor!.recordIdx;
        while (idx < seg.n - 1 && et > seg.init + (idx + 1) * seg.intlen) {
            idx++;
        }
        cursor = { seg, recordIdx: idx };
    }
    const c = cursor!;
    const start = c.recordIdx * seg.rsize;
    const record = seg.data.subarray(start, start + seg.rsize);
    const mid = record[0]!;
    const radius = record[1]!;
    const tau = (et - mid) / radius;
    evalRecordAtSInto(out, record, tau);
    return cursor;
}

export interface NjceMoonSeqScratch {
    moonSeq?: SeqCursor;
    earthSeq?: SeqCursor;
    moonVec: Vec3;
    earthVec: Vec3;
    rel: EphemerisState;
}

export function createNjceMoonSeqScratch(): NjceMoonSeqScratch {
    return {
        moonVec: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
        earthVec: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
        rel: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    };
}

export function njceEmbChunkAtJdTdb(
    getChunk: (century: number, groupId: number) => De431ChunkFile | undefined,
    jdTdb: number,
): De431ChunkFile {
    const et = (jdTdb - J2000_JD) * SECONDS_PER_DAY;
    const cent = centuryIndex(jdTdbToAstronomicalYear(jdTdb));
    const candidates = [cent, cent - 1, cent + 1];
    for (const c of candidates) {
        const chunk = getChunk(c, BODY_GROUP_EMB);
        if (chunk?.coversGroupAtEt(BODY_GROUP_EMB, et)) return chunk;
    }
    throw new NodeJHoraError(
        NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
        `No DE441 NJCE chunk contains TT ephemeris time ET=${et} for EMB group ` +
            `(nominal century=${cent}).`,
        { nominalCentury: cent, groupId: BODY_GROUP_EMB, et },
    );
}

export function njceMoonGeocentricRelativeAtEt(
    chunk: De431ChunkFile,
    et: number,
    scratch: NjceMoonSeqScratch,
): EphemerisState {
    const internal = asChunkWithSegments(chunk);
    scratch.moonSeq = evalStateSequential(
        internal,
        NAIF.Moon,
        NAIF.EMB,
        et,
        scratch.moonSeq,
        scratch.moonVec,
    );
    scratch.earthSeq = evalStateSequential(
        internal,
        NAIF.Earth,
        NAIF.EMB,
        et,
        scratch.earthSeq,
        scratch.earthVec,
    );
    const moon = scratch.moonVec;
    const earth = scratch.earthVec;
    const out = scratch.rel;
    out.x = moon.x - earth.x;
    out.y = moon.y - earth.y;
    out.z = moon.z - earth.z;
    out.vx = moon.vx - earth.vx;
    out.vy = moon.vy - earth.vy;
    out.vz = moon.vz - earth.vz;
    return out;
}

export function njceResetMoonSeqScratch(scratch: NjceMoonSeqScratch): void {
    scratch.moonSeq = undefined;
    scratch.earthSeq = undefined;
}
