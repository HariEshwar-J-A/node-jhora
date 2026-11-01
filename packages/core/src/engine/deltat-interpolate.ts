// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Shared ΔT interpolation helpers (Bessel annual, USNO monthly linear).
 * @see Abramowitz & Stegun §25.2; Swiss Ephemeris programmer manual ch. 7 (ΔT).
 */

/** Bessel's central-difference formula through fourth differences. */
export function interpolateBesselFourth(
    p: number,
    fm2: number,
    fm1: number,
    f0: number,
    f1: number,
    f2: number,
    f3: number,
): number {
    const d1 = f1 - f0;
    const d2sum = f2 - f1 - (f0 - fm1);
    const d3 = f2 - 3 * f1 + 3 * f0 - fm1;
    const d4sum = fm2 - 4 * fm1 + 6 * f0 - 4 * f1 + f2 + (fm1 - 4 * f0 + 6 * f1 - 4 * f2 + f3);
    return (
        f0 +
        p * d1 +
        ((p * (p - 1)) / 4) * d2sum +
        ((p * (p - 1) * (p - 0.5)) / 6) * d3 +
        (((p + 1) * p * (p - 1) * (p - 2)) / 48) * d4sum
    );
}

/** Linear interpolation on sorted [year, value] knots (year strictly increasing). */
export function interpolateLinearKnots(
    year: number,
    knots: readonly (readonly [number, number])[],
): number {
    if (year <= knots[0][0]) return knots[0][1];
    if (year >= knots[knots.length - 1][0]) return knots[knots.length - 1][1];
    let lo = 0;
    let hi = knots.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (knots[mid][0] <= year) lo = mid;
        else hi = mid;
    }
    const [y0, v0] = knots[lo];
    const [y1, v1] = knots[hi];
    const w = (year - y0) / (y1 - y0);
    return v0 + w * (v1 - v0);
}
