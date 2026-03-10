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

import { readFileSync } from 'fs';
import { evalRecord, type Vec3 } from './chebyshev.js';

// ---------------------------------------------------------------------------
// NAIF body IDs used from de440s.bsp
// ---------------------------------------------------------------------------

/**
 * NAIF integer body codes present in de440s.bsp.
 * Positions are barycentric (relative to Solar System Barycenter = 0)
 * except 301/399 which are relative to the Earth-Moon Barycenter (3).
 */
export const NAIF = {
    SSB:     0,   // Solar System Barycenter (origin)
    Mercury: 1,   // Mercury barycenter
    Venus:   2,   // Venus barycenter
    EMB:     3,   // Earth-Moon Barycenter
    Mars:    4,   // Mars barycenter
    Jupiter: 5,   // Jupiter barycenter
    Saturn:  6,   // Saturn barycenter
    Uranus:  7,   // Uranus barycenter
    Neptune: 8,   // Neptune barycenter
    Pluto:   9,   // Pluto barycenter
    Sun:    10,   // Sun
    Moon:  301,   // Moon (relative to EMB)
    Earth: 399,   // Earth (relative to EMB)
} as const;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface SpkSegment {
    target:    number;   // NAIF target body ID
    center:    number;   // NAIF center body ID
    frame:     number;   // Reference frame (1 = J2000)
    type:      number;   // SPK data type (2 = Chebyshev position)
    startET:   number;   // Segment start, seconds from J2000.0
    endET:     number;   // Segment end, seconds from J2000.0
    initAddr:  number;   // Initial double address (1-indexed)
    finalAddr: number;   // Final double address (1-indexed)
}

// ---------------------------------------------------------------------------
// DAF record constants
// ---------------------------------------------------------------------------

const RECORD_BYTES = 1024;   // DAF record size (always 1024 bytes)
const ND = 2;                 // Doubles per SPK summary descriptor
const NI = 6;                 // Integers per SPK summary descriptor
// Each summary occupies ND + ceil(NI/2) = 2 + 3 = 5 doubles of space
const SUMMARY_SIZE_F64 = ND + Math.ceil(NI / 2);   // 5
const SUMMARY_BYTES    = SUMMARY_SIZE_F64 * 8;      // 40

// ---------------------------------------------------------------------------
// SpkFile — load once at init, query at will
// ---------------------------------------------------------------------------

export class SpkFile {
    private readonly buf:      Buffer;
    private readonly littleEnd: boolean;
    private readonly segments: SpkSegment[] = [];

    constructor(filePath: string) {
        this.buf      = readFileSync(filePath);
        this.littleEnd = this.detectEndian();
        this.parseSegments();
    }

    // ─── File parsing ──────────────────────────────────────────────────────

    private detectEndian(): boolean {
        // File record offset 88–95: "LTL-IEEE" (LE) or "BIG-IEEE" (BE)
        const tag = this.buf.toString('ascii', 88, 96).trim().replace(/\0/g, '');
        if (tag === 'LTL-IEEE') return true;
        if (tag === 'BIG-IEEE') return false;
        // Fallback: modern JPL files are little-endian
        return true;
    }

    private readF64(byteOffset: number): number {
        return this.littleEnd
            ? this.buf.readDoubleBE !== undefined
                ? this.buf.readDoubleLE(byteOffset)
                : new DataView(this.buf.buffer, this.buf.byteOffset + byteOffset, 8).getFloat64(0, true)
            : new DataView(this.buf.buffer, this.buf.byteOffset + byteOffset, 8).getFloat64(0, false);
    }

    private readI32(byteOffset: number): number {
        return this.littleEnd
            ? this.buf.readInt32LE(byteOffset)
            : this.buf.readInt32BE(byteOffset);
    }

