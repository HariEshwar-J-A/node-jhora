// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * DE441 secular mean lunar node for the truth profile outside faom03's valid span.
 *
 * One draconic cycle (P = 6798.383 d): sample Ω every 4 d, linear intercept at the
 * cycle centre; average intercepts over ±250 Julian years on the truth mean ecliptic
 * (Vondrák two-pole / IAU 2006 inside 1600–2200 TT). Park et al. 2021 DE441; ERFA BSD.
 *
 * @provenance deep-era-plan.md step 4; IERS Conventions (2010) eq. 5.43 for faom03 fallback.
 */

import { mod360 } from './coordinates.js';
import {
    buildDtdbSecularPrefillTable,
    eraDtdbGeocenterSecondsSecularPrefill,
    setDtdbSecularPrefillTable,
} from './dtdb-secular-prefill.js';
import { icrfToMeanEclipticOfDateForProfile, julianCenturies, type Vec } from './precession.js';
import { vondrakLtecmMatrixInto } from './precession.js';
import type { EphemerisState } from './provider/types.js';
import {
    buildVondrakLtecmSegmentTable,
    VONDRAK_LTECM_NODE_DAYS,
    vondrakLtecmMatrixIntoLagrange,
    type VondrakLtecmSegmentTable,
} from './vondrak-ltecm-interp.js';

const DRACONIC_PERIOD_DAYS = 6798.383;
const HALF_WINDOW_JD = 250 * 365.25;
const SAMPLE_STEP_DAYS = 4;
const RAD = 180 / Math.PI;
const IAU2006_JD_MIN = 2_305_448.0;
const IAU2006_JD_MAX = 2_524_594.0;
const GRID_EPS = 1e-5;

/** Sampled Ω (deg) keyed by JD(TT). */
const omegaSampleCache = new Map<number, number>();
const vondrakScratch9 = new Float64Array(9);
const lagrangeSegHint = { seg: 0 };
let meanNodePrefillActive = false;
let secularAnchorJdTT: number | null = null;
let secularLtecmTable: VondrakLtecmSegmentTable | undefined;
let secularLtecmAnchor: number | undefined;
/** Test hook: exact `eraLtecm` per sample instead of the shared Lagrange table. */
let forceExactVondrakLtecm = false;

/** @internal Tests only — compare Lagrange table vs exact Vondrák matrix path. */
export function setForceExactVondrakLtecmForTests(on: boolean): void {
    forceExactVondrakLtecm = on;
}

export interface De441MeanNodeSampler {
    readonly jdTdbMin: number;
    readonly jdTdbMax: number;
    moonGeocentricState(jdTdb: number): EphemerisState | null;
    /** Epoch-aligned TT grid jdTT + n·stepDays for n ∈ [nMin, nMax] (monotonic ET). */
    fillEpochGridSamples?(
        anchorJdTT: number,
        nMin: number,
        nMax: number,
        stepDays: number,
        visit: (jdTT: number, state: EphemerisState) => void,
    ): void;
    /** Monotonic walk for arbitrary sorted JD(TT) (off-grid cycle samples). */
    fillSortedJdSamples?(
        jdTTList: readonly number[],
        visit: (jdTT: number, state: EphemerisState) => void,
    ): void;
}

let sampler: De441MeanNodeSampler | null = null;

/** Intercept at cycle centre (degrees), keyed by centre JD(TT) × 10⁴. */
const interceptCache = new Map<number, number>();
/** Secular node at JD(TT), keyed by TT × 10⁶. */
const secularCache = new Map<number, number>();

export function setDe441MeanNodeSampler(s: De441MeanNodeSampler | null): void {
    sampler = s;
    interceptCache.clear();
    secularCache.clear();
    omegaSampleCache.clear();
    secularAnchorJdTT = null;
    secularLtecmTable = undefined;
    secularLtecmAnchor = undefined;
}

