import { Decimal, LEGACY_DASHA_YEAR_DAYS_TEXT } from '@node-jhora/core';
import { DateTime } from 'luxon';

/** Same lords and years as `@node-jhora/prediction` `generateVimshottari`. */
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

export const DASHA_ORDER = [
    'Ketu',
    'Venus',
    'Sun',
    'Moon',
    'Mars',
    'Rahu',
    'Jupiter',
    'Saturn',
    'Mercury',
] as const;

const YEAR_DAYS = new Decimal(LEGACY_DASHA_YEAR_DAYS_TEXT);
const MS_PER_DAY = new Decimal(86400000);

export type VimPeriod = {
    planet: string;
    level: number;
    start: string;
    end: string;
    durationYears: number;
    /** Unclipped length used to subdivide the next level. */
    standardYears: number;
};

function addYears(date: DateTime, years: Decimal): DateTime {
    const ms = years.times(YEAR_DAYS).times(MS_PER_DAY).round();
    return DateTime.fromMillis(date.toMillis() + ms.toNumber(), { zone: date.zone });
}

/**
 * One deeper Vimshottari level (Antar through Prana).
 * Mirrors `generateSubPeriods` in packages/prediction, one level at a time,
 * so the UI can expand a row without building the full five-level tree.
 */
export function expandVimshottariLevel(parent: VimPeriod): VimPeriod[] {
    if (parent.level >= 5) return [];
    const parentStandard = new Decimal(String(parent.standardYears));
    const parentStart = DateTime.fromISO(parent.start);
    if (!parentStart.isValid) return [];
    const traversed = parentStandard.minus(parent.durationYears);
    const conceptualStart = traversed.abs().gt('0.0001')
        ? addYears(parentStart, traversed.negated())
        : parentStart;
    const parentLordIdx = DASHA_ORDER.indexOf(parent.planet as (typeof DASHA_ORDER)[number]);
    if (parentLordIdx < 0) return [];

    const out: VimPeriod[] = [];
    let currentP = conceptualStart;
    for (let i = 0; i < 9; i++) {
        const subLord = DASHA_ORDER[(parentLordIdx + i) % 9]!;
        const childStd = new Decimal(DASHA_DURATIONS[subLord] ?? 0);
        const subDuration = parentStandard.times(childStd).div(120);
        const subEnd = addYears(currentP, subDuration);
        if (subEnd <= parentStart) {
            currentP = subEnd;
            continue;
        }
        const actualStart = currentP < parentStart ? parentStart : currentP;
        const actualDuration = new Decimal(subEnd.toMillis() - actualStart.toMillis()).div(
            YEAR_DAYS.times(MS_PER_DAY),
        );
        out.push({
            planet: subLord,
            level: parent.level + 1,
            start: actualStart.toISO() ?? '',
            end: subEnd.toISO() ?? '',
            durationYears: actualDuration.toNumber(),
            standardYears: subDuration.toNumber(),
        });
        currentP = subEnd;
    }
    return out;
}

export function mahaPeriod(period: {
    planet: string;
    level?: number;
    start: string;
    end: string;
    durationYears?: number;
}): VimPeriod {
    const standard = DASHA_DURATIONS[period.planet] ?? period.durationYears ?? 0;
    return {
        planet: period.planet,
        level: period.level && period.level > 0 ? period.level : 1,
        start: period.start,
        end: period.end,
        durationYears: period.durationYears ?? standard,
        standardYears:
            period.level && period.level > 1 ? (period.durationYears ?? standard) : standard,
    };
}
