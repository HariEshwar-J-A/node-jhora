/**
 * Vimshottari Dasha Engine
 *
 * Implements the 120-year Vimshottari Dasha system (Parashara).
 * Periods are calculated from the Moon's Nakshatra position at birth.
 *
 * Precision:
 *   - All balance arithmetic uses Decimal.js (34-digit precision)
 *   - Year length: 365.256364 days unless `options.yearDays` or `options.settings`
 *     supplies another length. `config.dashaYearDays` used to be ignored.
 *   - Date addition uses integer milliseconds to avoid Luxon calendar-year ambiguity
 *
 * Hierarchy: Mahadasha → Antardasha → Pratyantar → Sookshma → Prana (5 levels)
 */

import {
    Decimal,
    describeCalculation,
    LEGACY_DASHA_YEAR_DAYS_TEXT,
    type SettingsInput,
} from '@node-jhora/core';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Vimshottari Dasha durations in years (standard). Total = 120. */
export const DASHA_DURATIONS: Record<string, number> = {
    Sun: 6,
    Moon: 10,
    Mars: 7,
    Rahu: 18,
    Jupiter: 16,
    Saturn: 19,
    Mercury: 17,
    Ketu: 7,
    Venus: 20,
};

/** Fixed cyclic order (starting planet depends on Moon's Nakshatra). */
export const DASHA_ORDER: string[] = [
    'Ketu',
    'Venus',
    'Sun',
    'Moon',
    'Mars',
    'Rahu',
    'Jupiter',
    'Saturn',
    'Mercury',
];

/**
 * Year length used when the caller does not pass one. Callers that omit
 * `options` keep the dates this function has always produced.
 */
const LEGACY_YEAR_DAYS = new Decimal(LEGACY_DASHA_YEAR_DAYS_TEXT);

/** Optional year length. Omit both fields to keep {@link LEGACY_YEAR_DAYS}. */
export interface VimshottariOptions {
    /** Civil days in one dasa year. Wins over `settings` when both are set. */
    yearDays?: number;
    /** Full settings object or a preset id. The dasa year is `dasaYear.days`. */
    settings?: SettingsInput;
}

/** Exact Nakshatra span: 360/27 degrees. */
const NAKSHATRA_SPAN = new Decimal(360).div(27);

/** Days per millisecond (for DateTime arithmetic). */
const MS_PER_DAY = new Decimal(86400000);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DashaPeriod {
    planet: string;
    level: number; // 1=Maha, 2=Antar, 3=Pratyantar, 4=Sookshma, 5=Prana
    start: DateTime;
    end: DateTime;
    durationYears: number;
    subPeriods?: DashaPeriod[];
    /** Set when `options.settings` was passed. */
    settingsHash?: string;
}

