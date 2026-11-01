/**
 * Vondrák `eraLtecm` matrix on a uniform JD(TT) grid with per-element Lagrange
 * interpolation (4 nodes). Used for DE441 secular mean-node sampling outside the
 * IAU 2006 window; error vs exact matrix is bounded in unit tests.
 *
 * @provenance Vondrák et al. (2011); cubic Lagrange on 32 d nodes (pyerfa check).
 */

import { julianCenturies, vondrakLtecmMatrixInto } from './precession.js';

/** Node spacing for production mean-node path (32 d, Lagrange ≤ 1e-6″ on Ω). */
export const VONDRAK_LTECM_NODE_DAYS = 32;
/** 1 d nodes for offline Hermite proof only. */
export const VONDRAK_LTECM_PROOF_NODE_DAYS = 1;

const scratchPlus = new Float64Array(9);
const scratchMinus = new Float64Array(9);

export interface VondrakLtecmSegmentTable {
    readonly anchorJd: number;
    readonly jdLo: number;
    readonly jdHi: number;
    readonly nodeSpanDays: number;
    /** Exact node JD(TT), length N. */
    readonly nodeJds: Float64Array;
    /** Row-major 3×3 at each node, length 9N. */
    readonly nodeM: Float64Array;
    /** dM/du (u ∈ [0,1] over each segment), length 9N — Hermite proof only. */
    readonly nodeDdu: Float64Array;
}

function hermite9(
    u: number,
    m0: number,
    m1: number,
    d0: number,
    d1: number,
    spanDays: number,
): number {
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return h00 * m0 + h10 * spanDays * d0 + h01 * m1 + h11 * spanDays * d1;
}

/** Build node tables covering [jdLo, jdHi] with nodes anchored at `anchorJd + k·nodeSpanDays`. */
export function buildVondrakLtecmSegmentTable(
    anchorJd: number,
    jdLo: number,
    jdHi: number,
    nodeSpanDays: number = VONDRAK_LTECM_NODE_DAYS,
    /** When false, skip Hermite slopes (production Lagrange path only). */
    withHermiteSlopes: boolean = false,
): VondrakLtecmSegmentTable {
    const span = nodeSpanDays;
    const k0 = Math.floor((jdLo - anchorJd) / span) - 1;
    const k1 = Math.ceil((jdHi - anchorJd) / span) + 1;
    const n = k1 - k0 + 1;
    const nodeJds = new Float64Array(n);
    const nodeM = new Float64Array(9 * n);
    for (let i = 0; i < n; i++) {
        const jd = anchorJd + (k0 + i) * span;
        nodeJds[i] = jd;
        vondrakLtecmMatrixInto(julianCenturies(jd), nodeM.subarray(9 * i, 9 * i + 9));
    }
    const nodeDdu = new Float64Array(9 * n);
    if (withHermiteSlopes) {
        const jdStep = 0.5;
        for (let i = 0; i < n; i++) {
            const jd = nodeJds[i]!;
            vondrakLtecmMatrixInto(julianCenturies(jd + jdStep), scratchPlus);
            vondrakLtecmMatrixInto(julianCenturies(jd - jdStep), scratchMinus);
            const off = 9 * i;
            for (let c = 0; c < 9; c++) {
                const dMdjd = (scratchPlus[c]! - scratchMinus[c]!) / (2 * jdStep);
                nodeDdu[off + c] = dMdjd * span;
            }
        }
    }
    return {
        anchorJd,
        jdLo,
        jdHi,
        nodeSpanDays: span,
        nodeJds,
        nodeM,
        nodeDdu,
    };
}

/** Piecewise cubic Hermite (legacy proof path; not used in production mean node). */
export function vondrakLtecmMatrixIntoHermite(
    table: VondrakLtecmSegmentTable,
    jdTT: number,
    out: Float64Array,
): void {
    if (jdTT < table.nodeJds[0]! || jdTT > table.nodeJds[table.nodeJds.length - 1]!) {
        vondrakLtecmMatrixInto(julianCenturies(jdTT), out);
        return;
    }
    let i = 0;
    while (i < table.nodeJds.length - 2 && jdTT > table.nodeJds[i + 1]!) {
        i++;
    }
    const j0 = table.nodeJds[i]!;
    const u = (jdTT - j0) / table.nodeSpanDays;
    const o0 = 9 * i;
    const o1 = 9 * (i + 1);
    for (let c = 0; c < 9; c++) {
        out[c] = hermite9(
            u,
            table.nodeM[o0 + c]!,
            table.nodeM[o1 + c]!,
            table.nodeDdu[o0 + c]!,
            table.nodeDdu[o1 + c]!,
            table.nodeSpanDays,
        );
    }
}

