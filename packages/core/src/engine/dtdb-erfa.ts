/**
 * ERFA eraDtdb — TDB−TT at the geocentre (Fairhead & Bretagnon + zero topocentric).
 *
 * @see ERFA src/dtdb.c (BSD-3-Clause, NumFOCUS / SOFA)
 */
import { DTDB_FAIRHD } from '../generated/dtdb-fairhead.js';

const DJ00 = 2451545.0;
const DJM = 365250.0;

/**
 * TDB−TT in seconds for an observer at the geocentre (u = v = 0).
 *
 * @param jdTT Terrestrial Time as Julian Date
 */
export function eraDtdbGeocenterSeconds(jdTT: number): number {
    const date1 = DJ00;
    const date2 = jdTT - DJ00;
    const t = (date1 - DJ00 + date2) / DJM;

    let w0 = 0;
    for (let j = 473; j >= 0; j--) {
        const row = DTDB_FAIRHD[j]!;
        w0 += row[0] * Math.sin(row[1] * t + row[2]);
    }
    let w1 = 0;
    for (let j = 678; j >= 474; j--) {
        const row = DTDB_FAIRHD[j]!;
        w1 += row[0] * Math.sin(row[1] * t + row[2]);
    }
    let w2 = 0;
    for (let j = 763; j >= 679; j--) {
        const row = DTDB_FAIRHD[j]!;
        w2 += row[0] * Math.sin(row[1] * t + row[2]);
    }
    let w3 = 0;
    for (let j = 783; j >= 764; j--) {
        const row = DTDB_FAIRHD[j]!;
        w3 += row[0] * Math.sin(row[1] * t + row[2]);
    }
    let w4 = 0;
    for (let j = 786; j >= 784; j--) {
        const row = DTDB_FAIRHD[j]!;
        w4 += row[0] * Math.sin(row[1] * t + row[2]);
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

/** Julian day (TDB) from TT for the truth precision profile SPK argument. */
export function jdTTtoJdTdbTruth(jdTT: number): number {
    return jdTT + eraDtdbGeocenterSeconds(jdTT) / 86400;
}
