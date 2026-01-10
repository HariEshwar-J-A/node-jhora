/**
 * Core Mathematical Functions for Vedic Astrology (First Principles)
 * 
 * This module implements the mathematical foundation required for accurate
 * calculation of planetary positions, aspects, and divisional charts.
 * It avoids standard JavaScript modulo operators for angles to ensure
 * correct handling of negative values.
 */

/**
 * Normalizes an angle to the range [0, 360).
 * Handles negative angles correctly (e.g., -10 -> 350).
 * 
 * @param angle - The angle in degrees.
 * @returns The normalized angle between 0 (inclusive) and 360 (exclusive).
 */
export function normalize360(angle: number): number {
    let res = angle % 360;
    if (res < 0) {
        res += 360;
    }
    // Handle -0 case or extremely small negative floating point errors if necessary,
    // though the above covers standard arithmetic.
    // Ensure 360 becomes 0
    if (res >= 360) {
        return 0;
    }
    return res;
}

/**
 * Calculates the shortest distance between two angles on a circle.
 * 
 * @param angle1 - First angle in degrees.
 * @param angle2 - Second angle in degrees.
 * @returns The shortest arc distance between the two angles.
 */
export function getShortestDistance(angle1: number, angle2: number): number {
    const diff = Math.abs(normalize360(angle1) - normalize360(angle2));
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Converts Degrees, Minutes, Seconds to Decimal Degrees.
 * 
 * @param d - Degrees
 * @param m - Minutes
 * @param s - Seconds
 * @returns Decimal representation of the angle.
 */
export function dmsToDecimal(d: number, m: number, s: number): number {
    const sign = d < 0 || (d === 0 && (m < 0 || s < 0)) ? -1 : 1;
    const absD = Math.abs(d);
    const absM = Math.abs(m);
    const absS = Math.abs(s);

    return sign * (absD + absM / 60 + absS / 3600);
}

/**
 * Converts Decimal Degrees to Degrees, Minutes, Seconds.
 * 
 * @param deg - Angle in decimal degrees.
 * @returns Object containing {d, m, s}.
 */
export function decimalToDms(deg: number): { d: number; m: number; s: number } {
    const sign = deg < 0 ? -1 : 1;
    const absDeg = Math.abs(deg);

    const d = Math.floor(absDeg);
    const remainder = absDeg - d;
    const mDec = remainder * 60;
    const m = Math.floor(mDec);
    const s = (mDec - m) * 60;

    return {
        d: sign * d,
        m: m,
        s: s
    };
}

/**
 * Calculates the midpoint between two angles.
 * Important for Bhava Madhya (House Middle) calculations.
 * 
 * @param angle1 - First angle in degrees.
 * @param angle2 - Second angle in degrees.
 * @returns The midpoint angle normalized to 0-360.
 */
export function midpoint(angle1: number, angle2: number): number {
    const a1 = normalize360(angle1);
    const a2 = normalize360(angle2);

    if (Math.abs(a1 - a2) < 1e-9) return a1;

    // Check if the shorter arc crosses 0/360
    const diff = a2 - a1;
    let mid: number;

    if (Math.abs(diff) <= 180) {
        mid = a1 + diff / 2;
    } else {
        // Crosses zero
        // e.g. 350 and 10. diff = -340. abs > 180.
        // We want midpoint to be 0.
        // ((350 + 10 + 360) / 2) % 360 = 720/2 = 360 -> 0 
        mid = (a1 + a2 + 360) / 2;
    }

    return normalize360(mid);
}