export function clearDe441MeanNodeCaches(): void {
    interceptCache.clear();
    secularCache.clear();
    omegaSampleCache.clear();
    secularAnchorJdTT = null;
    secularLtecmTable = undefined;
    secularLtecmAnchor = undefined;
    lagrangeSegHint.seg = 0;
    setDtdbSecularPrefillTable(undefined);
}

function sampleKey(jdTT: number): number {
    return Math.round(jdTT * 1e6) / 1e6;
}

function epochGridIndex(anchorJdTT: number, jdTT: number): number {
    return Math.round((jdTT - anchorJdTT) / SAMPLE_STEP_DAYS);
}

function jdFromEpochGridIndex(anchorJdTT: number, n: number): number {
    return anchorJdTT + n * SAMPLE_STEP_DAYS;
}

function isOnEpochGrid(anchorJdTT: number, jdTT: number): boolean {
    const jg = jdFromEpochGridIndex(anchorJdTT, epochGridIndex(anchorJdTT, jdTT));
    return Math.abs(jg - jdTT) < GRID_EPS;
}

function applyTruthEclipticMatrix(
    m: Float64Array,
    x: number,
    y: number,
    z: number,
): [number, number, number] {
    return [
        m[0]! * x + m[1]! * y + m[2]! * z,
        m[3]! * x + m[4]! * y + m[5]! * z,
        m[6]! * x + m[7]! * y + m[8]! * z,
    ];
}

function ensureSecularLtecmTable(
    anchorJdTT: number,
    jdMin: number,
    jdMax: number,
): VondrakLtecmSegmentTable {
    if (
        secularLtecmTable &&
        secularLtecmAnchor === anchorJdTT &&
        secularLtecmTable.jdLo <= jdMin + 1e-6 &&
        secularLtecmTable.jdHi >= jdMax - 1e-6
    ) {
        return secularLtecmTable;
    }
    secularLtecmTable = buildVondrakLtecmSegmentTable(
        anchorJdTT,
        jdMin,
        jdMax,
        VONDRAK_LTECM_NODE_DAYS,
        false,
    );
    secularLtecmAnchor = anchorJdTT;
    return secularLtecmTable;
}

function truthRotateAngularMomentum(hx: number, hy: number, hz: number, jdTT: number): Vec {
    if (jdTT >= IAU2006_JD_MIN && jdTT <= IAU2006_JD_MAX) {
        return icrfToMeanEclipticOfDateForProfile(
            [hx, hy, hz],
            julianCenturies(jdTT),
            jdTT,
            'truth',
        );
    }
    const anchor = secularAnchorJdTT ?? jdTT;
    if (forceExactVondrakLtecm) {
        vondrakLtecmMatrixInto(julianCenturies(jdTT), vondrakScratch9);
        return applyTruthEclipticMatrix(vondrakScratch9, hx, hy, hz);
    }
    const { jdMin, jdMax } = secularWindowBounds(anchor);
    const table = ensureSecularLtecmTable(anchor, jdMin, jdMax);
    vondrakLtecmMatrixIntoLagrange(table, jdTT, vondrakScratch9, lagrangeSegHint);
    return applyTruthEclipticMatrix(vondrakScratch9, hx, hy, hz);
}

function omegaDegFromState(jdTT: number, st: EphemerisState): number {
    const hx = st.y * st.vz - st.z * st.vy;
    const hy = st.z * st.vx - st.x * st.vz;
    const hz = st.x * st.vy - st.y * st.vx;
    const he = truthRotateAngularMomentum(hx, hy, hz, jdTT);
    return mod360(Math.atan2(he[0], -he[1]) * RAD);
}

function jdTdbFromJdTT(jdTT: number): number {
    return jdTT + eraDtdbGeocenterSecondsSecularPrefill(jdTT) / 86400.0;
}

