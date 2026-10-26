/**
 * Bridge ΔT between the last USNO/IERS observation and the published forecast
 * polynomials. Values are **not** from USNO predictions; they were measured
 * from pyswisseph 2.10.03 swe.deltat(UT)×86400 at 1 January 0h UT for the
 * listed years (Julian year length 365.25 d, epoch JD 2451544.5).
 *
 * Regenerate: node tools/generate-deltat-modern-bridge.mjs
 * Measured: 2026-10-26
 */

export const MODERN_BRIDGE_FIRST_YEAR = 2027;

export const MODERN_BRIDGE_LAST_YEAR = 2028;

/** [Gregorian year, ΔT seconds] measured from pyswisseph (see file header). */
export const MODERN_BRIDGE_SAMPLES: readonly (readonly [number, number])[] = [
    [2027, 68.8],
    [2028, 68.8],
];
