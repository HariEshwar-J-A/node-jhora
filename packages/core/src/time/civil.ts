/**
 * Civil-time resolver — local wall clock + place + IANA zone → UTC.
 *
 * Uses environment IANA rules via `Intl` (browser-safe, no Temporal polyfill).
 * Longitude-based LMT applies before standard-time history or when forced.
 */

import { DateTime } from 'luxon';

import {
    formatUtcIso,
    julianDayToUnixMs,
    localClockToJulianDay,
    unixMsToJulianDay,
} from './calendar.js';
import { usesProlepticJulian } from './historical.js';
import type {
    CivilTimeInput,
    CivilTimePolicy,
    CivilTimeResult,
    CivilTimeWarning,
    LocalClock,
    TzResolutionStep,
} from './types.js';
import { getTzdbVersion, isValidIanaTimeZone } from './tzdb.js';

const DEFAULT_POLICY: CivilTimePolicy = {
    ambiguous: 'earlier',
    gap: 'forward',
};

/** Supported civil-year span (astronomical numbering). */
export const CIVIL_YEAR_MIN = -9_999;
export const CIVIL_YEAR_MAX = 10_000;

const MS_PER_MINUTE = 60_000;
const DAY_MS = 86_400_000;

const INDIA_ZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);

/** Intl is reliable for IANA mapping within roughly this civil-year window. */
const IANA_INTL_YEAR_MIN = 1800;
const IANA_INTL_YEAR_MAX = 2400;

function assertLocalInRange(local: LocalClock): void {
    if (local.year < CIVIL_YEAR_MIN || local.year > CIVIL_YEAR_MAX) {
        throw new RangeError(`Civil year must be between ${CIVIL_YEAR_MIN} and ${CIVIL_YEAR_MAX}`);
    }
    if (local.month < 1 || local.month > 12) throw new RangeError('month out of range');
    if (local.day < 1 || local.day > 31) throw new RangeError('day out of range');
}

/**
 * Local mean time offset, east-positive minutes: exactly 4 minutes of time
 * per degree of longitude (360° = 24 h). Not rounded — rounding to whole
 * minutes would shift the instant by up to 30 s.
 */
function lmtOffsetMinutes(longitude: number): number {
    return longitude * 4;
}

