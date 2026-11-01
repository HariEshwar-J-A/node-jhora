/**
 * Compact DE431 chunk reader (`.njce` — Node-Jhora Compact Ephemeris).
 *
 * Each file holds SPK Type-2 Chebyshev records for one century and one body
 * group, copied from JPL DE431 without re-fitting so float64 evaluation matches
 * the source kernel to numerical precision.
 */

import { NJCE_MAX_CENTURY, NJCE_MIN_CENTURY } from '../../ephemeris-data/manifest.js';
import { NodeJHoraError, NodeJHoraErrorCode } from '../../errors.js';
import { civilDateFromJulianDay } from '../../time/historical.js';
import { evalRecord, type Vec3 } from '../chebyshev.js';
import { NAIF } from '../spk.js';
import {
    NJCE_GROUP_SEGMENTS,
    NJCE_TT_JD_MAX_REQUIRED,
    NJCE_TT_JD_MIN_REQUIRED,
} from './chunk-coverage.js';
import { J2000_JD, SECONDS_PER_DAY } from './time.js';
import type {
    EphemerisBodyId,
    EphemerisFrame,
    EphemerisProvider,
    EphemerisState,
} from './types.js';

export const NJCE_MAGIC = 0x45434a4e; // 'NJCE' little-endian
export const NJCE_VERSION = 1;

/** Century index: floor(astronomicalYear / 100). */
export function centuryIndex(astronomicalYear: number): number {
    return Math.floor(astronomicalYear / 100);
}

export const DE431_LONG_JD_TDB_START = NJCE_TT_JD_MIN_REQUIRED;
/** Advertised long-range TT coverage (see `chunk-coverage.ts`). */
export const DE431_LONG_JD_TDB_END = NJCE_TT_JD_MAX_REQUIRED;

export const BODY_GROUP_PLANETS = 0;
export const BODY_GROUP_EMB = 1;

interface ChunkSegment {
    target: number;
    center: number;
    init: number;
    intlen: number;
    rsize: number;
    n: number;
    /** Flat coefficient records, length n * rsize */
    data: Float64Array;
}

export class De431ChunkFile {
    readonly centuryIndex: number;
    readonly groupId: number;
    private readonly segments: ChunkSegment[] = [];

    constructor(buf: ArrayBuffer | Uint8Array) {
        const view = new DataView(
            buf instanceof Uint8Array ? buf.buffer : buf,
            buf instanceof Uint8Array ? buf.byteOffset : 0,
            buf instanceof Uint8Array ? buf.byteLength : buf.byteLength,
        );
        let off = 0;
        const magic = view.getUint32(off, true);
        off += 4;
        if (magic !== NJCE_MAGIC) throw new Error('De431ChunkFile: bad magic');
        const version = view.getUint16(off, true);
        off += 2;
        if (version !== NJCE_VERSION)
            throw new Error(`De431ChunkFile: unsupported version ${version}`);
        this.centuryIndex = view.getInt32(off, true);
        off += 4;
        this.groupId = view.getUint8(off);
        off += 1;
        off += 3; // padding
        const numSeg = view.getUint32(off, true);
        off += 4;

        for (let s = 0; s < numSeg; s++) {
            const target = view.getInt32(off, true);
            off += 4;
            const center = view.getInt32(off, true);
            off += 4;
            const init = view.getFloat64(off, true);
            off += 8;
            const intlen = view.getFloat64(off, true);
            off += 8;
            const rsize = view.getUint32(off, true);
            off += 4;
            const n = view.getUint32(off, true);
            off += 4;
            off = (off + 7) & ~7;
            const total = n * rsize;
            const data = new Float64Array(total);
            for (let i = 0; i < total; i++) {
                data[i] = view.getFloat64(off, true);
                off += 8;
            }
            this.segments.push({ target, center, init, intlen, rsize, n, data });
        }
    }

