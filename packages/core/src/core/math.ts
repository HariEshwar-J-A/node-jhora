/**
 * Core Mathematical Functions for Vedic Astrology
 *
 * PUBLIC API — all functions take and return native `number`.
 * Internally all critical angular arithmetic is delegated to `precise.ts`
 * (Decimal.js, 34-digit precision) to eliminate IEEE-754 floating-point drift.
 *
 * This module is intentionally kept thin. All heavy lifting lives in precise.ts.
 */

import { Decimal } from 'decimal.js';
import {
    normalize360D,
    shortestArcD,
    dmsToDecimalD,
    decimalToDmsD,
    midpointD,
    D,
    toNum,
} from './precise.js';

// Re-export Decimal utilities for packages that need them directly
export { Decimal, normalize360D, shortestArcD, dmsToDecimalD, decimalToDmsD, midpointD, D as toDecimal, toNum } from './precise.js';

/**
 * Normalises an angle to [0, 360).
 * Handles negatives (e.g. -10 → 350) and values ≥ 360 correctly.
 * Uses Decimal.js internally to eliminate modulo floating-point drift.
 */
export function normalize360(angle: number): number {
    return toNum(normalize360D(D(angle)));
}

/**
 * Shortest angular distance between two angles on a circle.
 * Result is always in [0, 180].
 */
export function getShortestDistance(angle1: number, angle2: number): number {
    return toNum(shortestArcD(D(angle1), D(angle2)));
}

/**
 * Degrees-Minutes-Seconds → Decimal degrees.
 * Sign is inferred from the first non-zero signed component.
 */
export function dmsToDecimal(d: number, m: number, s: number): number {
    return toNum(dmsToDecimalD(d, m, s));
}

/**
 * Decimal degrees → { d, m, s }.
 * `s` is rounded to 6 decimal places to avoid floating-point noise.
 */
export function decimalToDms(deg: number): { d: number; m: number; s: number } {
    const { d, m, s } = decimalToDmsD(new Decimal(deg));
    return { d, m, s: toNum(s.toDecimalPlaces(6)) };
}

/**
 * Midpoint of two angles on a circle — always takes the shorter arc.
 * Correctly handles the 350°/10° wraparound.
 */
export function midpoint(angle1: number, angle2: number): number {
    return toNum(midpointD(D(angle1), D(angle2)));
}
