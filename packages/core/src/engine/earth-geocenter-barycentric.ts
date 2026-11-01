// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Geocentre barycentric position (AU, ICRF) for annual parallax on fixed stars.
 *
 * Inside DE440s coverage the JPL DE440 kernel is preferred when registered; outside,
 * truncated VSOP87E (Bretagnon & Francou 1988, CDS VI/81). A cosine blend over
 * ±BLEND_HALF_WIDTH_D days at each kernel edge keeps the parallax step below
 * 0.1 mas (see ADR 0023).
 */

import { AU_KM } from './apparent.js';
import { deltaT } from './deltat.js';
import { type Vec } from './precession.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START } from './provider/de440s.js';
import { earthGeocenterBarycentricAuVsop87 } from './vsop87-earth.js';

/** Half-width of the DE440s ↔ VSOP87 join window, Julian days (TDB). */
export const EARTH_BARYCENTRIC_BLEND_HALF_WIDTH_D = 30;

/** Smoothstep on [0, 1]. */
function smoothstep(u: number): number {
    const x = Math.min(1, Math.max(0, u));
    return x * x * (3 - 2 * x);
}

/**
 * Weight of the DE440 contribution in [0, 1]; VSOP87 weight is 1 − w.
 * Pure DE440 in the kernel interior; pure VSOP87 outside; ramps at edges.
 */
export function earthBarycentricDe440BlendWeight(jdTdb: number): number {
    const w = EARTH_BARYCENTRIC_BLEND_HALF_WIDTH_D;
    const innerStart = DE440S_JD_TDB_START + w;
    const innerEnd = DE440S_JD_TDB_END - w;
    if (jdTdb >= innerStart && jdTdb <= innerEnd) return 1;
    if (jdTdb < DE440S_JD_TDB_START - w || jdTdb > DE440S_JD_TDB_END + w) return 0;
    if (jdTdb < innerStart) {
        return smoothstep((jdTdb - (DE440S_JD_TDB_START - w)) / (2 * w));
    }
    return 1 - smoothstep((jdTdb - innerEnd) / (2 * w));
}

export interface EarthBarycentricDeProvider {
    /** Geocentre barycentric position, AU, ICRF (same frame as DE440 SPK). */
    observerAU(jdUT: number): Vec;
}

let deProvider: EarthBarycentricDeProvider | null = null;

/** Register DE440 (or composite) Earth state for parallax inside the kernel span. */
export function setEarthBarycentricDeProvider(fn: EarthBarycentricDeProvider | null): void {
    deProvider = fn;
}

/** VSOP87E analytic path only (no DE440). */
export function earthGeocenterBarycentricAuAnalytic(jdUT: number): Vec {
    return earthGeocenterBarycentricAuVsop87(jdUT);
}

/**
 * Blended geocentre barycentric AU for modern geometric star parallax.
 * Uses DE440 when registered and inside the blend window; VSOP87E otherwise.
 */
export function earthGeocenterBarycentricAu(jdUT: number): Vec {
    const jdTdb = jdUT + deltaT(jdUT) / 86400.0;
    const analytic = earthGeocenterBarycentricAuVsop87(jdUT);
    const w = earthBarycentricDe440BlendWeight(jdTdb);
    if (w <= 0 || !deProvider) return analytic;
    let de: Vec;
    try {
        de = deProvider.observerAU(jdUT);
    } catch {
        return analytic;
    }
    if (w >= 1) return de;
    return [
        w * de[0] + (1 - w) * analytic[0],
        w * de[1] + (1 - w) * analytic[1],
        w * de[2] + (1 - w) * analytic[2],
    ];
}

/** km → AU helper for DE provider wiring. */
export function kmVecToAu(vec: { x: number; y: number; z: number }): Vec {
    return [vec.x / AU_KM, vec.y / AU_KM, vec.z / AU_KM];
}
