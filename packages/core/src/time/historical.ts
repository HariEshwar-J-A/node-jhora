// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { NodeJHoraError, NodeJHoraErrorCode } from '../errors.js';

/**
 * Historical calendar input — proleptic Julian before the Gregorian reform,
 * astronomical year numbering (year 0 = 1 BC), matching Swiss Ephemeris / JHora.
 *
 * Dates on and after 1582-10-15 use the Gregorian calendar. Earlier dates use
 * the proleptic Julian calendar (no historical discontinuity at the reform).
 *
 * In `'auto'` mode the ten civil dates 1582-10-05 … 1582-10-14 never existed
 * (the historical Gregorian reform); callers must pick `'gregorian'` or
 * `'julian'` explicitly to interpret those labels.
 */

export const CALENDAR_MODES = ['auto', 'gregorian', 'julian'] as const;
export type CalendarMode = (typeof CALENDAR_MODES)[number];

export interface HistoricalDateTime {
    /** Astronomical year: 1 = 1 AD, 0 = 1 BC, -1 = 2 BC, … */
    astronomicalYear: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

const GREGORIAN_START = { y: 1582, m: 10, d: 15 };
const GREGORIAN_GAP_FIRST = { y: 1582, m: 10, d: 5 };
const GREGORIAN_GAP_LAST = { y: 1582, m: 10, d: 14 };

/** Civil dates suppressed by the 1582 Gregorian reform (invalid in `'auto'`). */
export function isGregorianReformGap(
    parts: Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'>,
): boolean {
    const y = parts.astronomicalYear;
    if (y !== GREGORIAN_GAP_FIRST.y) return false;
    if (parts.month !== GREGORIAN_GAP_FIRST.m) return false;
    return parts.day >= GREGORIAN_GAP_FIRST.d && parts.day <= GREGORIAN_GAP_LAST.d;
}

/** Thrown when a reform-gap date is supplied with calendar `'auto'`. */
export class GregorianReformGapError extends RangeError {
    readonly code = 'gregorian_reform_gap' as const;