    /** Parse the linked list of summary records and build segment index. */
    private parseSegments(): void {
        // File record: FWARD at offset 76 (1-indexed record number of first summary)
        const fward = this.readI32(76);

        let recordNum = fward;

        while (recordNum > 0) {
            const recBase  = (recordNum - 1) * RECORD_BYTES;
            const nextRec  = this.readF64(recBase + 0);  // next summary record (0 = end)
            // prev at +8, unused
            const nSummaries = Math.round(this.readF64(recBase + 16));

            for (let i = 0; i < nSummaries; i++) {
                const base = recBase + 24 + i * SUMMARY_BYTES;

                // ND = 2 doubles: startET, endET
                const startET = this.readF64(base);
                const endET   = this.readF64(base + 8);

                // NI = 6 int32s immediately after the doubles
                const intBase  = base + ND * 8;
                const target   = this.readI32(intBase);
                const center   = this.readI32(intBase + 4);
                const frame    = this.readI32(intBase + 8);
                const type     = this.readI32(intBase + 12);
                const initAddr = this.readI32(intBase + 16);
                const finlAddr = this.readI32(intBase + 20);

                // Only handle SPK Type 2 (Chebyshev position)
                if (type === 2) {
                    this.segments.push({ target, center, frame, type, startET, endET, initAddr, finalAddr: finlAddr });
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
            throw new Error(
                `SpkFile: no Type-2 segment for target=${target}, center=${center} at ET=${et.toFixed(0)}s`,
            );
        }
        return this.evalSegment(seg, et);
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
        // Earth position in SSB frame
        const emb   = this.getState(NAIF.EMB,   NAIF.SSB, et);
        const earth = this.getState(NAIF.Earth, NAIF.EMB, et);

        const earthX  = emb.x + earth.x;
        const earthY  = emb.y + earth.y;
        const earthZ  = emb.z + earth.z;
        const earthVx = emb.vx + earth.vx;
        const earthVy = emb.vy + earth.vy;
        const earthVz = emb.vz + earth.vz;

        let bodyX: number, bodyY: number, bodyZ: number;
        let bodyVx: number, bodyVy: number, bodyVz: number;

        if (naifBody === NAIF.Moon) {
            // Moon: SSB = EMB + Moon_EMB
            const moon = this.getState(NAIF.Moon, NAIF.EMB, et);
            bodyX  = emb.x + moon.x;
            bodyY  = emb.y + moon.y;
            bodyZ  = emb.z + moon.z;
            bodyVx = emb.vx + moon.vx;
            bodyVy = emb.vy + moon.vy;
            bodyVz = emb.vz + moon.vz;
        } else if (naifBody === NAIF.Earth) {
            bodyX = earthX; bodyY = earthY; bodyZ = earthZ;
            bodyVx = earthVx; bodyVy = earthVy; bodyVz = earthVz;
        } else {
            // All other bodies are given relative to SSB directly
            const body = this.getState(naifBody, NAIF.SSB, et);
            bodyX  = body.x;
            bodyY  = body.y;
            bodyZ  = body.z;
            bodyVx = body.vx;
            bodyVy = body.vy;
            bodyVz = body.vz;
        }

        return {
            x:  bodyX  - earthX,
            y:  bodyY  - earthY,
            z:  bodyZ  - earthZ,
            vx: bodyVx - earthVx,
            vy: bodyVy - earthVy,
            vz: bodyVz - earthVz,
        };
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
            if (span < bestSpan) { best = seg; bestSpan = span; }
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
        const metaBase  = (seg.finalAddr - 4) * 8;   // 0-indexed byte offset
        const INIT      = this.readF64(metaBase);
        const INTLEN    = this.readF64(metaBase + 8);
        const RSIZE     = Math.round(this.readF64(metaBase + 16));
        const N         = Math.round(this.readF64(metaBase + 24));

        if (RSIZE < 4 || N < 1) {
            throw new Error(`SpkFile: invalid segment metadata (RSIZE=${RSIZE}, N=${N})`);
        }

        // Find the coefficient record index
        let recordIdx = Math.floor((et - INIT) / INTLEN);
        recordIdx = Math.max(0, Math.min(recordIdx, N - 1)); // clamp

        // Read the RSIZE doubles of that record
        const recordBase = (seg.initAddr - 1 + recordIdx * RSIZE) * 8;
        const record     = new Array<number>(RSIZE);
        for (let i = 0; i < RSIZE; i++) {
            record[i] = this.readF64(recordBase + i * 8);
        }

        return evalRecord(record, et);
    }

    /** Expose segment list for diagnostics. */
    get segmentList(): readonly SpkSegment[] {
        return this.segments;
    }
}

// ---------------------------------------------------------------------------
// Singleton accessor — module-level cache
// ---------------------------------------------------------------------------

let _instance: SpkFile | undefined;

/**
 * Load (and cache) a SpkFile from the given path.
 * Subsequent calls with the same path return the cached instance.
 */
export function loadSpk(filePath: string): SpkFile {
    if (!_instance) {
        _instance = new SpkFile(filePath);
    }
    return _instance;
}

/** Reset the singleton cache (useful for testing). */
export function resetSpkCache(): void {
    _instance = undefined;
}
