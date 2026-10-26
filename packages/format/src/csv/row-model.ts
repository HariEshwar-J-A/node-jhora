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
import type { CsvColumnMapping, CsvImportOptions, CsvRowError } from './types.js';

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
}

export function parseMappedRow(
    row: string[],
    mappings: CsvColumnMapping[],
    line: number,
): { parsed?: ParsedCsvRow; errors: CsvRowError[] } {
    const byRole = mappingByRole(mappings);
    const errors: CsvRowError[] = [];

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
        return { errors };
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
            return { errors };
        }
    }

    if (!timezone) {
        return { errors };
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
        },
        errors,
    };
}

export function buildChartFromParsedRow(
    parsed: ParsedCsvRow,
    options: CsvImportOptions = {},
): NjhChartV2 {
    const altitudeMetres = options.altitudeMetres ?? 0;
    const kind = options.chartKind ?? 'natal';
    const importTag = options.importTag ?? 'csv-import';

    const zoned = DateTime.fromObject(parsed.local, { zone: parsed.timezone });
    if (!zoned.isValid) {
        throw new Error(`Cannot interpret local time in zone ${parsed.timezone}`);
    }
    const resolvedUtc = normalizeUtcInstant(zoned.toUTC());

    const steps: NjhChartV2['birth']['tzResolution']['steps'] = [];
    if (parsed.offsetMinutes !== undefined) {
        steps.push({
            code: 'manual_override',
            summary: `UTC offset ${parsed.offsetMinutes} minutes from CSV import`,
            offsetMinutes: parsed.offsetMinutes,
        });
    }
    steps.push({
        code: 'legacy_import',
        summary: 'Imported from CSV (wall clock expanded in the recorded time zone)',
        at: resolvedUtc,
        offsetMinutes: zoned.offset,
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
