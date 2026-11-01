import { resolveCivilTime } from '@node-jhora/core';
import { DateTime } from 'luxon';

import { NJH_SCHEMA_VERSION } from '../constants.js';
import type { LocalClock, NjhChartV2 } from '../schema.js';
import { NjhChartV2Schema } from '../schema.js';
import {
    ianaZoneForOffset,
    normalizeUtcInstant,
    parseCombinedDateTime,
    parseDateField,
    parseGenderField,
    parseLatitude,
    parseLongitude,
    parseTimeField,
    parseTimezoneField,
    parseUtcOffsetMinutes,
    type SexValue,
    toLocalClock,
} from './field-parsers.js';
import { mappingByRole } from './mapping.js';
import type { CsvColumnMapping, CsvImportOptions, CsvRowError, CsvRowWarning } from './types.js';

function newChartId(): string {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
    }
    throw new Error('njh: crypto.randomUUID is required to import charts');
}

function cell(row: string[], index: number | undefined): string {
    if (index === undefined) return '';
    return row[index]?.trim() ?? '';
}

export interface ParsedCsvRow {
    name: string;
    local: LocalClock;
    timezone: string;
    latitude: number;
    longitude: number;
    placeName?: string;
    sex?: SexValue;
    offsetMinutes?: number;
    /** Set when `local` does not exist in `timezone` (spring-forward DST gap). */
    dstGap?: DstGap;
}

