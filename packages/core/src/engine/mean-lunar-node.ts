/**
 * Mean lunar ascending node (Rahu), tropical degrees on the mean ecliptic of date.
 *
 * Base: ELP/MPP02 W3 nominal (LLR) on the J2000 inertial ecliptic (Chapront &
 * Francou 2003; Chapront et al. 2002), plus IAU 2006 general precession p_A
 * within ±10 centuries of J2000 and {@link accumulatedPrecession} beyond that.
 *
 * Long-term correction: century table from DE441 (generated), Hann-smoothed,
 * blended to zero around 0–2900 CE. Where Meeus eq. 47.7 still wins against
 * the oracle in an era, Meeus is kept (hybrid, ADR 0012).
 *
 * @provenance Chapront & Francou (2003); Capitaine et al. (2003); Park et al. (2021)
 */

import { mod360 } from './coordinates.js';
import {
    MEAN_NODE_LT_CORR_DAYS_PER_CENTURY,
    MEAN_NODE_LT_CORR_DEG,
    MEAN_NODE_LT_CORR_EPOCH_JD,
    MEAN_NODE_LT_CORR_FIRST_CENTURY,
} from './mean-lunar-node-lt-corr.generated.js';
import {
    generalPrecessionLongitudeArcsec,
    icrfToMeanEclipticOfDate,
    julianCenturies,
    matTransposeVec,
    precessionMatrix,
    toSpherical,
} from './precession.js';

function accumulatedPrecession(jdFrom: number, jdTo: number): number {
    const vernalAtFrom = matTransposeVec(
        precessionMatrix(julianCenturies(jdFrom), jdFrom),
        [1, 0, 0],
    );
    const lon = toSpherical(
        icrfToMeanEclipticOfDate(vernalAtFrom, julianCenturies(jdTo), jdTo),
    ).lon;
    return lon > 180 ? lon - 360 : lon;
}

const J2000_JD = 2451545.0;

/**
 * ELP/MPP02 W3 nominal (LLR) node argument Ω, arcseconds on J2000 ecliptic,
 * Julian centuries TT from J2000.0 (Chapront et al. 2002 Table / CF2003 nominal).
 */
export function elpMpp02W3NominalArcsec(T: number): number {
    return (
        450_160.003_265 +
        -6_967_919.008_851 * T +
        6.003_593 * T ** 2 +
        0.000_076_25 * T ** 3 +
        -3.586e-7 * T ** 4
    );
}

/** Meeus, *Astronomical Algorithms* eq. 47.7 (legacy baseline). */
export function meanLunarNodeMeeus(T: number): number {
    return mod360(
        125.044_547_9 -
            1_934.136_289_1 * T +
            0.002_075_4 * T ** 2 +
            T ** 3 / 467_441 -
            T ** 4 / 60_616_000,
    );
}

/** Approximate Gregorian year from TT Julian day (proleptic). */
export function gregorianYearFromJdTT(jdTT: number): number {
    return 2000 + julianCenturies(jdTT) * 100;
}

/** ELP base on mean ecliptic of date without DE441 correction. */
export function meanLunarNodeElpBaseTropical(jdTT: number): number {
    const T = julianCenturies(jdTT);
    const w3Deg = mod360(elpMpp02W3NominalArcsec(T) / 3600);
    if (Math.abs(T) <= 10) {
        return mod360(w3Deg + generalPrecessionLongitudeArcsec(T) / 3600);
    }
    return mod360(w3Deg + accumulatedPrecession(J2000_JD, jdTT));
}

/** Blend weight for DE441 long-term correction (0 = correction-free era). */
export function meanNodeLtCorrectionBlendWeight(year: number): number {
    if (year >= 0 && year <= 2900) return 0;
    if (year < -100) return 1;
    if (year < 0) return -year / 100;
    if (year <= 3000) return (year - 2900) / 100;
    return 1;
}

function ltCorrectionAtCentury(centuryIndex: number): number {
    const k = centuryIndex - MEAN_NODE_LT_CORR_FIRST_CENTURY;
    if (k < 0 || k >= MEAN_NODE_LT_CORR_DEG.length) return 0;
    return MEAN_NODE_LT_CORR_DEG[k]!;
}

/** Interpolated DE441-derived correction in degrees. */
export function meanNodeLtCorrectionDeg(jdTT: number): number {
    if (MEAN_NODE_LT_CORR_DEG.length <= 1) return 0;
    const t = (jdTT - MEAN_NODE_LT_CORR_EPOCH_JD) / MEAN_NODE_LT_CORR_DAYS_PER_CENTURY;
    const centuryFloat = MEAN_NODE_LT_CORR_FIRST_CENTURY + t;
    const i0 = Math.floor(centuryFloat);
    const frac = centuryFloat - i0;
    const c0 = ltCorrectionAtCentury(i0);
    const c1 = ltCorrectionAtCentury(i0 + 1);
    return c0 + frac * (c1 - c0);
}

/** ELP base plus blended DE441 long-term correction. */
export function meanLunarNodeElpCorrectedTropical(jdTT: number): number {
    const y = gregorianYearFromJdTT(jdTT);
    const w = meanNodeLtCorrectionBlendWeight(y);
    if (w === 0) return meanLunarNodeElpBaseTropical(jdTT);
    const corr = meanNodeLtCorrectionDeg(jdTT);
    return mod360(meanLunarNodeElpBaseTropical(jdTT) + w * corr);
}

/**
 * Eras where Meeus eq. 47.7 must be used so oracle gates and ADR 0012 baselines do
 * not regress. As of the DE441 Hann-quadratic table (2026-10), ELP+ correction
 * does not beat Meeus on any fixture era maximum; hybrid therefore keeps Meeus
 * at all dates until a future frame or smoothing revision closes the gap.
 */
export function meanLunarNodeUsesMeeusHybrid(_year: number): boolean {
    return true;
}

/**
 * Tropical mean node longitude (degrees). Prefer {@link meanLunarNodeFromJdTT}
 * when TT Julian day is available.
 */
export function meanLunarNode(T: number): number {
    const jdTT = J2000_JD + T * 36525;
    return meanLunarNodeFromJdTT(jdTT);
}

/** Tropical mean node at TT Julian day. */
export function meanLunarNodeFromJdTT(jdTT: number): number {
    const T = julianCenturies(jdTT);
    const y = gregorianYearFromJdTT(jdTT);
    if (meanLunarNodeUsesMeeusHybrid(y)) return meanLunarNodeMeeus(T);
    return meanLunarNodeElpCorrectedTropical(jdTT);
}

/** Degrees per day (TT) for the hybrid mean node at `jdTT`. */
export function meanLunarNodeSpeedDegPerDay(jdTT: number): number {
    const h = 1e-4;
    let d = meanLunarNodeFromJdTT(jdTT + h) - meanLunarNodeFromJdTT(jdTT - h);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d / (2 * h);
}
