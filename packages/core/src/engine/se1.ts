/**
 * se1.ts — Swiss Ephemeris .se1 binary file reader (pure TypeScript, no GPL)
 *
 * Reads DE431-based Chebyshev polynomial files from Astrodienst (.se1 format).
 * These data files are freely downloadable and carry no GPL restriction —
 * only the SE C library is AGPL/GPL. This reader is an independent
 * implementation of the documented binary format.
 *
 * Format reference:
 *   https://www.astro.com/swisseph/swephprg.htm
 *   Swiss Ephemeris source: sweph.c (read_const, get_new_segment)
 *
 * File layout:
 *   [TEXT]  3 × CR+LF lines (version, filename, copyright)
 *   [BIN]   endian_test (int32) = 0x616263
 *   [BIN]   file_length (int32)
 *   [BIN]   JPL DE number (int32)
 *   [BIN]   tfstart (double) — file Julian Day start
 *   [BIN]   tfend   (double) — file Julian Day end
 *   [BIN]   npl (int16)     — number of bodies
 *   [BIN]   ipl[npl] (int16 each) — body IDs
 *   [BIN]   CRC32 (int32)   — checksum of header bytes so far
 *   [BIN]   gen_const: 5 doubles (clight, aunit, helgravconst, ratme, sunradius)
 *   Per body (×npl):
 *     [BIN]   lndx0 (int32)  — byte offset of segment index table
 *     [BIN]   iflg  (uint8)  — SEI_FLG_* flags
 *     [BIN]   ncoe  (uint8)  — Chebyshev coefficient count
 *     [BIN]   rmax_int (int32) — normalization factor × 1000
 *     [BIN]   10 doubles: tfstart,tfend,dseg,telem,prot,dprot,qrot,dqrot,peri,dperi
 *     [BIN]   refep: 2*ncoe doubles — ONLY if (iflg & SEI_FLG_ELLIPSE)
 *   Data region:
 *     Segment index at lndx0: 3 bytes per interval → byte offset of coeff block
 *     Coefficient blocks: variable-width packed Chebyshev coefficients
 */

import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// SE internal body IDs (same as SE_SUN, SE_MOON, etc.)
// ---------------------------------------------------------------------------

export const SE_BODY = {
    Sun:     0,
    Moon:    1,
    Mercury: 2,
    Venus:   3,
    Mars:    4,
    Jupiter: 5,
    Saturn:  6,
    Uranus:  7,
    Neptune: 8,
    Pluto:   9,
    MeanNode: 10,
} as const;

// ---------------------------------------------------------------------------
// Flag constants
// ---------------------------------------------------------------------------

const SEI_FLG_HELIO   = 1;  // heliocentric coordinates
const SEI_FLG_ROTATE  = 2;  // orbital-plane coordinate frame
const SEI_FLG_ELLIPSE = 4;  // reference ellipse stored (refep)
const SEI_FLG_EMBHEL  = 8;  // EMB-relative (Moon)

// ---------------------------------------------------------------------------
// Per-planet file descriptor
// ---------------------------------------------------------------------------

interface PlanetDesc {
    bodyId:  number;
    lndx0:   number;   // byte offset of 3-byte segment index table
    iflg:    number;   // flag byte
    ncoe:    number;   // Chebyshev polynomial order + 1
    rmax:    number;   // normalisation factor (AU)
    tfstart: number;   // JD start of this body's data
    tfend:   number;   // JD end
    dseg:    number;   // days per interval
    nndx:    number;   // computed: floor((tfend - tfstart + 0.1) / dseg)
    // orbital rotation parameters (all in degrees)
    telem:   number;
    prot:    number;  dprot: number;
    qrot:    number;  dqrot: number;
    peri:    number;  dperi: number;
    // reference ellipse (only if SEI_FLG_ELLIPSE)
    refep?:  Float64Array;   // 2 × ncoe doubles
}

// ---------------------------------------------------------------------------
// Se1File
// ---------------------------------------------------------------------------

