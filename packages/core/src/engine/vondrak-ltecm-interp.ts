/**
 * Piecewise cubic Hermite interpolation of the Vondrák `eraLtecm` matrix (32-day nodes).
 * Used for DE441 secular mean-node sampling; max Ω error vs exact matrix is bounded in tests.
 */

import { julianCenturies, vondrakLtecmMatrixInto } from './precession.js';

/** Node spacing for offline proof tests (32 d exceeds 1e-6″ on Ω; see unit test). */
export const VONDRAK_LTECM_NODE_DAYS = 32;
/** Production mean-node path uses exact `eraLtecm` per sample JD. */
export const VONDRAK_LTECM_PROOF_NODE_DAYS = 1;

const scratchExact = new Float64Array(9);
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
    /** dM/du (u ∈ [0,1] over each segment), length 9N. */
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

/** Interpolated matrix at JD(TT); falls back to exact evaluation outside the table span. */
export function vondrakLtecmMatrixIntoInterpolated(
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
    const j1 = table.nodeJds[i + 1]!;
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

/** Exact matrix at JD(TT) (reference for error measurement). */
export function vondrakLtecmMatrixIntoExact(jdTT: number, out: Float64Array): void {
    vondrakLtecmMatrixInto(julianCenturies(jdTT), out);
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
    const RAD = 180 / Math.PI;
    const exact = new Float64Array(9);
    const interp = new Float64Array(9);
    let maxArcsec = 0;
    for (let jd = jdLo; jd <= jdHi + 1e-9; jd += stepDays) {
        vondrakLtecmMatrixIntoExact(jd, exact);
        vondrakLtecmMatrixIntoInterpolated(table, jd, interp);
        const ex = exact[0]! * hx + exact[1]! * hy + exact[2]! * hz;
        const ey = exact[3]! * hx + exact[4]! * hy + exact[5]! * hz;
        const omEx = Math.atan2(ex, -ey) * RAD;
        const ix = interp[0]! * hx + interp[1]! * hy + interp[2]! * hz;
        const iy = interp[3]! * hx + interp[4]! * hy + interp[5]! * hz;
        const omIn = Math.atan2(ix, -iy) * RAD;
        let d = (omIn - omEx) * 3600;
        if (d > 180 * 3600) d -= 360 * 3600;
        if (d < -180 * 3600) d += 360 * 3600;
        maxArcsec = Math.max(maxArcsec, Math.abs(d));
    }
    return maxArcsec;
}