function cacheOmegaFromState(jdTT: number, st: EphemerisState): number {
    const key = sampleKey(jdTT);
    if (!meanNodePrefillActive) {
        const cached = omegaSampleCache.get(key);
        if (cached !== undefined) return cached;
    }
    const out = omegaDegFromState(jdTT, st);
    omegaSampleCache.set(key, out);
    return out;
}

function osculatingNodeLongitudeDeg(jdTT: number, _anchorJdTT: number): number | null {
    const key = sampleKey(jdTT);
    const cached = omegaSampleCache.get(key);
    if (cached !== undefined) return cached;

    if (!sampler) return null;
    const jdTdb = jdTdbFromJdTT(jdTT);
    if (jdTdb < sampler.jdTdbMin || jdTdb > sampler.jdTdbMax) return null;

    const st = sampler.moonGeocentricState(jdTdb);
    if (!st) return null;
    return cacheOmegaFromState(jdTT, st);
}

function unwrapNear(lon: number, ref: number): number {
    let d = lon - ref;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return ref + d;
}

/** Linear least-squares intercept of Ω (deg) at `jdCentreTT` over one draconic cycle. */
export function cycleInterceptAtJdTT(jdCentreTT: number, anchorJdTT: number): number | null {
    const key = Math.round(jdCentreTT * 1e4);
    const hit = interceptCache.get(key);
    if (hit !== undefined) return hit;

    const halfP = DRACONIC_PERIOD_DAYS / 2;
    const ts: number[] = [];
    const ys: number[] = [];
    let prevUnwrapped: number | undefined;
    for (let jd = jdCentreTT - halfP; jd <= jdCentreTT + halfP + 1e-9; jd += SAMPLE_STEP_DAYS) {
        const om = osculatingNodeLongitudeDeg(jd, anchorJdTT);
        if (om === null) continue;
        const y = prevUnwrapped === undefined ? om : unwrapNear(om, prevUnwrapped);
        prevUnwrapped = y;
        ts.push(jd - jdCentreTT);
        ys.push(y);
    }
    if (ts.length < 3) return null;

    let sumT = 0;
    let sumY = 0;
    let sumTT = 0;
    let sumTY = 0;
    for (let i = 0; i < ts.length; i++) {
        const t = ts[i]!;
        const y = ys[i]!;
        sumT += t;
        sumY += y;
        sumTT += t * t;
        sumTY += t * y;
    }
    const n = ts.length;
    const denom = n * sumTT - sumT * sumT;
    const slope = Math.abs(denom) > 1e-12 ? (n * sumTY - sumT * sumY) / denom : 0;
    const intercept = (sumY - slope * sumT) / n;
    interceptCache.set(key, intercept);
    return intercept;
}

/** DE441 ±250 yr mean node on the truth ecliptic, or null if the kernel is unavailable. */
export function de441SecularMeanNodeDeg(jdTT: number): number | null {
    const cacheKey = Math.round(jdTT * 1e6);
    const cached = secularCache.get(cacheKey);
    if (cached !== undefined) return cached;

    prefillDe441MeanNodeSamples(jdTT);

    const kMax = Math.floor(HALF_WINDOW_JD / DRACONIC_PERIOD_DAYS);
    const intercepts: number[] = [];
    let prevIntercept: number | undefined;
    for (let k = -kMax; k <= kMax; k++) {
        const centre = jdTT + k * DRACONIC_PERIOD_DAYS;
        const ic = cycleInterceptAtJdTT(centre, jdTT);
        if (ic === null) continue;
        const y = prevIntercept === undefined ? ic : unwrapNear(ic, prevIntercept);
        prevIntercept = y;
        intercepts.push(y);
    }
    if (intercepts.length === 0) return null;
    const mean = intercepts.reduce((a, b) => a + b, 0) / intercepts.length;
    const out = mod360(mean);
    secularCache.set(cacheKey, out);
    return out;
}

