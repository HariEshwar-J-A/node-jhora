// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Documented supported domains for ephemeris and house calculations.
 */

import { julianDayUt } from '../time/historical.js';

/**
 * Astronomical year numbering: 10000 BCE = −10000, 10000 CE = +10000.
 * Both proleptic Julian (before 1582-10-15) and Gregorian civil dates in
 * this span are accepted when converted to UT Julian day.
 */
export const EPHEMERIS_ASTRO_YEAR_MIN = -10_000;

/** Last supported civil instant in UT: 10000-12-31 23:59:59. */
export const EPHEMERIS_ASTRO_YEAR_MAX = 10_000;

/** Julian Day (UT) at 0h on {@link EPHEMERIS_ASTRO_YEAR_MIN}-01-01. */
export const EPHEMERIS_JD_UT_MIN: number = julianDayUt({
    astronomicalYear: EPHEMERIS_ASTRO_YEAR_MIN,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
});

/** Julian Day (UT) at the end of 10000-12-31 (23:59:59). */
export const EPHEMERIS_JD_UT_MAX: number =
    julianDayUt({
        astronomicalYear: EPHEMERIS_ASTRO_YEAR_MAX,
        month: 12,
        day: 31,
        hour: 23,
        minute: 59,
        second: 59,
    }) +
    1 / 86_400;

/**
 * Largest magnitude accepted for `deltaTOverrideSeconds` (about ±10 days).
 * Overrides beyond historical/plausible ΔT are rejected as invalid input.
 */
export const DELTA_T_OVERRIDE_ABS_MAX_SECONDS = 864_000;

/**
 * Legacy 0.25-day step (Swiss Ephemeris pre-velocity FD). Planet speeds use
 * analytic kinematics (ADR 0008); this constant sizes DE431 chunk prefetch only.
 */
export const PLANET_SPEED_STEP_DAYS = 0.25;

/** Extra margin (days) when prefetching DE431 chunks for ΔT and speed steps. */
export const CHUNK_PREFETCH_MARGIN_DAYS = 3;