    getState(target: number, center: number, et: number): Vec3 {
        const seg = this.findSegment(target, center, et);
        if (!seg) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `De431ChunkFile g${this.groupId}-c${this.centuryIndex}: no Chebyshev segment for ` +
                    `target=${target} center=${center} at ET=${et}`,
                { century: this.centuryIndex, groupId: this.groupId, et, target, center },
            );
        }
        const segEnd = seg.init + seg.n * seg.intlen;
        if (et < seg.init || et > segEnd) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `De431ChunkFile g${this.groupId}-c${this.centuryIndex}: ET=${et} outside copied ` +
                    `segment [${seg.init}, ${segEnd}] for target=${target} center=${center}`,
                { century: this.centuryIndex, groupId: this.groupId, et, target, center },
            );
        }
        let recordIdx = Math.floor((et - seg.init) / seg.intlen);
        if (recordIdx >= seg.n) {
            if (et > segEnd) {
                throw new NodeJHoraError(
                    NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                    `De431ChunkFile g${this.groupId}-c${this.centuryIndex}: ET=${et} past last ` +
                        `Chebyshev record for target=${target} center=${center}`,
                    { century: this.centuryIndex, groupId: this.groupId, et, target, center },
                );
            }
            recordIdx = seg.n - 1;
        }
        if (recordIdx < 0) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `De431ChunkFile g${this.groupId}-c${this.centuryIndex}: ET=${et} before first ` +
                    `Chebyshev record for target=${target} center=${center}`,
                { century: this.centuryIndex, groupId: this.groupId, et, target, center },
            );
        }
        const start = recordIdx * seg.rsize;
        const record = seg.data.subarray(start, start + seg.rsize);
        return evalRecord(record, et);
    }

    private findSegment(target: number, center: number, et: number): ChunkSegment | undefined {
        for (const seg of this.segments) {
            if (seg.target !== target || seg.center !== center) continue;
            const end = seg.init + seg.n * seg.intlen;
            if (et < seg.init || et > end) continue;
            return seg;
        }
        return undefined;
    }

    /** Every segment in this group has Chebyshev data bracketing `et`. */
    coversGroupAtEt(groupId: number, et: number): boolean {
        const pairs = NJCE_GROUP_SEGMENTS[groupId];
        if (!pairs) return false;
        return pairs.every(
            ([target, center]) => this.findSegment(target, center, et) !== undefined,
        );
    }

    /** Union ET span (seconds) of all segments in this file. */
    etSpanSeconds(): { start: number; end: number } | undefined {
        let start = Infinity;
        let end = -Infinity;
        for (const seg of this.segments) {
            start = Math.min(start, seg.init);
            end = Math.max(end, seg.init + seg.n * seg.intlen);
        }
        if (!Number.isFinite(start)) return undefined;
        return { start, end };
    }

    getBarycentric(naifBody: number, et: number): Vec3 {
        if (naifBody === NAIF.Moon || naifBody === NAIF.Earth) {
            const emb = this.getState(NAIF.EMB, NAIF.SSB, et);
            const rel = this.getState(naifBody, NAIF.EMB, et);
            return {
                x: emb.x + rel.x,
                y: emb.y + rel.y,
                z: emb.z + rel.z,
                vx: emb.vx + rel.vx,
                vy: emb.vy + rel.vy,
                vz: emb.vz + rel.vz,
            };
        }
        return this.getState(naifBody, NAIF.SSB, et);
    }
}

export class De431LongEphemerisProvider implements EphemerisProvider {
    readonly id = 'de431_long';
    readonly coverage = {
        jdTdbStart: DE431_LONG_JD_TDB_START,
        jdTdbEnd: DE431_LONG_JD_TDB_END,
        kernelId: 'de431-long',
        version: '431',
    };
    readonly bodies = [
        NAIF.Sun,
        NAIF.Mercury,
        NAIF.Venus,
        NAIF.Earth,
        NAIF.Moon,
        NAIF.Mars,
        NAIF.Jupiter,
        NAIF.Saturn,
        NAIF.Uranus,
        NAIF.Neptune,
        NAIF.Pluto,
    ] as const;

    constructor(
        private readonly getChunk: (century: number, groupId: number) => De431ChunkFile | undefined,
    ) {}

    /**
     * Return the chunk file whose copied DE431 records bracket `et` for every
     * body in `groupId`. Never returns a file that would clamp or extrapolate.
     */
    private resolveChunk(nominalCentury: number, groupId: number, et: number): De431ChunkFile {
        const candidates = [nominalCentury, nominalCentury - 1, nominalCentury + 1];
        for (const c of candidates) {
            const chunk = this.getChunk(c, groupId);
            if (chunk?.coversGroupAtEt(groupId, et)) return chunk;
        }
        throw new NodeJHoraError(
            NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
            `No DE431 NJCE chunk contains TT ephemeris time ET=${et} for group=${groupId} ` +
                `(nominal century=${nominalCentury}). Rebuild long-range data with ` +
                '`pnpm --filter @node-jhora/ephe-long run build:chunks` and refresh the manifest.',
            { nominalCentury, groupId, et },
        );
    }

    state(jdTdb: number, body: EphemerisBodyId, frame: EphemerisFrame): EphemerisState {
        const et = (jdTdb - J2000_JD) * SECONDS_PER_DAY;
        const astroYear = jdTdbToAstronomicalYear(jdTdb);
        const cent = centuryIndex(astroYear);
        const group =
            body === NAIF.Moon || body === NAIF.Earth || body === NAIF.EMB
                ? BODY_GROUP_EMB
                : BODY_GROUP_PLANETS;
        const chunk = this.resolveChunk(cent, group, et);
        const bary = chunk.getBarycentric(body, et);
        if (frame === 'barycentric') return bary;
        const sunChunk =
            group === BODY_GROUP_PLANETS ? chunk : this.resolveChunk(cent, BODY_GROUP_PLANETS, et);
        const sun = sunChunk.getBarycentric(NAIF.Sun, et);
        return {
            x: bary.x - sun.x,
            y: bary.y - sun.y,
            z: bary.z - sun.z,
            vx: bary.vx - sun.vx,
            vy: bary.vy - sun.vy,
            vz: bary.vz - sun.vz,
        };
    }
}

/**
 * Astronomical year containing `jdTdb`, using the same calendar rule as the
 * chunk builder (proleptic Julian before 1582-10-15) so century boundaries agree
 * exactly with the files on disk.
 */
export function jdTdbToAstronomicalYear(jdTdb: number): number {
    return civilDateFromJulianDay(jdTdb).astronomicalYear;
}
