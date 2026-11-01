/**
 * ERFA eraDtdb — TDB−TT at the geocentre (Fairhead & Bretagnon + zero topocentric).
 *
 * @see ERFA src/dtdb.c (BSD-3-Clause, NumFOCUS / SOFA)
 */
import { DTDB_FAIRHD } from '../generated/dtdb-fairhead.js';

const DJ00 = 2451545.0;
const DJM = 365250.0;

let uncachedCallCount = 0;

export function eraDtdbGeocenterSecondsUncachedCallCount(): number {
    return uncachedCallCount;
}

export function resetEraDtdbGeocenterSecondsUncachedCallCount(): void {
    uncachedCallCount = 0;
}

/** Fairhead + Bretagnon geocentre series (no call-count side effect). */
export function fairheadGeocenterSeconds(jdTT: number): number {
    const t = (jdTT - DJ00) / DJM;

    let w0 = 0;
    let w1 = 0;
    let w2 = 0;
    let w3 = 0;
    let w4 = 0;
    for (let j = 786; j >= 0; j--) {
        const row = DTDB_FAIRHD[j]!;
        const s = row[0] * Math.sin(row[1] * t + row[2]);
        if (j <= 473) {
            w0 += s;
        } else if (j <= 678) {
            w1 += s;
        } else if (j <= 763) {
            w2 += s;
        } else if (j <= 783) {
            w3 += s;
        } else {
            w4 += s;
        }
    }

    const wf = t * (t * (t * (t * w4 + w3) + w2) + w1) + w0;
    const wj =
        0.00065e-6 * Math.sin(6069.776754 * t + 4.021194) +
        0.00033e-6 * Math.sin(213.299095 * t + 5.543132) +
        -0.00196e-6 * Math.sin(6208.294251 * t + 5.696701) +
        -0.00173e-6 * Math.sin(74.781599 * t + 2.4359) +
        0.03638e-6 * t * t;

    return wf + wj;
}

/** Full Fairhead + Bretagnon series (increments uncached call-count metric). */
export function eraDtdbGeocenterSecondsUncached(jdTT: number): number {
    uncachedCallCount++;
    return fairheadGeocenterSeconds(jdTT);
}

/**
 * TDB−TT in seconds for an observer at the geocentre (u = v = 0).
 *
 * @param jdTT Terrestrial Time as Julian Date
 */
export function eraDtdbGeocenterSeconds(jdTT: number): number {
    uncachedCallCount++;
    return fairheadGeocenterSeconds(jdTT);
}

/** Julian day (TDB) from TT for the truth precision profile SPK argument. */
export function jdTTtoJdTdbTruth(jdTT: number): number {
    return jdTT + eraDtdbGeocenterSeconds(jdTT) / 86400;
}