/** Offsets either side of a spring-forward transition that skips the row's wall clock. */
export interface DstGap {
    /** Offset in force just before the transition (used to read the wall clock). */
    offsetBeforeMinutes: number;
    /** Offset in force just after the transition. */
    offsetAfterMinutes: number;
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** The wall clock read as if it were UTC, in milliseconds since the Unix epoch. */
function naiveUtcMs(local: LocalClock): number {
    const naive = DateTime.fromObject(local, { zone: 'utc' });
    if (!naive.isValid) throw new Error('Invalid local date/time');
    return naive.toMillis();
}

function sameWallClock(dt: DateTime, local: LocalClock): boolean {
    return (
        dt.year === local.year &&
        dt.month === local.month &&
        dt.day === local.day &&
        dt.hour === local.hour &&
        dt.minute === local.minute &&
        dt.second === local.second &&
        dt.millisecond === (local.millisecond ?? 0)
    );
}

/**
 * Detect a wall-clock time that does not exist in `zone` because clocks jumped
 * forward over it. Luxon silently moves such times forward; this makes the gap
 * explicit so the importer can warn instead.
 */
export function findDstGap(local: LocalClock, zone: string): DstGap | undefined {
    const zoned = DateTime.fromObject(local, { zone });
    if (!zoned.isValid || sameWallClock(zoned, local)) return undefined;
    const naiveMs = naiveUtcMs(local);
    const offsetBeforeMinutes = DateTime.fromMillis(naiveMs - DAY_MS, { zone }).offset;
    const offsetAfterMinutes = DateTime.fromMillis(naiveMs + DAY_MS, { zone }).offset;
    if (offsetAfterMinutes <= offsetBeforeMinutes) return undefined;
    return { offsetBeforeMinutes, offsetAfterMinutes };
}

/** UTC instant for a gap time, read with the pre-transition offset (lands after the gap). */
function gapResolvedUtc(local: LocalClock, gap: DstGap): DateTime {
    return DateTime.fromMillis(naiveUtcMs(local) - gap.offsetBeforeMinutes * MINUTE_MS, {
        zone: 'utc',
    });
}

function pad(n: number, width = 2): string {
    const sign = n < 0 ? '-' : '';
    return sign + String(Math.abs(n)).padStart(width, '0');
}

function formatLocalClock(local: LocalClock): string {
    const date = `${pad(local.year, 4)}-${pad(local.month)}-${pad(local.day)}`;
    return `${date} ${pad(local.hour)}:${pad(local.minute)}:${pad(local.second)}`;
}

function formatOffset(minutes: number): string {
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function dstGapWarning(line: number, local: LocalClock, zone: string, gap: DstGap): CsvRowWarning {
    const utc = gapResolvedUtc(local, gap);
    const shifted = utc.setZone(zone);
    return {
        line,
        column: 'time',
        code: 'dst_gap',
        message:
            `Local time ${formatLocalClock(local)} does not exist in ${zone}: clocks moved ` +
            `forward from ${formatOffset(gap.offsetBeforeMinutes)} to ` +
            `${formatOffset(gap.offsetAfterMinutes)} (DST gap). Imported using the ` +
            `pre-transition offset ${formatOffset(gap.offsetBeforeMinutes)} as ` +
            `${normalizeUtcInstant(utc)} (${shifted.toFormat('HH:mm:ss')} local after the ` +
            `transition); check the recorded birth time.`,
    };
}

export function parseMappedRow(
    row: string[],
    mappings: CsvColumnMapping[],
    line: number,
): { parsed?: ParsedCsvRow; errors: CsvRowError[]; warnings: CsvRowWarning[] } {
    const byRole = mappingByRole(mappings);
    const errors: CsvRowError[] = [];
    const warnings: CsvRowWarning[] = [];

    const name = cell(row, byRole.get('name'));
    if (!name) {
        errors.push({ line, column: 'name', message: 'Name is required' });
    }

    let date = parseDateField(cell(row, byRole.get('date')));
    let time = parseTimeField(cell(row, byRole.get('time')));
    const dateCol = cell(row, byRole.get('date'));
    if ((!date || !time) && dateCol) {
        const combo = parseCombinedDateTime(dateCol);
        if (combo) {
            date = combo.date;
            time = combo.time;
        }
    }
    if (!date) {
        errors.push({ line, column: 'date', message: 'Invalid or missing date' });
    }
    if (!time) {
        errors.push({ line, column: 'time', message: 'Invalid or missing time' });
    }

    const latRaw = cell(row, byRole.get('latitude'));
    const lonRaw = cell(row, byRole.get('longitude'));
    const latitude = parseLatitude(latRaw);
    const longitude = parseLongitude(lonRaw);
    if (latitude === undefined) {
        errors.push({ line, column: 'latitude', message: 'Invalid or missing latitude' });
    }
    if (longitude === undefined) {
        errors.push({ line, column: 'longitude', message: 'Invalid or missing longitude' });
    }

    const tzRaw = cell(row, byRole.get('timezone'));
    const offsetRaw = cell(row, byRole.get('utcOffset'));
    let timezone = parseTimezoneField(tzRaw);
    const offsetMinutes = parseUtcOffsetMinutes(offsetRaw);
    if (!timezone && offsetMinutes === undefined && offsetRaw) {
        timezone = parseTimezoneField(offsetRaw);
    }
    if (!timezone && offsetMinutes === undefined) {
        errors.push({
            line,
            message: 'Provide a valid IANA timezone or UTC offset',
        });
    }

    const place = cell(row, byRole.get('place'));
    const genderRaw = cell(row, byRole.get('gender'));
    const sex = genderRaw ? parseGenderField(genderRaw) : undefined;
    if (genderRaw && !sex) {
        errors.push({ line, column: 'gender', message: `Unrecognized gender value: ${genderRaw}` });
    }

    if (errors.length > 0 || !date || !time || latitude === undefined || longitude === undefined) {
        return { errors, warnings };
    }

    const local = toLocalClock(date, time);

    if (!timezone && offsetMinutes !== undefined) {
        timezone = ianaZoneForOffset(offsetMinutes, local);
        if (!timezone) {
            errors.push({
                line,
                column: 'utcOffset',
                message: `No IANA zone matches offset ${offsetMinutes} minutes at this local time`,
            });
            return { errors, warnings };
        }
    }

    if (!timezone) {
        return { errors, warnings };
    }

    const dstGap = findDstGap(local, timezone);
    if (dstGap) {
        warnings.push(dstGapWarning(line, local, timezone, dstGap));
    }

    return {
        parsed: {
            name,
            local,
            timezone,
            latitude,
            longitude,
            placeName: place || undefined,
            sex,
            offsetMinutes,
            dstGap,
        },
        errors,
        warnings,
    };
}

export function buildChartFromParsedRow(
    parsed: ParsedCsvRow,
    options: CsvImportOptions = {},
): NjhChartV2 {
    const altitudeMetres = options.altitudeMetres ?? 0;
    const kind = options.chartKind ?? 'natal';
    const importTag = options.importTag ?? 'csv-import';

    let civil: ReturnType<typeof resolveCivilTime>;
    try {
        civil = resolveCivilTime({
            local: parsed.local,
            timezone: parsed.timezone,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
        });
    } catch {
        throw new Error(`Cannot interpret local time in zone ${parsed.timezone}`);
    }
    const resolvedUtc = normalizeUtcInstant(DateTime.fromISO(civil.resolvedUtc, { zone: 'utc' }));
    const resolvedZoned = DateTime.fromISO(resolvedUtc, { zone: 'utc' }).setZone(parsed.timezone);
    if (!resolvedZoned.isValid) {
        throw new Error(`Cannot interpret local time in zone ${parsed.timezone}`);
    }

    const steps: NjhChartV2['birth']['tzResolution']['steps'] = [];
    if (parsed.offsetMinutes !== undefined) {
        steps.push({
            code: 'manual_override',
            summary: `UTC offset ${parsed.offsetMinutes} minutes from CSV import`,
            offsetMinutes: parsed.offsetMinutes,
        });
    }
    if (parsed.dstGap) {
        steps.push({
            code: 'gap_skip',
            summary:
                'Local time did not exist (DST gap); read with the pre-transition offset, ' +
                'advancing past the transition',
            at: resolvedUtc,
            offsetMinutes: parsed.dstGap.offsetBeforeMinutes,
            ianaZone: parsed.timezone,
        });
    }
    if (civil.warnings.some((w) => w.code === 'ambiguous_local')) {
        steps.push({
            code: 'ambiguous_fold',
            summary: 'Chose the earlier UTC instant for the repeated local time',
            at: resolvedUtc,
            ianaZone: parsed.timezone,
        });
    }
    steps.push({
        code: 'legacy_import',
        summary: 'Imported from CSV (wall clock expanded in the recorded time zone)',
        at: resolvedUtc,
        offsetMinutes: resolvedZoned.offset,
        ianaZone: parsed.timezone,
    });

    return NjhChartV2Schema.parse({
        schemaVersion: NJH_SCHEMA_VERSION,
        id: newChartId(),
        metadata: {
            kind,
            name: parsed.name,
            aliases: [],
            sex: parsed.sex,
        },
        birth: {
            local: parsed.local,
            timezone: parsed.timezone,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            altitudeMetres,
            placeName: parsed.placeName,
            tzResolution: {
                steps,
                resolvedUtc,
            },
        },
        rectification: { notes: [] },
        tags: [importTag],
        attachments: [],
    });
}
