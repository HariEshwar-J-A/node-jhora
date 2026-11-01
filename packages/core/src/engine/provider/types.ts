// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Pluggable ephemeris providers — barycentric/heliocentric state vs TDB Julian day.
 *
 * Implementations must be pure (no hidden globals) so the same code runs in Node
 * and in browser workers with an injected chunk loader.
 */

import type { Vec3 } from '../chebyshev.js';

/** NAIF body id (see {@link NAIF} in spk.ts). */
export type EphemerisBodyId = number;

export type EphemerisFrame = 'barycentric' | 'heliocentric';

export interface EphemerisState extends Vec3 {
    /** km, J2000 equatorial */
    x: number;
    y: number;
    z: number;
    /** km/s */
    vx: number;
    vy: number;
    vz: number;
}

export interface EphemerisCoverage {
    /** Inclusive start, TDB Julian day */
    jdTdbStart: number;
    /** Inclusive end, TDB Julian day */
    jdTdbEnd: number;
    /** Short label, e.g. `de440s`, `de431-long` */
    kernelId: string;
    /** Optional build or file version string */
    version?: string;
}

export interface EphemerisProvider {
    readonly id: string;
    readonly coverage: EphemerisCoverage;
    /** NAIF ids this provider can return in {@link state}. */
    readonly bodies: readonly EphemerisBodyId[];

    /**
     * Position and velocity at `jdTdb` (TDB Julian day).
     *
     * `barycentric` — relative to the solar-system barycenter (NAIF 0), matching
     * `SpkFile.getBarycentric`. `heliocentric` — relative to the Sun (10).
     */
    state(jdTdb: number, body: EphemerisBodyId, frame: EphemerisFrame): EphemerisState;
}

/** How the engine chooses between DE440s and long-range NJCE chunk kernels. */
export const EPHEMERIS_POLICIES = ['auto', 'de440s', 'de431_long', 'de441_long'] as const;
export type EphemerisPolicy = (typeof EPHEMERIS_POLICIES)[number];

export const DEFAULT_EPHEMERIS_POLICY: EphemerisPolicy = 'auto';

export interface EphemerisProvenance {
    policy: EphemerisPolicy;
    kernelId: string;
    kernelVersion?: string;
}