interface DashaBalance {
    lord: string;
    yearsRemaining: number;
    totalDuration: number;
    fractionTraversed: number;
    nakshatraIndex: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Add a Decimal number of years to a DateTime.
 * Uses integer milliseconds to avoid Luxon's calendar-year ambiguity.
 */
function addYears(date: DateTime, years: Decimal, yearDays: Decimal): DateTime {
    const ms = years.times(yearDays).times(MS_PER_DAY).round();
    const nextMs = date.toMillis() + ms.toNumber();
    return DateTime.fromMillis(nextMs, { zone: date.zone });
}

export function yearLength(options?: VimshottariOptions): { days: Decimal; settingsHash?: string } {
    if (!options || (options.yearDays == null && options.settings == null)) {
        return { days: LEGACY_YEAR_DAYS };
    }
    if (options.settings == null) return { days: asYearDays(options.yearDays!) };
    const resolved = describeCalculation(options.settings);
    const days = options.yearDays ?? resolved.settings.dasaYear.days;
    return { days: asYearDays(days), settingsHash: resolved.settingsHash };
}

function asYearDays(days: number): Decimal {
    if (!Number.isFinite(days) || days <= 0) {
        throw new Error('yearDays must be a positive finite number');
    }
    if (String(days) === LEGACY_DASHA_YEAR_DAYS_TEXT) return LEGACY_YEAR_DAYS;
    return new Decimal(String(days));
}

function stampHash(periods: DashaPeriod[], settingsHash: string): void {
    for (const period of periods) {
        period.settingsHash = settingsHash;
        if (period.subPeriods?.length) stampHash(period.subPeriods, settingsHash);
    }
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Calculate the Dasha balance at birth from the Moon's sidereal longitude.
 *
 * The Moon's position within its current Nakshatra determines how much
 * of that Nakshatra's ruling planet's Mahadasha has already elapsed.
 *
 * @param moonLongitude  Moon's sidereal longitude [0, 360)
 */
export function calculateDashaBalance(moonLongitude: number): DashaBalance {
    const lon = new Decimal(moonLongitude).mod(new Decimal(360));
    const absLon = lon.isNegative() ? lon.plus(360) : lon;

    const nakIdx = absLon.div(NAKSHATRA_SPAN).floor().toNumber(); // 0-26
    const lonInNak = absLon.mod(NAKSHATRA_SPAN); // 0 to 13.333...°
    const fractionTraversed = lonInNak.div(NAKSHATRA_SPAN); // 0 to 1

    const lordVimIdx = nakIdx % 9; // 0-8
    const lord = DASHA_ORDER[lordVimIdx];
    const totalDuration = DASHA_DURATIONS[lord];

    const fractionRemaining = new Decimal(1).minus(fractionTraversed);
    const yearsRemaining = fractionRemaining.times(totalDuration);

    return {
        lord,
        yearsRemaining: yearsRemaining.toNumber(),
        totalDuration,
        fractionTraversed: fractionTraversed.toNumber(),
        nakshatraIndex: nakIdx,
    };
}

/**
 * Generate the Vimshottari Dasha tree for a given birth.
 *
 * @param birthDate      Luxon DateTime of birth (any timezone)
 * @param moonLongitude  Moon's sidereal longitude at birth
 * @param depth          Recursion depth: 1=Mahadasha only, 2=+Antardasha, …, 5=+Prana
 */
export function generateVimshottari(
    birthDate: DateTime,
    moonLongitude: number,
    depth: number = 2,
    options?: VimshottariOptions,
): DashaPeriod[] {
    const { days: yearDays, settingsHash } = yearLength(options);
    const balance = calculateDashaBalance(moonLongitude);
    const periods: DashaPeriod[] = [];
    let currentDate = birthDate;
    let currentIndex = DASHA_ORDER.indexOf(balance.lord);
    let yearsCovered = new Decimal(0);
    const TARGET = new Decimal(120);

    while (yearsCovered.lt(TARGET)) {
        const planet = DASHA_ORDER[currentIndex % 9];
        const fullDuration = new Decimal(DASHA_DURATIONS[planet]);

        const isFirst = periods.length === 0;
        const duration = isFirst ? new Decimal(balance.yearsRemaining) : fullDuration;

        const start = currentDate;
        const end = addYears(start, duration, yearDays);

        const period: DashaPeriod = {
            planet,
            level: 1,
            start,
            end,
            durationYears: duration.toNumber(),
            subPeriods: [],
        };

        if (depth >= 2) {
            period.subPeriods = generateSubPeriods(period, fullDuration, depth, 2, yearDays);
        }

        periods.push(period);
        currentDate = end;
        yearsCovered = yearsCovered.plus(duration);
        currentIndex++;
    }

    if (settingsHash) stampHash(periods, settingsHash);
    return periods;
}

/**
 * Generate sub-periods (Antardasha, Pratyantar, …) recursively.
 *
 * Formula: SubDuration = (ParentStandardYears × ChildStandardYears) / 120
 *
 * For the first (partial) Mahadasha, we reconstruct the full period from its
 * conceptual start, generate all sub-periods, then filter/clip to birth date.
 */
function generateSubPeriods(
    parent: DashaPeriod,
    parentStandardYears: Decimal,
    maxDepth: number,
    currentDepth: number,
    yearDays: Decimal,
): DashaPeriod[] {
    const traversedYears = parentStandardYears.minus(parent.durationYears);
    const isPartial = traversedYears.abs().gt(new Decimal('0.0001'));

    const conceptualStart = isPartial
        ? addYears(parent.start, traversedYears.negated(), yearDays)
        : parent.start;

    const parentLordIdx = DASHA_ORDER.indexOf(parent.planet);
    const subPeriods: DashaPeriod[] = [];
    let currentP = conceptualStart;

    for (let i = 0; i < 9; i++) {
        const subLord = DASHA_ORDER[(parentLordIdx + i) % 9];
        const childStdYears = new Decimal(DASHA_DURATIONS[subLord]);
        const subDuration = parentStandardYears.times(childStdYears).div(120);
        const subEnd = addYears(currentP, subDuration, yearDays);

        // Skip sub-periods that ended before birth
        if (subEnd <= parent.start) {
            currentP = subEnd;
            continue;
        }

        // Clip start to birth date if this sub-period overlaps birth
        const actualStart = currentP < parent.start ? parent.start : currentP;
        const actualDuration = new Decimal(subEnd.toMillis() - actualStart.toMillis()).div(
            yearDays.times(MS_PER_DAY),
        );

        const subPeriod: DashaPeriod = {
            planet: subLord,
            level: currentDepth,
            start: actualStart,
            end: subEnd,
            durationYears: actualDuration.toNumber(),
            subPeriods: [],
        };

        if (currentDepth < maxDepth) {
            subPeriod.subPeriods = generateSubPeriods(
                subPeriod,
                subDuration,
                maxDepth,
                currentDepth + 1,
                yearDays,
            );
        }

        subPeriods.push(subPeriod);
        currentP = subEnd;
    }

    return subPeriods;
}
