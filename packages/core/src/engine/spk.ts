// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * spk.ts — JPL SPK Type 2 binary ephemeris reader
 *
 * Reads de440s.bsp (NAIF DAF/SPK format) to extract planet positions as
 * barycentric rectangular coordinates in the J2000.0 equatorial frame.
 *
 * Supported: SPK Type 2 only (Chebyshev polynomials, position only).
 *            DE440s uses Type 2 for all bodies.
 *
 * Format reference:
 *   https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/daf.html
 *   https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/spk.html
 *
 * Data source: NASA/JPL public domain
 *   https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp
 */

import { evalRecord, evalRecordAtS, type Vec3 } from './chebyshev.js';
import { J2000_JD } from './provider/time.js';

// ---------------------------------------------------------------------------
// NAIF body IDs used from de440s.bsp
// ---------------------------------------------------------------------------

/**
 * NAIF integer body codes present in de440s.bsp.
 * @provenance NAIF Integer ID codes, NAIF IDs Required Reading (naif_ids.req).
 * Positions are barycentric (relative to Solar System Barycenter = 0)
 * except 301/399 which are relative to the Earth-Moon Barycenter (3).
 */
export const NAIF = {
    SSB: 0, // Solar System Barycenter (origin)
    Mercury: 1, // Mercury barycenter
    Venus: 2, // Venus barycenter
    EMB: 3, // Earth-Moon Barycenter
    Mars: 4, // Mars barycenter
    Jupiter: 5, // Jupiter barycenter
    Saturn: 6, // Saturn barycenter
    Uranus: 7, // Uranus barycenter
    Neptune: 8, // Neptune barycenter
    Pluto: 9, // Pluto barycenter
    Sun: 10, // Sun
    Moon: 301, // Moon (relative to EMB)
    Earth: 399, // Earth (relative to EMB)
} as const;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface SpkSegment {
    target: number; // NAIF target body ID
    center: number; // NAIF center body ID
    frame: number; // Reference frame (1 = J2000)
    type: number; // SPK data type (2 = Chebyshev position)
    startET: number; // Segment start, seconds from J2000.0
    endET: number; // Segment end, seconds from J2000.0
    initAddr: number; // Initial double address (1-indexed)
    finalAddr: number; // Final double address (1-indexed)
}

// ---------------------------------------------------------------------------
// DAF record constants
// ---------------------------------------------------------------------------

const RECORD_BYTES = 1024; // DAF record size (always 1024 bytes)
const ND = 2; // Doubles per SPK summary descriptor
const NI = 6; // Integers per SPK summary descriptor
// Each summary occupies ND + ceil(NI/2) = 2 + 3 = 5 doubles of space
const SUMMARY_SIZE_F64 = ND + Math.ceil(NI / 2); // 5
const SUMMARY_BYTES = SUMMARY_SIZE_F64 * 8; // 40

// ---------------------------------------------------------------------------
// SpkFile — load once at init, query at will
// ---------------------------------------------------------------------------

export class SpkFile {
    private readonly buf: Uint8Array;
    private readonly view: DataView;
    private readonly littleEnd: boolean;
    private readonly segments: SpkSegment[] = [];

    constructor(bytes: Uint8Array) {
        this.buf = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this.littleEnd = this.detectEndian();
        this.parseSegments();
    }

