// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Hooks for long-range accuracy work (separate PRs).
 *
 * Sidereal positions before ~1600 CE need:
 * - Long-term ΔT (beyond Espenak & Meeus tabulated range)
 * - Long-term precession (e.g. Vondrák et al. 2011)
 *
 * This module documents extension points only; do not implement here while
 * E3-S4-T3 / ayanamsa refactors land in parallel (#255).
 */

export interface LongRangeAstroHooks {
    /** ΔT seconds at Julian day UT; undefined = use built-in model. */
    deltaT?: (jdUt: number) => number;
    /** Precession matrix J2000 → mean equator of date; undefined = IAU 2006. */
    precessionMatrix?: (jdTt: number) => number[][];
}