function formatOffset(minutes: number): string {
    const sign = minutes < 0 ? '-' : '+';
    const totalMs = Math.round(Math.abs(minutes) * MS_PER_MINUTE);
    const h = Math.floor(totalMs / 3_600_000);
    const m = Math.floor((totalMs % 3_600_000) / MS_PER_MINUTE);
    const s = (totalMs % MS_PER_MINUTE) / 1000;
    const ss = s.toFixed(3).padStart(6, '0');
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${ss}`;
}

function shouldUseIndiaLmt(input: CivilTimeInput): boolean {
    if (input.forceLmt) return true;
    if (input.preferIanaForIndia) return false;
    if (!INDIA_ZONES.has(input.timezone)) return false;
    return input.local.year < 1900;
}

function shouldUseLmtOnly(input: CivilTimeInput): boolean {
    if (input.forceLmt) return true;
    if (shouldUseIndiaLmt(input)) return true;
    if (
        usesProlepticJulian({
            astronomicalYear: input.local.year,
            month: input.local.month,
            day: input.local.day,
        })
    )
        return true;
    if (input.local.year < IANA_INTL_YEAR_MIN || input.local.year > IANA_INTL_YEAR_MAX) return true;
    return false;
}

function resolveWithFixedOffset(
    input: CivilTimeInput,
    offsetMinutes: number,
    steps: TzResolutionStep[],
    warnings: CivilTimeWarning[],
): CivilTimeResult {
    const localJd = localClockToJulianDay(input.local);
    const utcJd = localJd - offsetMinutes / 1_440;
    let utcMs: number;
    try {
        utcMs = julianDayToUnixMs(utcJd);
    } catch {
        warnings.push({
            code: 'out_of_range',
            message: 'UTC instant is outside the Date representable range',
        });
        throw new RangeError('UTC instant is outside the Date representable range');
    }
    const resolvedUtc = formatUtcIso(utcMs);
    const last = steps[steps.length - 1];
    if (last) {
        last.offsetMinutes = traceMinutes(offsetMinutes);
        last.at = resolvedUtc;
    }
    if (last?.code === 'lmt_offset') {
        warnings.push({
            code: 'lmt_fallback',
            message: 'Longitude-based local mean time (LMT) was used for this instant',
        });
    }
    return {
        resolvedUtc,
        julianDayUt: utcJd,
        tzResolution: {
            tzdbVersion: getTzdbVersion(),
            steps,
            resolvedUtc,
        },
        warnings,
        inDaylightSaving: false,
    };
}

/** UTC offset (east-positive minutes, possibly fractional) of `zone` at `utcMs`, from Intl tzdata. */
function zoneOffsetMinutes(utcMs: number, zone: string): number {
    const dt = DateTime.fromMillis(utcMs, { zone });
    if (!dt.isValid) throw new RangeError(dt.invalidReason ?? `Invalid instant in ${zone}`);
    return dt.offset;
}

/** Offset rounded to whole minutes for the `.njh` trace (`offsetMinutes` is an integer there). */
function traceMinutes(offset: number): number {
    return Math.round(offset);
}

/**
 * Resolve wall-clock time in an IANA zone.
 *
 * Candidate offsets are the zone's offsets 24 h either side of the naive
 * instant; a candidate is valid when the zone really has that offset at the
 * implied UTC instant. Two valid → DST overlap (fold); none → DST gap.
 */
function resolveWithIana(input: CivilTimeInput, policy: CivilTimePolicy): CivilTimeResult {
    const zone = input.timezone;
    const warnings: CivilTimeWarning[] = [];
    const steps: TzResolutionStep[] = [
        {
            code: 'user_timezone',
            summary: `Caller supplied ${zone}`,
            ianaZone: zone,
        },
    ];

    // Exact integer milliseconds: whole-day JD (exact in binary) plus time of day.
    const { hour, minute, second, millisecond = 0 } = input.local;
    const midnightMs = Math.round(
        julianDayToUnixMs(
            localClockToJulianDay({
                ...input.local,
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
            }),
        ),
    );
    const naiveMs = midnightMs + ((hour * 60 + minute) * 60 + second) * 1000 + millisecond;
    const before = zoneOffsetMinutes(naiveMs - DAY_MS, zone);
    const after = zoneOffsetMinutes(naiveMs + DAY_MS, zone);
    const candidates = [...new Set([before, after])]
        .map((offset) => naiveMs - offset * MS_PER_MINUTE)
        .filter((ms) => zoneOffsetMinutes(ms, zone) === (naiveMs - ms) / MS_PER_MINUTE)
        .sort((a, b) => a - b);

    let utcMs: number;
    if (candidates.length >= 2) {
        if (policy.ambiguous === 'reject') {
            throw new RangeError('Ambiguous local civil time (DST overlap)');
        }
        const later = policy.ambiguous === 'later';
        utcMs = later ? candidates[candidates.length - 1] : candidates[0];
        warnings.push({
            code: 'ambiguous_local',
            message: `Local time is repeated (DST overlap); chose the ${later ? 'later' : 'earlier'} instant`,
        });
        steps.push({
            code: 'ambiguous_fold',
            summary: later
                ? 'Chose the later UTC instant for the repeated local time'
                : 'Chose the earlier UTC instant for the repeated local time',
            at: formatUtcIso(utcMs),
        });
    } else if (candidates.length === 1) {
        utcMs = candidates[0];
    } else {
        if (policy.gap === 'reject') {
            throw new RangeError(
                'Local civil time does not exist in the requested time zone (DST gap)',
            );
        }
        // forward: read the clock with the pre-transition offset (lands after the gap);
        // backward: read it with the post-transition offset (lands before the gap).
        const backward = policy.gap === 'backward';
        const offset = backward ? after : before;
        utcMs = naiveMs - offset * MS_PER_MINUTE;
        warnings.push({
            code: 'gap_local',
            message: `Local time fell in a DST gap; resolved using ${backward ? 'backward' : 'forward'} policy`,
        });
        steps.push({
            code: 'gap_skip',
            summary: backward
                ? 'Local time did not exist; moved back before the transition'
                : 'Local time did not exist; advanced past the transition',
            offsetMinutes: traceMinutes(offset),
            at: formatUtcIso(utcMs),
        });
    }

    const dt = DateTime.fromMillis(utcMs, { zone });
    const inDst = dt.isInDST;
    steps.push({
        code: 'dst_rule',
        summary: inDst ? 'DST offset applied' : 'No DST offset applied',
        offsetMinutes: traceMinutes(dt.offset),
    });

    const resolvedUtc = formatUtcIso(utcMs);
    return {
        resolvedUtc,
        julianDayUt: unixMsToJulianDay(utcMs),
        tzResolution: { tzdbVersion: getTzdbVersion(), steps, resolvedUtc },
        warnings,
        inDaylightSaving: inDst,
    };
}

/**
 * Resolve a civil (wall-clock) birth time to UTC with a full trace.
 */
export function resolveCivilTime(input: CivilTimeInput): CivilTimeResult {
    assertLocalInRange(input.local);
    if (!isValidIanaTimeZone(input.timezone)) {
        throw new RangeError(`Unknown IANA time zone: ${input.timezone}`);
    }

    const policy: CivilTimePolicy = { ...DEFAULT_POLICY, ...input.policy };
    const steps: TzResolutionStep[] = [
        {
            code: 'user_timezone',
            summary: `Caller supplied ${input.timezone}`,
            ianaZone: input.timezone,
        },
    ];
    const warnings: CivilTimeWarning[] = [];

    if (input.manualOffset) {
        const label =
            input.manualOffset.label ??
            (input.manualOffset.kind === 'war_time'
                ? 'War time offset override'
                : 'Manual offset override');
        steps.push({
            code: 'manual_override',
            summary: label,
            offsetMinutes: input.manualOffset.offsetMinutes,
        });
        return resolveWithFixedOffset(input, input.manualOffset.offsetMinutes, steps, warnings);
    }

    if (shouldUseLmtOnly(input)) {
        const offset = lmtOffsetMinutes(input.longitude);
        const summary = shouldUseIndiaLmt(input)
            ? `India pre-1900 LMT from longitude (${input.longitude.toFixed(4)}°, UTC${formatOffset(offset)})`
            : `LMT from longitude (${input.longitude.toFixed(4)}°, UTC${formatOffset(offset)})`;
        steps.push({
            code: 'lmt_offset',
            summary,
            offsetMinutes: offset,
        });
        return resolveWithFixedOffset(input, offset, steps, warnings);
    }

    return resolveWithIana(input, policy);
}