export class Se1File {
    private readonly buf:    Buffer;
    private readonly le:     boolean;  // little-endian
    /** Map from SE body ID → descriptor */
    readonly planets = new Map<number, PlanetDesc>();
    /** Mass ratio Earth/Moon (from gen_const, ~81.30) */
    ratme = 81.30058;

    constructor(filePath: string) {
        this.buf = readFileSync(filePath);
        // Detect endianness from magic word
        const binStart = this.textHeaderEnd();
        const magic = this.buf.readUInt32LE(binStart);
        this.le = (magic === 0x00616263);  // "abc\0" in LE → 0x00616263
        this.parseHeader(binStart);
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Return geocentric ecliptic rectangular coordinates [x, y, z] in AU
     * for the given SE body ID at Julian Day `tjd` (barycentric/TDB approx).
     *
     * For Sun (body 0): returns heliocentric Earth position (caller must negate
     * to get Sun geocentric, or subtract from planet_helio for planet geocentric).
     *
     * For Moon (body 1): returns geocentric ecliptic position (EMB-adjusted).
     *
     * For other bodies: returns heliocentric ecliptic position.
     */
    getRawPosition(bodyId: number, tjd: number): [number, number, number] {
        const desc = this.planets.get(bodyId);
        if (!desc) throw new Error(`Se1File: body ${bodyId} not in this file`);
        if (tjd < desc.tfstart || tjd > desc.tfend) {
            throw new Error(
                `Se1File: body ${bodyId} out of range: JD ${tjd} ` +
                `not in [${desc.tfstart}, ${desc.tfend}]`,
            );
        }
        return this.evalChebyshev(desc, bodyId, tjd);
    }

    // -----------------------------------------------------------------------
    // Header parsing
    // -----------------------------------------------------------------------

    private textHeaderEnd(): number {
        // Skip 3 CR+LF-terminated text lines
        let pos = 0, nlCount = 0;
        while (pos < this.buf.length && nlCount < 3) {
            if (this.buf[pos] === 0x0A) nlCount++;
            pos++;
        }
        return pos;
    }

    private parseHeader(start: number): void {
        let p = start;

        // endian(4) + flen(4) + denum(4) = 12 bytes
        p += 12;
        // tfstart(8) + tfend(8) = 16 bytes
        p += 16;
        // npl(2)
        const npl = this.readI16(p); p += 2;
        // ipl[npl] (2 bytes each)
        const ipl: number[] = [];
        for (let i = 0; i < npl; i++) {
            ipl.push(this.readI16(p)); p += 2;
        }
        // CRC32 (4 bytes) — skip
        p += 4;
        // gen_const: 5 doubles
        /* clight = */ this.readF64(p); p += 8;
        /* aunit  = */ p += 8;
        /* helgr  = */ p += 8;
        this.ratme = this.readF64(p); p += 8;
        /* sunrad = */ p += 8;

        // Per-planet descriptors
        for (let k = 0; k < npl; k++) {
            const bodyId  = ipl[k];
            const lndx0   = this.readI32(p);   p += 4;
            const iflg    = this.buf[p];        p += 1;
            const ncoe    = this.buf[p];        p += 1;
            const rmaxInt = this.readI32(p);    p += 4;
            const rmax    = rmaxInt / 1000.0;

            const doubles = new Float64Array(10);
            for (let d = 0; d < 10; d++) {
                doubles[d] = this.readF64(p); p += 8;
            }
            const [tfstart, tfend, dseg, telem,
                   prot, dprot, qrot, dqrot,
                   peri, dperi] = doubles;
            const nndx = Math.floor((tfend - tfstart + 0.1) / dseg);

            let refep: Float64Array | undefined;
            if (iflg & SEI_FLG_ELLIPSE) {
                refep = new Float64Array(2 * ncoe);
                for (let d = 0; d < 2 * ncoe; d++) {
                    refep[d] = this.readF64(p); p += 8;
                }
            }

            this.planets.set(bodyId, {
                bodyId, lndx0, iflg, ncoe, rmax,
                tfstart, tfend, dseg, nndx, telem,
                prot, dprot, qrot, dqrot, peri, dperi,
                refep,
            });
        }
    }

    // -----------------------------------------------------------------------
    // Chebyshev evaluation
    // -----------------------------------------------------------------------

    private evalChebyshev(desc: PlanetDesc, bodyId: number, tjd: number): [number, number, number] {
        const { lndx0, tfstart, dseg, ncoe, rmax, nndx,
                iflg, prot, dprot, qrot, dqrot, peri, dperi, telem, refep } = desc;

        // Secular rates are given per Julian century relative to the reference
        // epoch `telem` (stored in the file, typically the file midpoint).
        const T = (tjd - telem) / 36525.0;

        // Which segment?
        let iseg = Math.floor((tjd - tfstart) / dseg);
        iseg = Math.max(0, Math.min(iseg, nndx - 1));

        const tseg0 = tfstart + iseg * dseg;
        // Read 3-byte file pointer → byte offset of coefficient block
        const idxPos  = lndx0 + iseg * 3;
        const coeffPos = this.read3Bytes(idxPos);

        // Unpack Chebyshev coefficients for X, Y, Z
        const segp = this.unpackCoefficients(coeffPos, ncoe, rmax);

        // Normalised segment time t ∈ [−1, +1]
        const t = 2.0 * (tjd - tseg0) / dseg - 1.0;

        let x = this.echeb(t, segp, 0, ncoe);
        let y = this.echeb(t, segp, ncoe, ncoe);
        let z = this.echeb(t, segp, 2 * ncoe, ncoe);

        // Add reference ellipse if present.
        // refep is Chebyshev over ONE FULL ORBITAL PERIOD, parameterised with a
        // C-style (positive) fmod so dt ∈ [-1, +1]:
        //   fmod_c = (tjd - telem) % dseg;  if (fmod_c < 0) fmod_c += dseg;
        //   dt     = fmod_c / dseg * 2 - 1
        if (refep && (iflg & SEI_FLG_ELLIPSE)) {
            let fmod_c = (tjd - telem) % dseg;
            if (fmod_c < 0) fmod_c += dseg;
            const dt = fmod_c / dseg * 2.0 - 1.0;
            // refep[0..ncoe-1] = X, refep[ncoe..2*ncoe-1] = Y (no Z term)
            x += this.echeb(dt, refep, 0, ncoe);
            y += this.echeb(dt, refep, ncoe, ncoe);
        }

        // Rotate from orbital-plane frame to J2000 ecliptic.
        // SE stores positions in a "perihelion frame" (x-axis toward perihelion
        // at epoch telem).  Two rotations are needed:
        //
        //   1. Rz(peri_t): perihelion frame → ascending-node orbital frame
        //      peri (argument of perihelion) is stored in RADIANS; apply time
        //      correction with rate dperi (rad/Julian century from telem).
        //
        //   2. Rz(prot_t) × Rx(qrot_t): orbital frame → J2000 ecliptic
        //      prot and qrot are in DEGREES; rates dprot/dqrot are deg/century.
        if (iflg & SEI_FLG_ROTATE) {
            // Time-corrected argument of perihelion (radians)
            const periT = peri + dperi * T;
            [x, y, z] = this.rotateZ(x, y, z, periT);

            // Time-corrected ascending-node longitude and inclination (degrees→rad)
            const P = (prot + dprot * T) * (Math.PI / 180);
            const Q = (qrot + dqrot * T) * (Math.PI / 180);
            [x, y, z] = this.rotatePlaneToEcliptic(x, y, z, P, Q);
        }

        return [x, y, z];
    }

    /**
     * Evaluate one Chebyshev component using the SE Clenshaw recursion.
     * Computes: coef[0]/2 + sum_{k=1}^{ncoe-1} coef[k] * T_k(t)
     *
     * coef[offset .. offset+ncoe-1]
     *
     * Clenshaw backward recurrence (k from ncoe-1 downto 1):
     *   b[k] = coef[k] + 2t*b[k+1] - b[k+2]
     * After loop: br = b[1], brp2 = b[2]
     * Result: t * b[1] - b[2] + coef[0] / 2
     */
    private echeb(t: number, coef: ArrayLike<number>, offset: number, ncoe: number): number {
        const x2 = 2.0 * t;
        let br = 0.0;
        let brp2 = 0.0;
        let brpp = 0.0;
        for (let j = ncoe - 1; j >= 1; j--) {
            brpp = brp2;
            brp2 = br;
            br   = x2 * brp2 - brpp + coef[offset + j];
        }
        // After loop: br = b[1], brp2 = b[2]
        // CORRECT: t * b[1] - b[2] + c[0]/2
        return t * br - brp2 + coef[offset] / 2.0;
    }

    /**
     * Unpack a coefficient block at `fpos` into a Float64Array of length 3*ncoe.
     *
     * SE uses a 4-group (or 6-group) variable-width integer encoding.
     * Sign is encoded in the LSB of each stored integer (bit 0 = 1 → negative).
     * Magnitude = stored_uint >>> 1, then scaled: magnitude / 1e9 * rmax / 2.
     *
     * Critical: 4-byte values must be read as UNSIGNED (using buf.readUInt32LE)
     * because JavaScript's bitwise `|` operators produce Int32, not UInt32.
     * Use unsigned right shift `>>> 1` (not `>> 1`) for the magnitude.
     */
    private unpackCoefficients(fpos: number, ncoe: number, rmax: number): Float64Array {
        const segp = new Float64Array(3 * ncoe);
        const buf  = this.buf;
        let p    = fpos;
        let idbl = 0;   // running index into segp (increments across all 3 components)

        // One pass per component (X, Y, Z)
        for (let comp = 0; comp < 3; comp++) {
            // Read nsize header (2 bytes, or 4 bytes if bit7 of byte0 is set)
            const c0 = buf[p++];
            const c1 = buf[p++];

            let nsizes: number;
            const nsize = [0, 0, 0, 0, 0, 0];

            if (c0 & 0x80) {
                // 6-group packing: 2 extra header bytes
                const c2 = buf[p++];
                const c3 = buf[p++];
                nsizes    = 6;
                nsize[0]  = c1 >> 4;    nsize[1] = c1 & 0x0F;
                nsize[2]  = c2 >> 4;    nsize[3] = c2 & 0x0F;
                nsize[4]  = c3 >> 4;    nsize[5] = c3 & 0x0F;
            } else {
                // 4-group packing: 2 header bytes total
                nsizes    = 4;
                nsize[0]  = c0 >> 4;    nsize[1] = c0 & 0x0F;
                nsize[2]  = c1 >> 4;    nsize[3] = c1 & 0x0F;
            }

            // Decode each group
            for (let gi = 0; gi < nsizes; gi++) {
                const cnt = nsize[gi];
                if (cnt === 0) continue;

                if (gi <= 3) {
                    // Groups 0-3: byte widths 4, 3, 2, 1 respectively
                    const bw = 4 - gi;
                    for (let m = 0; m < cnt; m++, idbl++) {
                        // Assemble unsigned integer from `bw` bytes (little-endian)
                        // For bw=4 MUST use readUInt32LE — JS bitwise ops are Int32 and
                        // would turn MSB-set values negative, breaking the `>>> 1` shift.
                        let raw: number;
                        if (bw === 4) {
                            raw = this.le
                                ? buf.readUInt32LE(p)
                                : buf.readUInt32BE(p);
                        } else if (this.le) {
                            raw = 0;
                            for (let b = 0; b < bw; b++) raw += buf[p + b] * (256 ** b);
                        } else {
                            raw = 0;
                            for (let b = 0; b < bw; b++) raw = raw * 256 + buf[p + b];
                        }
                        p += bw;
                        // bit 0 = sign; bits 1+ = magnitude
                        const neg = (raw & 1) !== 0;
                        // `>>> 1` is the unsigned right shift (safe for UInt32 values)
                        const val = (raw >>> 1) / 1e9 * rmax / 2.0;
                        segp[idbl] = neg ? -val : val;
                    }
                } else if (gi === 4) {
                    // Group 4: 4 bits (half-byte) per coefficient, 2 per byte
                    // SE stores low nibble and high nibble alternating (m=0 → high nibble)
                    for (let m = 0; m < cnt; m += 2, p++) {
                        const byte = buf[p];
                        const hi = (byte >> 4) & 0x0F;
                        const lo =  byte        & 0x0F;
                        if (m     < cnt) { const neg = (hi & 1) !== 0; segp[idbl++] = neg ? -(hi >>> 1) / 1e9 * rmax / 2 : (hi >>> 1) / 1e9 * rmax / 2; }
                        if (m + 1 < cnt) { const neg = (lo & 1) !== 0; segp[idbl++] = neg ? -(lo >>> 1) / 1e9 * rmax / 2 : (lo >>> 1) / 1e9 * rmax / 2; }
                    }
                } else {
                    // Group 5: 2 bits per coefficient, 4 per byte
                    // SE: m=0 → bits 1-0, m=1 → bits 3-2, m=2 → bits 5-4, m=3 → bits 7-6
                    for (let m = 0; m < cnt; m += 4, p++) {
                        const byte = buf[p];
                        for (let slot = 0; slot < 4 && (m + slot) < cnt; slot++) {
                            const bits = (byte >> (slot * 2)) & 0x03;
                            const neg  = (bits & 1) !== 0;
                            segp[idbl++] = neg ? -(bits >>> 1) / 1e9 * rmax / 2 : (bits >>> 1) / 1e9 * rmax / 2;
                        }
                    }
                }
            }
        }

        return segp;
    }

    /**
     * Rotate position around the Z-axis by angle `a` (radians).
     * Used to apply the argument-of-perihelion rotation (peri field).
     */
    private rotateZ(
        x: number, y: number, z: number, a: number,
    ): [number, number, number] {
        const cosA = Math.cos(a), sinA = Math.sin(a);
        return [cosA * x - sinA * y, sinA * x + cosA * y, z];
    }

    /**
     * Rotate position from orbital plane frame to J2000 ecliptic frame.
     * Transform: x_ecl = Rz(prot) × Rx(qrot) × x_orb
     *
     * @param P  prot in radians (longitude of ascending node)
     * @param Q  qrot in radians (orbital inclination)
     */
    private rotatePlaneToEcliptic(
        x: number, y: number, z: number,
        P: number, Q: number,
    ): [number, number, number] {
        const cosP = Math.cos(P), sinP = Math.sin(P);
        const cosQ = Math.cos(Q), sinQ = Math.sin(Q);
        // R = Rz(P) × Rx(Q)
        // R[0][.] = [cosP, -sinP*cosQ, sinP*sinQ]
        // R[1][.] = [sinP,  cosP*cosQ,-cosP*sinQ]
        // R[2][.] = [  0,      sinQ,      cosQ  ]
        const xe =  cosP * x - sinP * cosQ * y + sinP * sinQ * z;
        const ye =  sinP * x + cosP * cosQ * y - cosP * sinQ * z;
        const ze =             sinQ       * y +       cosQ   * z;
        return [xe, ye, ze];
    }

    // -----------------------------------------------------------------------
    // Binary read helpers
    // -----------------------------------------------------------------------

    private readF64(offset: number): number {
        return this.le ? this.buf.readDoubleLE(offset) : this.buf.readDoubleBE(offset);
    }

    private readI32(offset: number): number {
        return this.le ? this.buf.readInt32LE(offset) : this.buf.readInt32BE(offset);
    }

    private readI16(offset: number): number {
        return this.le ? this.buf.readInt16LE(offset) : this.buf.readInt16BE(offset);
    }

    private read3Bytes(offset: number): number {
        // 3-byte little-endian unsigned integer
        if (this.le) {
            return this.buf[offset] | (this.buf[offset + 1] << 8) | (this.buf[offset + 2] << 16);
        }
        return (this.buf[offset] << 16) | (this.buf[offset + 1] << 8) | this.buf[offset + 2];
    }
}

// ---------------------------------------------------------------------------
// Singleton cache
// ---------------------------------------------------------------------------

const _cache = new Map<string, Se1File>();

export function loadSe1(filePath: string): Se1File {
    const existing = _cache.get(filePath);
    if (existing) return existing;
    const f = new Se1File(filePath);
    _cache.set(filePath, f);
    return f;
}

export function resetSe1Cache(): void {
    _cache.clear();
}
