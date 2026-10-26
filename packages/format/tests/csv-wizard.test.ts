import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DateTime } from 'luxon';

import {
    csvWizardBuildCharts,
    csvWizardImport,
    csvWizardParse,
    csvWizardSuggestMappings,
    csvWizardValidate,
    NjhChartV2Schema,
    parseCsvWithDelimiter,
    parseLatitude,
    parseLongitude,
    parseUtcOffsetMinutes,
    stripBom,
} from '../src/index.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('CSV RFC 4180 parser', () => {
    it('strips UTF-8 BOM and parses quoted fields', () => {
        const csv = '\uFEFFname,note\n"Alice","said ""hi"""';
        const rows = parseCsvWithDelimiter(csv, ',');
        expect(rows).toEqual([
            ['name', 'note'],
            ['Alice', 'said "hi"'],
        ]);
        expect(stripBom(csv).startsWith('name')).toBe(true);
    });

    it('detects semicolon delimiter', () => {
        const table = csvWizardParse('name;date;time\nBob;1990-01-02;10:15:00');
        expect(table.delimiter).toBe(';');
        expect(table.headers).toEqual(['name', 'date', 'time']);
    });
});

describe('field parsers', () => {
    it('parses DMS and decimal coordinates', () => {
        expect(parseLatitude('13.0827')).toBeCloseTo(13.0827);
        expect(parseLatitude(`13°04'57.7"N`)).toBeCloseTo(13.0827, 3);
        expect(parseLongitude('80°16\'14.5"E')).toBeCloseTo(80.2707, 3);
    });

    it('parses UTC offsets', () => {
        expect(parseUtcOffsetMinutes('+05:30')).toBe(330);
        expect(parseUtcOffsetMinutes('UTC+5:30')).toBe(330);
        expect(parseUtcOffsetMinutes('-04:00')).toBe(-240);
    });
});

describe('CSV wizard', () => {
    const sampleCsv = readFileSync(join(fixtureDir, 'import-sample.csv'), 'utf8');

    it('step 1: parses and detects comma delimiter', () => {
        const table = csvWizardParse(sampleCsv);
        expect(table.hasHeader).toBe(true);
        expect(table.headers[0]).toBe('Name');
        expect(table.rows.length).toBe(2);
    });

    it('step 2: suggests column mappings', () => {
        const table = csvWizardParse(sampleCsv);
        const suggestion = csvWizardSuggestMappings(table);
        const roles = new Map(suggestion.mappings.map((m) => [m.role, m.header]));
        expect(roles.get('name')).toBe('Name');
        expect(roles.get('date')).toBe('Birth Date');
        expect(roles.get('time')).toBe('Birth Time');
        expect(roles.get('timezone')).toBe('Timezone');
        expect(roles.get('latitude')).toBe('Latitude');
        expect(roles.get('longitude')).toBe('Longitude');
        expect(roles.get('gender')).toBe('Gender');
        expect(roles.get('place')).toBe('City');
    });

    it('step 3: validates rows with line numbers', () => {
        const table = csvWizardParse(sampleCsv);
        const { mappings } = csvWizardSuggestMappings(table);
        const validation = csvWizardValidate(table, mappings);
        expect(validation.validRowCount).toBe(2);
        expect(validation.errors).toEqual([]);
    });

    it('step 3: reports errors with line numbers for bad rows', () => {
        const csv = `name,date,time,timezone,latitude,longitude
Bad,,10:00:00,Asia/Kolkata,13,80
`;
        const table = csvWizardParse(csv);
        const { mappings } = csvWizardSuggestMappings(table);
        const validation = csvWizardValidate(table, mappings);
        expect(validation.validRowCount).toBe(0);
        expect(validation.errors.some((e) => e.line === 2 && e.column === 'date')).toBe(true);
    });

    it('step 4: produces valid .njh v2 charts', () => {
        const table = csvWizardParse(sampleCsv);
        const { mappings } = csvWizardSuggestMappings(table);
        const { charts, errors } = csvWizardBuildCharts(table, mappings);
        expect(errors).toEqual([]);
        expect(charts.length).toBe(2);
        for (const chart of charts) {
            expect(NjhChartV2Schema.safeParse(chart).success).toBe(true);
        }
        const chennai = charts.find((c) => c.metadata.name === 'Chennai Sample');
        expect(chennai?.birth.local.hour).toBe(9);
        expect(chennai?.birth.timezone).toBe('Asia/Kolkata');
        expect(chennai?.birth.placeName).toBe('Chennai');
        expect(chennai?.metadata.sex).toBe('female');
        const utc = DateTime.fromISO(chennai!.birth.tzResolution.resolvedUtc);
        expect(utc.toMillis()).toBe(
            DateTime.fromObject(
                { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 },
                { zone: 'Asia/Kolkata' },
            ).toUTC().toMillis(),
        );
    });

    it('imports with UTC offset column instead of timezone', () => {
        const csv = `name,date,time,utc_offset,latitude,longitude
Offset Row,2000-06-15,12:00:00,+05:30,28.6,77.2
`;
        const { importResult } = csvWizardImport(csv);
        expect(importResult.errors).toEqual([]);
        expect(importResult.charts[0]?.birth.tzResolution.steps[0]?.code).toBe('manual_override');
    });

    it('csvWizardImport runs all steps', () => {
        const { table, suggestion, importResult } = csvWizardImport(sampleCsv);
        expect(table.rows.length).toBe(2);
        expect(suggestion.mappings.length).toBeGreaterThan(0);
        expect(importResult.charts.length).toBe(2);
    });
    it('does not map a utc_offset column to place when a timezone column wins', () => {
        const csv = `name,date,time,timezone,utc_offset,latitude,longitude
Row A,2021-11-07,01:30:00,America/New_York,-04:00,40.7,-74`;
        const { suggestion } = csvWizardImport(csv);
        const off = suggestion.mappings.find((m) => m.header === 'utc_offset');
        expect(off?.role).not.toBe('place');
    });
});
