/**
 * High-Precision Math Primitives for Vedic Astrology
 *
 * All planetary longitude, Ayanamsa, and divisional chart arithmetic
 * MUST flow through these functions. Native JS Number is only permitted
 * at WASM/external API boundaries.
 *
 * Precision: 34 significant digits (exceeds IEEE-754 double by ~18 digits).
 * Rounding:  ROUND_HALF_EVEN (banker's rounding — minimises statistical bias).
 */

import { Decimal } from 'decimal.js';

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_EVEN });

export { Decimal };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const D360 = new Decimal(360);
export const D180 = new Decimal(180);
export const D90  = new Decimal(90);
export const D30  = new Decimal(30);
export const D27  = new Decimal(27);
export const D12  = new Decimal(12);
export const D6   = new Decimal(6);
export const D0   = new Decimal(0);
export const D1   = new Decimal(1);

/** Exact Nakshatra span: 360/27 = 13.333...° */
export const NAKSHATRA_SPAN_D: Decimal = D360.div(D27);

/** Nakshatra span as number (display only — do NOT use in calculations). */
export const NAKSHATRA_SPAN_N: number = NAKSHATRA_SPAN_D.toNumber();

/** Dasha year: Tropical Year = 365.242189623 days (pyjhora standard). */
export const DASHA_YEAR_DAYS = new Decimal('365.242189623');

/** Dasha year in milliseconds. */
export const DASHA_YEAR_MS: Decimal = DASHA_YEAR_DAYS.times(24 * 3600 * 1000);

// ---------------------------------------------------------------------------
// Angular normalisation
// ---------------------------------------------------------------------------

/** Normalise a Decimal angle to [0, 360). Handles negatives and values > 360. */
export function normalize360D(angle: Decimal): Decimal {
    let r = angle.mod(D360);
    if (r.isNegative()) r = r.plus(D360);
    // Guard against -0 / floating artefact at exact 360
    if (r.gte(D360)) return D0;
    return r;
}

/** Normalise a number angle to [0, 360) via Decimal — eliminates IEEE-754 drift. */
export function normalize360N(angle: number): number {
    return normalize360D(new Decimal(angle)).toNumber();
}

/** Shortest arc between two angles (always ≥ 0, ≤ 180). */
export function shortestArcD(a: Decimal, b: Decimal): Decimal {
    const diff = normalize360D(a).minus(normalize360D(b)).abs();
    return diff.gt(D180) ? D360.minus(diff) : diff;
}

// ---------------------------------------------------------------------------
// DMS ↔ Decimal conversion
// ---------------------------------------------------------------------------

/**
 * Degrees-Minutes-Seconds → Decimal degrees.
 * Sign is inferred from the first non-zero signed component.
 */
export function dmsToDecimalD(d: number, m: number, s: number): Decimal {
    const sign = (d < 0 || (d === 0 && (m < 0 || s < 0))) ? new Decimal(-1) : new Decimal(1);
    return sign.times(
        new Decimal(Math.abs(d))
            .plus(new Decimal(Math.abs(m)).div(60))
            .plus(new Decimal(Math.abs(s)).div(3600))
    );
}

/**
 * Decimal degrees → { d, m, s }.
 * `s` is returned as a Decimal to preserve sub-arc-second resolution.
 */
export function decimalToDmsD(deg: Decimal): { d: number; m: number; s: Decimal } {
    const sign = deg.isNegative() ? -1 : 1;
    const abs  = deg.abs();
    const d    = abs.floor();
    const rem  = abs.minus(d).times(60);
    const m    = rem.floor();
    const s    = rem.minus(m).times(60);
    return { d: sign * d.toNumber(), m: m.toNumber(), s };
}

// ---------------------------------------------------------------------------
// Midpoint
// ---------------------------------------------------------------------------

/**
 * Midpoint of two angles on a circle — always takes the shorter arc.
 * Correctly handles the 350°/10° wraparound.
 */
export function midpointD(a: Decimal, b: Decimal): Decimal {
    const a1 = normalize360D(a);
    const a2 = normalize360D(b);
    if (a1.minus(a2).abs().lt(new Decimal('1e-20'))) return a1;

    const diff = a2.minus(a1);
    const mid  = diff.abs().lte(D180)
        ? a1.plus(diff.div(2))
        : a1.plus(a2).plus(D360).div(2);
    return normalize360D(mid);
}

// ---------------------------------------------------------------------------
// Utility constructors
// ---------------------------------------------------------------------------

/** Construct a Decimal from number or string. Alias: keeps calling code brief. */
export function D(value: number | string): Decimal {
    return new Decimal(value);
}

/** Convert Decimal to number at an output/API boundary. */
export function toNum(d: Decimal): number {
    return d.toNumber();
}