    static fromBuffer(buf: Uint8Array | ArrayBuffer): SpkFile {
        return new SpkFile(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
    }

    // ─── File parsing ──────────────────────────────────────────────────────

    private detectEndian(): boolean {
        // File record offset 88–95: "LTL-IEEE" (LE) or "BIG-IEEE" (BE)
        const tag = new TextDecoder('ascii')
            .decode(this.buf.subarray(88, 96))
            .trim()
            .replace(/\0/g, '');
        if (tag === 'LTL-IEEE') return true;
        if (tag === 'BIG-IEEE') return false;
        // Fallback: modern JPL files are little-endian
        return true;
    }

    private readF64(byteOffset: number): number {
        return this.view.getFloat64(byteOffset, this.littleEnd);
    }

    private readI32(byteOffset: number): number {
        return this.view.getInt32(byteOffset, this.littleEnd);
    }

    /** Parse the linked list of summary records and build segment index. */
    private parseSegments(): void {
        // File record: FWARD at offset 76 (1-indexed record number of first summary)
        const fward = this.readI32(76);

        let recordNum = fward;

        while (recordNum > 0) {
            const recBase = (recordNum - 1) * RECORD_BYTES;
            const nextRec = this.readF64(recBase + 0); // next summary record (0 = end)
            // prev at +8, unused
            const nSummaries = Math.round(this.readF64(recBase + 16));

            for (let i = 0; i < nSummaries; i++) {
                const base = recBase + 24 + i * SUMMARY_BYTES;

                // ND = 2 doubles: startET, endET
                const startET = this.readF64(base);
                const endET = this.readF64(base + 8);

                // NI = 6 int32s immediately after the doubles
                const intBase = base + ND * 8;
                const target = this.readI32(intBase);
                const center = this.readI32(intBase + 4);
                const frame = this.readI32(intBase + 8);
                const type = this.readI32(intBase + 12);
                const initAddr = this.readI32(intBase + 16);
                const finlAddr = this.readI32(intBase + 20);

                // Only handle SPK Type 2 (Chebyshev position)
                if (type === 2) {
                    this.segments.push({
                        target,
                        center,
                        frame,
                        type,
                        startET,
                        endET,
                        initAddr,
                        finalAddr: finlAddr,
                    });
                }
            }

            recordNum = Math.round(nextRec); // 0 terminates the list
        }
    }

    // ─── Public query API ─────────────────────────────────────────────────

    /**
     * Get the barycentric position (and velocity) of a body at ephemeris time `et`.
     *
     * @param target  NAIF body ID (see NAIF constants above)
     * @param center  NAIF center body ID (must match a segment in the file)
     * @param et      Ephemeris time in seconds from J2000.0 TDB
     * @returns Vec3  Position in km, velocity in km/s (J2000 equatorial rectangular)
     */
    getState(target: number, center: number, et: number): Vec3 {
        const seg = this.findSegment(target, center, et);
        if (!seg) {
            const cov = this.segments.filter((s) => s.target === target && s.center === center);
            if (cov.length > 0) {
                const lo = Math.min(...cov.map((s) => s.startET));
                const hi = Math.max(...cov.map((s) => s.endET));
                if (et < lo || et > hi) {
                    const jd = (x: number) => (2451545.0 + x / 86400).toFixed(1);
                    throw new RangeError(
                        `SpkFile: epoch JD(TDB) ${jd(et)} is outside the loaded ephemeris coverage ` +
                            `JD ${jd(lo)}–${jd(hi)} (DE440s: 1849-12-26 to 2150-01-22). ` +
                            `Long-range support is tracked separately.`,
                    );
                }
            }
            throw new Error(
                `SpkFile: no Type-2 segment for target=${target}, center=${center} at ET=${et.toFixed(0)}s`,
            );
        }
        return this.evalSegment(seg, et);
    }

    /**
     * Barycentric state at two-part TDB (jplephem-style Chebyshev offset).
     * `D` = floor(JD TDB), `f` = fractional day; do not form a single JD before offset.
     */
    getBarycentricAtTdb(naifBody: number, D: number, f: number): Vec3 {
        if (naifBody === NAIF.Moon || naifBody === NAIF.Earth) {
            const emb = this.getStateAtTdb(NAIF.EMB, NAIF.SSB, D, f);
            const rel = this.getStateAtTdb(naifBody, NAIF.EMB, D, f);
            return {
                x: emb.x + rel.x,
                y: emb.y + rel.y,
                z: emb.z + rel.z,
                vx: emb.vx + rel.vx,
                vy: emb.vy + rel.vy,
                vz: emb.vz + rel.vz,
            };
        }
        return this.getStateAtTdb(naifBody, NAIF.SSB, D, f);
    }

    private getStateAtTdb(target: number, center: number, D: number, f: number): Vec3 {
        const wholeSec = (D - J2000_JD) * 86400;
        const etLookup = wholeSec + f * 86400;
        const seg = this.findSegment(target, center, etLookup);
        if (!seg) {
            throw new Error(
                `SpkFile: no Type-2 segment for target=${target}, center=${center} at TDB D=${D} f=${f}`,
            );
        }
        return this.evalSegmentAtTdb(seg, D, f);
    }

    // ─── Geocentric convenience helpers ────────────────────────────────────

    /**
     * Return geocentric J2000 equatorial rectangular position (km) + velocity (km/s).
     *
     * Computes: body_SSB − Earth_SSB using the available SSB and EMB segments.
     *
     * For de440s.bsp:
     *   Earth_SSB = EMB_SSB + Earth_EMB   (body 3 + body 399)
     *   Moon_SSB  = EMB_SSB + Moon_EMB    (body 3 + body 301)
     */
    getGeocentric(naifBody: number, et: number): Vec3 {
        const body = this.getBarycentric(naifBody, et);
        const earth = this.getBarycentric(NAIF.Earth, et);

        return {
            x: body.x - earth.x,
            y: body.y - earth.y,
            z: body.z - earth.z,
            vx: body.vx - earth.vx,
            vy: body.vy - earth.vy,
            vz: body.vz - earth.vz,
        };
    }

    /**
     * Return solar-system-barycentric J2000 equatorial rectangular position (km)
     * and velocity (km/s) for a body.
     *
     * Light-time and aberration corrections require the body and the observer to
     * be evaluated at *different* epochs, so callers need the barycentric states
     * separately rather than a pre-differenced geocentric vector.
     *
     * For de440s.bsp:
     *   Earth_SSB = EMB_SSB + Earth_EMB   (body 3 + body 399)
     *   Moon_SSB  = EMB_SSB + Moon_EMB    (body 3 + body 301)
     */
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
        // All other bodies are stored relative to the SSB directly
        return this.getState(naifBody, NAIF.SSB, et);
    }
    // ─── Internals ────────────────────────────────────────────────────────

