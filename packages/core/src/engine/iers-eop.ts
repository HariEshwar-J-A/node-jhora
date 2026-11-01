/**
 * Optional IERS Earth-orientation table for the `truth` precision profile.
 *
 * Data ship in `@node-jhora/eop` (finals2000A UT1−UTC and polar motion xp/yp).
 * Core has no runtime dependency on that package; callers register a parsed
 * table with {@link setIersEopTable}.
 *
 * @provenance IERS Conventions (2010); USNO/IERS finals2000A Bulletin A columns.
 */

import type { PrecisionProfile } from './deltat.js';
import { getDeltaTContext } from './deltat.js';

export interface IersEopSample {
    ut1MinusUtcSeconds: number;
    xpArcsec: number;
    ypArcsec: number;
    inTable: boolean;
}

export interface IersEopTable {
    readonly mjdStart: number;
    readonly count: number;
    readonly ut1UtcMicros: Int32Array;
    readonly xpMilliarcsec: Int16Array;
    readonly ypMilliarcsec: Int16Array;
}

let activeTable: IersEopTable | null = null;

export function setIersEopTable(table: IersEopTable | null): void {
    activeTable = table;
}

export function getIersEopTable(): IersEopTable | null {
    return activeTable;
}

function mjdUtcFromJdUt(jdUt: number): number {
    return jdUt - 2400000.5;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function lookupIersEop(jdUt: number, table: IersEopTable = activeTable!): IersEopSample {
    if (!table) {
        return { ut1MinusUtcSeconds: 0, xpArcsec: 0, ypArcsec: 0, inTable: false };
    }
    const mjd = mjdUtcFromJdUt(jdUt);
    if (mjd < table.mjdStart || mjd > table.mjdStart + table.count - 1) {
        return { ut1MinusUtcSeconds: 0, xpArcsec: 0, ypArcsec: 0, inTable: false };
    }
    let idx = mjd - table.mjdStart;
    if (idx <= 0) idx = 0;
    if (idx >= table.count - 1) idx = table.count - 1;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, table.count - 1);
    const mjd0 = table.mjdStart + i0;
    const mjd1 = table.mjdStart + i1;
    const t = mjd1 > mjd0 ? (mjd - mjd0) / (mjd1 - mjd0) : 0;
    const ut1Micros = lerp(table.ut1UtcMicros[i0]!, table.ut1UtcMicros[i1]!, t);
    const xpMas = lerp(table.xpMilliarcsec[i0]!, table.xpMilliarcsec[i1]!, t);
    const ypMas = lerp(table.ypMilliarcsec[i0]!, table.ypMilliarcsec[i1]!, t);
    return {
        ut1MinusUtcSeconds: ut1Micros / 1e6,
        xpArcsec: xpMas / 1000,
        ypArcsec: ypMas / 1000,
        inTable: true,
    };
}

/** Julian day on UT1 scale for sidereal time when the truth profile has EOP loaded. */
export function julianDayUt1(
    jdUtc: number,
    profile: PrecisionProfile = getDeltaTContext().profile,
): number {
    if (profile !== 'truth' || !activeTable) return jdUtc;
    const e = lookupIersEop(jdUtc);
    if (!e.inTable) return jdUtc;
    return jdUtc + e.ut1MinusUtcSeconds / 86400;
}

const DEG = Math.PI / 180;

/**
 * Polar-motion correction to tropical ascendant longitude (degrees).
 * Δλ ≈ (xp sin λ − yp cos λ) / cos φ (IERS Conventions 2010, small-angle form).
 */
export function polarMotionAscendantDeltaDeg(
    ascDeg: number,
    latDeg: number,
    xpArcsec: number,
    ypArcsec: number,
): number {
    const lam = ascDeg * DEG;
    const phi = latDeg * DEG;
    const cosPhi = Math.cos(phi);
    if (Math.abs(cosPhi) < 1e-8) return 0;
    const xp = (xpArcsec / 3600) * DEG;
    const yp = (ypArcsec / 3600) * DEG;
    return (xp * Math.sin(lam) - yp * Math.cos(lam)) / cosPhi / DEG;
}

export function polarMotionForProfile(
    jdUt: number,
    profile: PrecisionProfile = getDeltaTContext().profile,
): IersEopSample {
    if (profile !== 'truth' || !activeTable) {
        return { ut1MinusUtcSeconds: 0, xpArcsec: 0, ypArcsec: 0, inTable: false };
    }
    return lookupIersEop(jdUt);
}
