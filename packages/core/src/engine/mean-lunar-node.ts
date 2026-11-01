/**
 * Mean lunar ascending node (Rahu), tropical degrees on the mean ecliptic of date.
 *
 * Production uses Meeus, *Astronomical Algorithms* eq. 47.7 (Chapront-Touzé &
 * Chapront 1988/1991 ELP-2000/82 reduction). An unsourced ELP/MPP02 W3 alternate
 * was removed (provenance audit 2026-10); see ADR 0012 / 0016.
 *
 * @provenance Chapront-Touzé & Chapront (1988, 1991); J. Meeus (1998) eq. 47.7
 */

import { mod360 } from './coordinates.js';
import { de441SecularMeanNodeDeg } from './de441-mean-lunar-node.js';
import type { PrecisionProfile } from './deltat.js';
import { julianCenturies } from './precession.js';

const J2000_JD = 2451545.0;

/** IERS Conventions (2010) Ω (`faom03`, Simon et al. 1994). */
export function meanLunarNodeFaomAtT(T: number): number {
    const omAs =
        (((450160.398036 + T * (-6962890.5431 + T * (7.4722 + T * (0.007702 + T * -0.00005939)))) %
            1296000) +
            1296000) %
        1296000;
    return mod360(omAs / 3600);
}

/**
 * Meeus, *Astronomical Algorithms* eq. 47.7 (Chapront-Touzé & Chapront 1991).
 * `T` = Julian centuries TT from J2000.0.
 */
export function meanLunarNodeMeeus(T: number): number {
    return mod360(
        125.044_547_9 -
            1_934.136_289_1 * T +
            0.002_075_4 * T ** 2 +
            T ** 3 / 467_441 -
            T ** 4 / 60_616_000,
    );
}

/** Proleptic astronomical year from TT (365.25-day year, deep-era plan step 4). */
export function gregorianYearFromJdTT(jdTT: number): number {
    return 2000 + (jdTT - J2000_JD) / 365.25;
}

/**
 * Tropical mean node longitude (degrees). Prefer {@link meanLunarNodeFromJdTT}
 * when TT Julian day is available.
 */
export function meanLunarNode(T: number): number {
    const jdTT = J2000_JD + T * 36525;
    return meanLunarNodeFromJdTT(jdTT);
}

/** Tropical mean node at TT Julian day (Meeus eq. 47.7). */
export function meanLunarNodeFromJdTT(jdTT: number): number {
    return meanLunarNodeMeeus(julianCenturies(jdTT));
}

/** Mean node at TT Julian day for a precision profile. */
export function meanLunarNodeFromJdTTForProfile(jdTT: number, profile: PrecisionProfile): number {
    const T = julianCenturies(jdTT);
    if (profile !== 'truth') {
        return meanLunarNodeMeeus(T);
    }
    const year = gregorianYearFromJdTT(jdTT);
    if (year >= -500 && year <= 5000) {
        return meanLunarNodeFaomAtT(T);
    }
    const de = de441SecularMeanNodeDeg(jdTT);
    if (de !== null) return de;
    return meanLunarNodeFaomAtT(T);
}

/** Degrees per day (TT) for the mean node at `jdTT`. */
export function meanLunarNodeSpeedDegPerDay(
    jdTT: number,
    profile: PrecisionProfile = 'jhora',
): number {
    const h = 1e-4;
    let d =
        meanLunarNodeFromJdTTForProfile(jdTT + h, profile) -
        meanLunarNodeFromJdTTForProfile(jdTT - h, profile);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d / (2 * h);
}
