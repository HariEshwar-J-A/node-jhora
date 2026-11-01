/**
 * Window-local cubic-Lagrange ΔTDB for DE441 secular Ω prefill only (not chart-grade TT→TDB).
 */

import { eraDtdbGeocenterSecondsUncached, fairheadGeocenterSeconds } from './dtdb-erfa.js';

/** 96 d nodes: Ω ≤ 1e−6″; coarser Fairhead grid for 250 ms cold gate. */
export const DTDB_SECULAR_PREFILL_NODE_DAYS = 96;

export interface DtdbSecularPrefillTable {
    readonly anchorJd: number;
    readonly jdLo: number;
    readonly jdHi: number;
    readonly nodeSpanDays: number;
    readonly nodeJds: Float64Array;
    readonly nodeSec: Float64Array;
}

let activeTable: DtdbSecularPrefillTable | undefined;
let forceExactForTests = false;

export function setDtdbSecularPrefillTable(table: DtdbSecularPrefillTable | undefined): void {
    activeTable = table;
}

/** @internal Tests — compare Ω path with exact Fairhead TT→TDB at every sample. */
export function setForceExactDtdbSecularPrefillForTests(on: boolean): void {
    forceExactForTests = on;
}

export function buildDtdbSecularPrefillTable(
    anchorJd: number,
    jdLo: number,
    jdHi: number,
    nodeSpanDays: number = DTDB_SECULAR_PREFILL_NODE_DAYS,
): DtdbSecularPrefillTable {
    const span = nodeSpanDays;
    const k0 = Math.floor((jdLo - anchorJd) / span) - 1;
    const k1 = Math.ceil((jdHi - anchorJd) / span) + 1;
    const n = k1 - k0 + 1;
    const nodeJds = new Float64Array(n);
    const nodeSec = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        nodeJds[i] = anchorJd + (k0 + i) * span;
        nodeSec[i] = fairheadGeocenterSeconds(nodeJds[i]!);
    }
    return {
        anchorJd,
        jdLo,
        jdHi,
        nodeSpanDays: span,
        nodeJds,
        nodeSec,
    };
}

function lagrange4At(
    x: number,
    x0: number,
    x1: number,
    x2: number,
    x3: number,
    y0: number,
    y1: number,
    y2: number,
    y3: number,
): number {
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
    return l0 * y0 + l1 * y1 + l2 * y2 + l3 * y3;
}

export function dtdbSecularPrefillSecondsFromTable(
    table: DtdbSecularPrefillTable,
    jdTT: number,
    segHint?: { seg: number },
): number {
    const n = table.nodeJds.length;
    if (n < 4 || jdTT < table.nodeJds[0]! || jdTT > table.nodeJds[n - 1]!) {
        return fairheadGeocenterSeconds(jdTT);
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
    return lagrange4At(
        jdTT,
        table.nodeJds[i0]!,
        table.nodeJds[i0 + 1]!,
        table.nodeJds[i0 + 2]!,
        table.nodeJds[i0 + 3]!,
        table.nodeSec[i0]!,
        table.nodeSec[i0 + 1]!,
        table.nodeSec[i0 + 2]!,
        table.nodeSec[i0 + 3]!,
    );
}

const prefillSegHint = { seg: 0 };

export function eraDtdbGeocenterSecondsSecularPrefill(jdTT: number): number {
    if (forceExactForTests || !activeTable) {
        return eraDtdbGeocenterSecondsUncached(jdTT);
    }
    return dtdbSecularPrefillSecondsFromTable(activeTable, jdTT, prefillSegHint);
}

/** Max |interp − exact| Fairhead geocentre ΔTDB (seconds) on a uniform JD grid. */
export function maxSecularDtdbInterpErrorSeconds(
    anchorJd: number,
    jdLo: number,
    jdHi: number,
    nodeSpanDays: number,
    sampleStepDays: number,
): number {
    const table = buildDtdbSecularPrefillTable(anchorJd, jdLo, jdHi, nodeSpanDays);
    let maxErr = 0;
    const hint = { seg: 0 };
    for (let jd = jdLo; jd <= jdHi + 1e-9; jd += sampleStepDays) {
        const exact = fairheadGeocenterSeconds(jd);
        const interp = dtdbSecularPrefillSecondsFromTable(table, jd, hint);
        const err = Math.abs(interp - exact);
        if (err > maxErr) {
            maxErr = err;
        }
    }
    return maxErr;
}