    private findSegment(target: number, center: number, et: number): SpkSegment | undefined {
        // Prefer the tightest time window that covers et
        let best: SpkSegment | undefined;
        let bestSpan = Infinity;

        for (const seg of this.segments) {
            if (seg.target !== target) continue;
            if (seg.center !== center) continue;
            if (et < seg.startET || et > seg.endET) continue;
            const span = seg.endET - seg.startET;
            if (span < bestSpan) {
                best = seg;
                bestSpan = span;
            }
        }
        return best;
    }

    /**
     * Evaluate a Type 2 segment at ephemeris time `et`.
     *
     * SPK Type 2 segment layout (all doubles, 1-indexed addresses in file):
     *   [initAddr … finalAddr-4]  : N coefficient records, each RSIZE doubles
     *   [finalAddr-3]             : INIT    (segment start, ET seconds)
     *   [finalAddr-2]             : INTLEN  (sub-interval length, seconds)
     *   [finalAddr-1]             : RSIZE   (doubles per record)
     *   [finalAddr]               : N       (number of records)
     */
    private evalSegment(seg: SpkSegment, et: number): Vec3 {
        // Read metadata from last 4 doubles of segment
        const metaBase = (seg.finalAddr - 4) * 8; // 0-indexed byte offset
        const INIT = this.readF64(metaBase);
        const INTLEN = this.readF64(metaBase + 8);
        const RSIZE = Math.round(this.readF64(metaBase + 16));
        const N = Math.round(this.readF64(metaBase + 24));

        if (RSIZE < 4 || N < 1) {
            throw new Error(`SpkFile: invalid segment metadata (RSIZE=${RSIZE}, N=${N})`);
        }

        // Find the coefficient record index
        let recordIdx = Math.floor((et - INIT) / INTLEN);
        recordIdx = Math.max(0, Math.min(recordIdx, N - 1)); // clamp

        // Read the RSIZE doubles of that record
        const recordBase = (seg.initAddr - 1 + recordIdx * RSIZE) * 8;
        const record = new Array<number>(RSIZE);
        for (let i = 0; i < RSIZE; i++) {
            record[i] = this.readF64(recordBase + i * 8);
        }

        return evalRecord(record, et);
    }