/** 4-point Lagrange per matrix element on the shared node grid (production). */
export function vondrakLtecmMatrixIntoLagrange(
    table: VondrakLtecmSegmentTable,
    jdTT: number,
    out: Float64Array,
    segHint?: { seg: number },
): void {
    const n = table.nodeJds.length;
    if (n < 4 || jdTT < table.nodeJds[0]! || jdTT > table.nodeJds[n - 1]!) {
        vondrakLtecmMatrixInto(julianCenturies(jdTT), out);
        return;
    }
    let seg = segHint?.seg ?? 0;
    while (seg < n - 2 && jdTT > table.nodeJds[seg + 1]!) {
        seg++;
    }
    while (seg > 0 && jdTT < table.nodeJds[seg]!) {
        seg--;
    }
    if (segHint) {
        segHint.seg = seg;
    }
    const i0 = Math.max(0, Math.min(seg - 1, n - 4));
    const x0 = table.nodeJds[i0]!;
    const x1 = table.nodeJds[i0 + 1]!;
    const x2 = table.nodeJds[i0 + 2]!;
    const x3 = table.nodeJds[i0 + 3]!;
    const x = jdTT;
    const d01 = x0 - x1;
    const d02 = x0 - x2;
    const d03 = x0 - x3;
    const d12 = x1 - x2;
    const d13 = x1 - x3;
    const d23 = x2 - x3;
    const l0 = ((x - x1) * (x - x2) * (x - x3)) / (d01 * d02 * d03);
    const l1 = ((x - x0) * (x - x2) * (x - x3)) / (-d01 * d12 * d13);
    const l2 = ((x - x0) * (x - x1) * (x - x3)) / (-d02 * -d12 * d23);
    const l3 = ((x - x0) * (x - x1) * (x - x2)) / (-d03 * -d13 * -d23);
    const o0 = 9 * i0;
    for (let c = 0; c < 9; c++) {
        out[c] =
            l0 * table.nodeM[o0 + c]! +
            l1 * table.nodeM[o0 + 9 + c]! +
            l2 * table.nodeM[o0 + 18 + c]! +
            l3 * table.nodeM[o0 + 27 + c]!;
    }
}

/** @deprecated Use {@link vondrakLtecmMatrixIntoLagrange}. */
export function vondrakLtecmMatrixIntoInterpolated(
    table: VondrakLtecmSegmentTable,
    jdTT: number,
    out: Float64Array,
): void {
    vondrakLtecmMatrixIntoHermite(table, jdTT, out);
}

/** Exact matrix at JD(TT) (reference for error measurement). */
export function vondrakLtecmMatrixIntoExact(jdTT: number, out: Float64Array): void {
    vondrakLtecmMatrixInto(julianCenturies(jdTT), out);
}

function maxOmegaInterpErrorArcsec(
    interp: (table: VondrakLtecmSegmentTable, jd: number, out: Float64Array) => void,
    table: VondrakLtecmSegmentTable,
    jdLo: number,
    jdHi: number,
    stepDays: number,
    hx: number,
    hy: number,
    hz: number,
): number {
    const RAD = 180 / Math.PI;
    const exact = new Float64Array(9);
    const interpOut = new Float64Array(9);
    let maxArcsec = 0;
    for (let jd = jdLo; jd <= jdHi + 1e-9; jd += stepDays) {
        vondrakLtecmMatrixIntoExact(jd, exact);
        interp(table, jd, interpOut);
        const ex = exact[0]! * hx + exact[1]! * hy + exact[2]! * hz;
        const ey = exact[3]! * hx + exact[4]! * hy + exact[5]! * hz;
        const omEx = Math.atan2(ex, -ey) * RAD;
        const ix = interpOut[0]! * hx + interpOut[1]! * hy + interpOut[2]! * hz;
        const iy = interpOut[3]! * hx + interpOut[4]! * hy + interpOut[5]! * hz;
        const omIn = Math.atan2(ix, -iy) * RAD;
        let d = (omIn - omEx) * 3600;
        if (d > 180 * 3600) d -= 360 * 3600;
        if (d < -180 * 3600) d += 360 * 3600;
        maxArcsec = Math.max(maxArcsec, Math.abs(d));
    }
    return maxArcsec;
}

/** Max |Ω_interp − Ω_exact| in arcseconds for a synthetic h vector (deep-era Vondrák only). */
export function maxVondrakOmegaInterpErrorArcsec(
    table: VondrakLtecmSegmentTable,
    jdLo: number,
    jdHi: number,
    stepDays: number,
    hx: number,
    hy: number,
    hz: number,
): number {
    return maxOmegaInterpErrorArcsec(
        vondrakLtecmMatrixIntoLagrange,
        table,
        jdLo,
        jdHi,
        stepDays,
        hx,
        hy,
        hz,
    );
}

/** Hermite 32 d grid error (documents the retired production path). */
export function maxVondrakOmegaHermiteInterpErrorArcsec(
    table: VondrakLtecmSegmentTable,
    jdLo: number,
    jdHi: number,
    stepDays: number,
    hx: number,
    hy: number,
    hz: number,
): number {
    return maxOmegaInterpErrorArcsec(
        vondrakLtecmMatrixIntoHermite,
        table,
        jdLo,
        jdHi,
        stepDays,
        hx,
        hy,
        hz,
    );
}
