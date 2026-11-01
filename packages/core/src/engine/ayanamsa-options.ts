// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Optional sidereal ayanamsa flags (public numbering documented in swisseph.htm §2.8).
 */

/** Caller supplies `t0` and mean ayanamsa at `t0`; propagated with the traditional algorithm. */
export const AYANAMSA_MODE_USER = 255;

export const AYANAMSA_FLAGS = {
    /** Rotate sidereal longitudes onto the ecliptic of anchor t0 (proper transform). */
    ECL_T0: 256,
    /** Solar-system invariable (Laplace) plane for sidereal longitudes / star ayanamsa. */
    SSY_PLANE: 512,
    /** USER anchor epoch is UT instead of TT. */
    USER_UT: 1024,
    /** Project onto the mean ecliptic of date instead of t0. */
    ECL_DATE: 2048,
    /** Use jhora-profile precession without modern bridge adjustments. */
    ORIGINAL_PRECESSION: 8192,
} as const;

export type AyanamsaFlag = (typeof AYANAMSA_FLAGS)[keyof typeof AYANAMSA_FLAGS];

/** Optional parameters for {@link getAyanamsa} beyond mode, JD, frame, and profile. */
export interface AyanamsaOptions {
    /** Bitwise OR of {@link AYANAMSA_FLAGS} values. */
    ayanamsaFlags?: number;
    /**
     * Required when `mode === 255` ({@link AYANAMSA_MODE_USER}).
     * `ayanamsaDeg` is the mean ayanamsa at `t0Jd` (tropical − sidereal), degrees.
     */
    user?: {
        t0Jd: number;
        ayanamsaDeg: number;
        /** When true, `t0Jd` is UT; otherwise TT (default). */
        t0IsUt?: boolean;
    };
}

export function hasAyanamsaFlag(bits: number | undefined, flag: number): boolean {
    return ((bits ?? 0) & flag) !== 0;
}
