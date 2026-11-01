// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Civil-time ↔ Julian Day helpers for the civil-time resolver.
 *
 * All calendar arithmetic (proleptic Julian before 1582-10-15, Gregorian from
 * that date, astronomical year numbering) is delegated to the single shared
 * implementation in {@link ./historical.ts}; this module only adds time-of-day
 * and Unix-epoch conversions.
 */

import { type CalendarMode, julianDayUt } from './historical.js';
import type { LocalClock } from './types.js';

/** Julian Day of the Unix epoch, 1970-01-01T00:00:00Z. */
const JD_UNIX_EPOCH = 2440587.5;

const MS_PER_DAY = 86_400_000;

/** Fractional hours of a wall-clock time of day (including milliseconds). */
export function localClockToHourUT(local: {
    hour: number;
    minute: number;
    second: number;
    millisecond?: number;
}): number {
    const ms = local.millisecond ?? 0;
    return local.hour + local.minute / 60 + local.second / 3600 + ms / 3_600_000;
}

/**
 * Julian Day of a wall-clock reading, treating the clock as if it were UT
 * (subtract the zone offset afterwards). Uses the shared calendar in
 * `historical.ts`: proleptic Julian before 1582-10-15, Gregorian after.
 */
export function localClockToJulianDay(local: LocalClock, calendar: CalendarMode = 'auto'): number {
    const midnight = julianDayUt(
        {
            astronomicalYear: local.year,
            month: local.month,
            day: local.day,
            hour: 0,
            minute: 0,
            second: 0,
        },
        calendar,
    );
    return midnight + localClockToHourUT(local) / 24;
}

export function julianDayToUnixMs(jd: number): number {
    return (jd - JD_UNIX_EPOCH) * MS_PER_DAY;
}

export function unixMsToJulianDay(ms: number): number {
    return ms / MS_PER_DAY + JD_UNIX_EPOCH;
}

/**
 * UTC ISO-8601 with `Z`. Note: ISO-8601 (and `Date`) use the proleptic
 * Gregorian calendar, so instants before 1582-10-15 print as Gregorian dates
 * even though the local input was read as Julian; `julianDayUt` is exact.
 */
export function formatUtcIso(ms: number): string {
    const d = new Date(Math.round(ms));
    if (!Number.isFinite(d.getTime())) {
        throw new RangeError('UTC instant is outside the representable Date range');
    }
    return d.toISOString();
}
