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
import { julianCenturies } from './precession.js';

const J2000_JD = 2451545.0;

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

/** Approximate Gregorian year from TT Julian day (proleptic). */
export function gregorianYearFromJdTT(jdTT: number): number {
    return 2000 + julianCenturies(jdTT) * 100;
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

/** Degrees per day (TT) for the mean node at `jdTT`. */
export function meanLunarNodeSpeedDegPerDay(jdTT: number): number {
    const h = 1e-4;
    let d = meanLunarNodeFromJdTT(jdTT + h) - meanLunarNodeFromJdTT(jdTT - h);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d / (2 * h);
}