    constructor(
        public readonly astronomicalYear: number,
        public readonly month: number,
        public readonly day: number,
    ) {
        super(
            `Civil date ${astronomicalYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
                'did not exist in the historical Gregorian reform; use calendar "gregorian" or "julian"',
        );
        this.name = 'GregorianReformGapError';
    }
}

function isJulianLeapYear(y: number): boolean {
    return y % 4 === 0;
}

function isGregorianLeapYear(y: number): boolean {
    return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

function daysInMonth(y: number, m: number, cal: 'julian' | 'gregorian'): number {
    const leap = cal === 'julian' ? isJulianLeapYear(y) : isGregorianLeapYear(y);
    if (m === 2) return leap ? 29 : 28;
    if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
    return 31;
}

/**
 * Validate civil y-m-d for the resolved calendar. Throws {@link RangeError} for
 * impossible dates; {@link GregorianReformGapError} for reform-gap dates in `'auto'`.
 */
export function assertValidCivilDate(
    parts: Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'>,
    calendar: CalendarMode = 'auto',
): void {
    if (calendar === 'auto' && isGregorianReformGap(parts)) {
        throw new GregorianReformGapError(parts.astronomicalYear, parts.month, parts.day);
    }
    const { astronomicalYear: y, month: m, day: d } = parts;
    if (m < 1 || m > 12) throw new RangeError(`month out of range: ${m}`);
    const cal =
        calendar === 'julian'
            ? 'julian'
            : calendar === 'gregorian'
              ? 'gregorian'
              : usesProlepticJulian(parts)
                ? 'julian'
                : 'gregorian';
    const dim = daysInMonth(y, m, cal);
    if (d < 1 || d > dim) {
        throw new RangeError(`day out of range for ${cal} ${y}-${m}: ${d}`);
    }
}

export function historicalYearFromParts(
    year: number,
    era: 'astronomical' | 'historical' = 'astronomical',
): number {
    if (era === 'astronomical') return year;
    // historical: positive AD, BC as negative with no year 0
    if (year > 0) return year;
    return year + 1; // 1 BC → 0, 2 BC → -1
}

export function usesProlepticJulian(
    parts: Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'>,
): boolean {
    const y = parts.astronomicalYear;
    if (y < GREGORIAN_START.y) return true;
    if (y > GREGORIAN_START.y) return false;
    if (parts.month < GREGORIAN_START.m) return true;
    if (parts.month > GREGORIAN_START.m) return false;
    return parts.day < GREGORIAN_START.d;
}

/**
 * Julian day (UT) at the given civil time, 0h = midnight.
 * Fractional part encodes time of day.
 */
/** @throws {NodeJHoraError} invalid `calendar` strings (e.g. from JSON). */
export function assertCalendarMode(calendar: string | undefined): CalendarMode {
    const mode = calendar ?? 'auto';
    if (!(CALENDAR_MODES as readonly string[]).includes(mode)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            `calendar must be one of: ${CALENDAR_MODES.join(', ')}`,
            { calendar: mode },
        );
    }
    return mode as CalendarMode;
}

function assertHistoricalTimeParts(parts: HistoricalDateTime): void {
    for (const [field, value] of [
        ['hour', parts.hour],
        ['minute', parts.minute],
        ['second', parts.second],
    ] as const) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.INVALID_INPUT,
                `${field} must be a finite number`,
                { field, value },
            );
        }
    }
}

function civilDateError(err: unknown): NodeJHoraError {
    if (err instanceof GregorianReformGapError) {
        return new NodeJHoraError(NodeJHoraErrorCode.INVALID_INPUT, err.message);
    }
    if (err instanceof RangeError) {
        return new NodeJHoraError(NodeJHoraErrorCode.INVALID_INPUT, err.message);
    }
    throw err;
}

export function resolveCalendar(
    parts: Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'>,
    calendar: CalendarMode = 'auto',
): 'julian' | 'gregorian' {
    if (calendar === 'julian') return 'julian';
    if (calendar === 'gregorian') return 'gregorian';
    if (isGregorianReformGap(parts)) {
        throw new GregorianReformGapError(parts.astronomicalYear, parts.month, parts.day);
    }
    return usesProlepticJulian(parts) ? 'julian' : 'gregorian';
}

export function julianDayUt(parts: HistoricalDateTime, calendar: CalendarMode = 'auto'): number {
    const calMode = assertCalendarMode(calendar);
    assertHistoricalTimeParts(parts);
    try {
        assertValidCivilDate(parts, calMode);
    } catch (err) {
        throw civilDateError(err);
    }
    const cal = resolveCalendar(parts, calMode);
    let y = parts.astronomicalYear;
    let m = parts.month;
    if (m <= 2) {
        y -= 1;
        m += 12;
    }
    const A = cal === 'gregorian' ? Math.floor(y / 100) : 0;
    const B = cal === 'gregorian' ? 2 - A + Math.floor(A / 4) : 0;
    const jd =
        Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + parts.day + B - 1524.5;
    const frac = (parts.hour + (parts.minute + parts.second / 60) / 60) / 24;
    return jd + frac;
}

/**
 * Civil calendar date (astronomical year) of a Julian day — inverse of
 * {@link julianDayUt}. Gregorian from JD 2299160.5 (1582-10-15 0h), proleptic
 * Julian before. Valid for negative Julian days: the Julian-calendar branch is
 * shifted by whole 4-year cycles (1461 days) so the algorithm (Meeus,
 * *Astronomical Algorithms*, ch. 7) runs on a positive day count.
 */
export function civilDateFromJulianDay(
    jd: number,
): Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'> & { dayFraction: number } {
    const z0 = Math.floor(jd + 0.5);
    const dayFraction = jd + 0.5 - z0;
    let z = z0;
    let cycles = 0;
    if (z < 0) {
        cycles = Math.ceil(-z / 1461) + 1;
        z += cycles * 1461;
    }
    let a = z;
    if (z0 >= 2299161) {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const day = b - d - Math.floor(30.6001 * e);
    const month = e < 14 ? e - 1 : e - 13;
    const year = (month > 2 ? c - 4716 : c - 4715) - 4 * cycles;
    return { astronomicalYear: year, month, day, dayFraction };
}

/** Parse `YYYY-MM-DD` with astronomical year (0000 = 1 BC, -0001 = 2 BC). */
export function parseHistoricalDateString(
    date: string,
): Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'> {
    const m = /^(-?\d{1,5})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new Error(`Invalid historical date "${date}" (expected astronomical YYYY-MM-DD)`);
    return {
        astronomicalYear: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
    };
}

export function parseHistoricalTimeString(
    time: string,
): Pick<HistoricalDateTime, 'hour' | 'minute' | 'second'> {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time);
    if (!m) throw new Error(`Invalid time "${time}"`);
    return { hour: Number(m[1]), minute: Number(m[2]), second: Number(m[3]) };
}