function secularWindowBounds(jdTT: number): {
    jdMin: number;
    jdMax: number;
    nMin: number;
    nMax: number;
} {
    const halfP = DRACONIC_PERIOD_DAYS / 2;
    const jdMin = jdTT - HALF_WINDOW_JD - halfP;
    const jdMax = jdTT + HALF_WINDOW_JD + halfP;
    const nMin = Math.ceil((jdMin - jdTT) / SAMPLE_STEP_DAYS - 1e-12);
    const nMax = Math.floor((jdMax - jdTT) / SAMPLE_STEP_DAYS + 1e-12);
    return { jdMin, jdMax, nMin, nMax };
}

function collectOffGridCycleSampleJds(anchorJdTT: number): number[] {
    const halfP = DRACONIC_PERIOD_DAYS / 2;
    const kMax = Math.floor(HALF_WINDOW_JD / DRACONIC_PERIOD_DAYS);
    const seen = new Set<number>();
    for (let k = -kMax; k <= kMax; k++) {
        const centre = anchorJdTT + k * DRACONIC_PERIOD_DAYS;
        for (let jd = centre - halfP; jd <= centre + halfP + 1e-9; jd += SAMPLE_STEP_DAYS) {
            if (isOnEpochGrid(anchorJdTT, jd)) continue;
            seen.add(sampleKey(jd));
        }
    }
    return [...seen].sort((a, b) => a - b);
}

function allSecularSampleJds(jdTT: number): number[] {
    const { nMin, nMax } = secularWindowBounds(jdTT);
    const seen = new Set<number>();
    for (let n = nMin; n <= nMax; n++) {
        seen.add(sampleKey(jdFromEpochGridIndex(jdTT, n)));
    }
    for (const jd of collectOffGridCycleSampleJds(jdTT)) {
        seen.add(sampleKey(jd));
    }
    return [...seen].sort((a, b) => a - b);
}

function prefillAllOmegaSamples(jdTT: number): void {
    secularAnchorJdTT = jdTT;
    meanNodePrefillActive = true;
    const { jdMin, jdMax } = secularWindowBounds(jdTT);
    ensureSecularLtecmTable(jdTT, jdMin, jdMax);
    setDtdbSecularPrefillTable(buildDtdbSecularPrefillTable(jdTT, jdMin, jdMax));
    try {
        const allJds = allSecularSampleJds(jdTT);
        if (sampler?.fillSortedJdSamples) {
            sampler.fillSortedJdSamples(allJds, (jd, st) => cacheOmegaFromState(jd, st));
        } else {
            for (const jd of allJds) {
                const st = sampler?.moonGeocentricState(jdTdbFromJdTT(jd));
                if (st) cacheOmegaFromState(jd, st);
            }
        }
    } finally {
        meanNodePrefillActive = false;
        setDtdbSecularPrefillTable(undefined);
    }
}

export function prefillDe441MeanNodeSamples(jdTT: number): void {
    prefillAllOmegaSamples(jdTT);
}

export interface De441MeanNodeProfileMs {
    coldMs: number;
    warmMs: number;
}

export function benchmarkDe441MeanNode(jdTT: number): De441MeanNodeProfileMs {
    clearDe441MeanNodeCaches();
    const t0 = performance.now();
    de441SecularMeanNodeDeg(jdTT);
    const coldMs = performance.now() - t0;
    const t1 = performance.now();
    de441SecularMeanNodeDeg(jdTT);
    const warmMs = performance.now() - t1;
    return { coldMs, warmMs };
}

export function profileDe441MeanNodePrefill(jdTT: number): {
    prefillMs: number;
    sampleCount: number;
    vondrakExactPerSample: boolean;
} {
    clearDe441MeanNodeCaches();
    const t0 = performance.now();
    prefillAllOmegaSamples(jdTT);
    const prefillMs = performance.now() - t0;
    const { nMin, nMax } = secularWindowBounds(jdTT);
    const sampleCount = nMax - nMin + 1 + collectOffGridCycleSampleJds(jdTT).length;
    return { prefillMs, sampleCount, vondrakExactPerSample: false };
}
