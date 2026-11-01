// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Civil-time resolution types.
 *
 * {@link TzResolutionTrace} and {@link TzResolutionStep} mirror the `.njh`
 * `birth.tzResolution` shape in `@node-jhora/format` (schema v2).
 */

import type { CalendarMode } from './historical.js';

/** Wall-clock components in astronomical year numbering (year 0 = 1 BC). */
export interface LocalClock {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond?: number;
}

export type TzResolutionStepCode =
    | 'user_timezone'
    | 'atlas_lookup'
    | 'dst_rule'
    | 'ambiguous_fold'
    | 'gap_skip'
    | 'lmt_offset'
    | 'manual_override'
    | 'legacy_import';

export interface TzResolutionStep {
    code: TzResolutionStepCode;
    summary: string;
    /** Local or offset-bearing ISO-8601 when the step records a specific instant. */
    at?: string;
    offsetMinutes?: number;
    ianaZone?: string;
}

export interface TzResolutionTrace {
    tzdbVersion?: string;
    steps: TzResolutionStep[];
    resolvedUtc: string;
}

export type AmbiguousLocalPolicy = 'earlier' | 'later' | 'reject';
export type GapLocalPolicy = 'forward' | 'backward' | 'reject';

export interface CivilTimePolicy {
    /** Which UTC instant to pick when local time is repeated (fall-back). */
    ambiguous?: AmbiguousLocalPolicy;
    /** How to resolve a local time that does not exist (spring-forward gap). */
    gap?: GapLocalPolicy;
}

/** Explicit offset override (war time, historical manual zone, caller-supplied). */
export interface ManualOffsetOverride {
    /** East-positive offset from UTC, in minutes. */
    offsetMinutes: number;
    /** Short label for the trace (defaults to "Manual offset override"). */
    label?: string;
    kind?: 'war_time' | 'manual';
}

export interface CivilTimeInput {
    local: LocalClock;
    /** IANA time zone id (used when historic rules apply). */
    timezone: string;
    latitude: number;
    longitude: number;
    /**
     * How to read `local` before 1582-10-15. Default `'auto'` matches JHora /
     * Swiss Ephemeris (Julian before the reform, Gregorian from 1582-10-15).
     */
    calendar?: CalendarMode;
    policy?: CivilTimePolicy;
    /** Force longitude-based LMT (4 min per degree) regardless of zone history. */
    forceLmt?: boolean;
    /** When true, keep IANA historic offsets for India before 1900 instead of LMT. */
    preferIanaForIndia?: boolean;
    manualOffset?: ManualOffsetOverride;
}

export interface CivilTimeWarning {
    code: 'ambiguous_local' | 'gap_local' | 'lmt_fallback' | 'out_of_range';
    message: string;
}

export interface CivilTimeResult {
    /** UTC instant as ISO-8601 ending in `Z` (no sub-second unless input had ms). */
    resolvedUtc: string;
    /** Julian Day (UT), for ephemeris callers. */
    julianDayUt: number;
    tzResolution: TzResolutionTrace;
    warnings: CivilTimeWarning[];
    /** True when the resolved offset differed from standard-time rules (DST on, LMT, manual). */
    inDaylightSaving: boolean;
}
