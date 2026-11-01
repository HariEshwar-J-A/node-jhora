// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Bridge ΔT between the last USNO/IERS observation and the published forecast
 * polynomials (Swiss Ephemeris manual ch. 7 layout).
 *
 * @provenance U.S. Naval Observatory, Earth Orientation Department,
 * "deltat.preds" quarterly TT−UT predictions,
 * https://maia.usno.navy.mil/ser7/deltat.preds — Year column at 2027.00 and
 * 2028.00 (MJD 61406 / 61771). Retrieved: 2026-10-30.
 */

export const MODERN_BRIDGE_FIRST_YEAR = 2027;

export const MODERN_BRIDGE_LAST_YEAR = 2028;

/** [Gregorian year, ΔT seconds] from USNO deltat.preds (see file header). */
export const MODERN_BRIDGE_SAMPLES: readonly (readonly [number, number])[] = [
    [2027, 69.14],
    [2028, 69.34],
];