    /** jplephem `Segment.generate` split offset → s = 2·offset/INTLEN − 1. */
    private evalSegmentAtTdb(seg: SpkSegment, D: number, f: number): Vec3 {
        const metaBase = (seg.finalAddr - 4) * 8;
        const INIT = this.readF64(metaBase);
        const INTLEN = this.readF64(metaBase + 8);
        const RSIZE = Math.round(this.readF64(metaBase + 16));
        const N = Math.round(this.readF64(metaBase + 24));

        if (RSIZE < 4 || N < 1 || INTLEN <= 0) {
            throw new Error(`SpkFile: invalid segment metadata (RSIZE=${RSIZE}, N=${N})`);
        }

        const wholeSec = (D - J2000_JD) * 86400;
        const fracSec = f * 86400;
        const [index1, offset1] = divmod(wholeSec - INIT, INTLEN);
        const [index2, offset2] = divmod(fracSec, INTLEN);
        const [carry, offset] = divmod(offset1 + offset2, INTLEN);
        let recordIdx = index1 + index2 + carry;
        recordIdx = Math.max(0, Math.min(recordIdx, N - 1));

        const recordBase = (seg.initAddr - 1 + recordIdx * RSIZE) * 8;
        const record = new Array<number>(RSIZE);
        for (let i = 0; i < RSIZE; i++) {
            record[i] = this.readF64(recordBase + i * 8);
        }

        const s = (2 * offset) / INTLEN - 1;
        return evalRecordAtS(record, s);
    }

    /** Expose segment list for diagnostics. */
    get segmentList(): readonly SpkSegment[] {
        return this.segments;
    }

    /**
     * Copy a Type-2 segment's coefficient block for chunk encoding (DE431 build).
     */
    readType2SegmentPayload(seg: SpkSegment): {
        target: number;
        center: number;
        init: number;
        intlen: number;
        rsize: number;
        n: number;
        data: Float64Array;
    } {
        const metaBase = (seg.finalAddr - 4) * 8;
        const init = this.readF64(metaBase);
        const intlen = this.readF64(metaBase + 8);
        const rsize = Math.round(this.readF64(metaBase + 16));
        const n = Math.round(this.readF64(metaBase + 24));
        const total = n * rsize;
        const data = new Float64Array(total);
        const recordBase = (seg.initAddr - 1) * 8;
        for (let i = 0; i < total; i++) {
            data[i] = this.readF64(recordBase + i * 8);
        }
        return { target: seg.target, center: seg.center, init, intlen, rsize, n, data };
    }
}

function divmod(a: number, b: number): [number, number] {
    const q = Math.floor(a / b);
    const r = a - q * b;
    return [q, r];
}

// ---------------------------------------------------------------------------
// Singleton accessor — module-level cache
// ---------------------------------------------------------------------------

let _instance: SpkFile | undefined;

/**
 * Load (and cache) a SpkFile from in-memory DE440s bytes.
 * Subsequent calls return the cached instance until {@link resetSpkCache}.
 */
export function loadSpkFromBytes(bytes: Uint8Array): SpkFile {
    if (!_instance) {
        _instance = new SpkFile(bytes);
    }
    return _instance;
}

/** Reset the singleton cache (useful for testing). */
export function resetSpkCache(): void {
    _instance = undefined;
}
