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
        const varanasi = charts.find((c) => c.metadata.name === 'Varanasi Sample');
        expect(varanasi?.birth.local.hour).toBe(18);
        expect(varanasi?.birth.timezone).toBe('Asia/Kolkata');
        expect(varanasi?.birth.placeName).toBe('Varanasi');
        expect(varanasi?.metadata.sex).toBe('female');
        const utc = DateTime.fromISO(varanasi!.birth.tzResolution.resolvedUtc);
        expect(utc.toMillis()).toBe(
            DateTime.fromObject(
                { year: 2020, month: 12, day: 21, hour: 18, minute: 20, second: 0 },
                { zone: 'Asia/Kolkata' },
            )
                .toUTC()
                .toMillis(),
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

describe('CSV import: DST gap (nonexistent local time)', () => {
    const header = 'name,date,time,timezone,latitude,longitude';

    it('warns instead of throwing or shifting silently (America/New_York spring-forward)', () => {
        const csv = `${header}
Gap Row,2021-03-14,02:30:00,America/New_York,40.7128,-74.006
Normal Row,2021-03-14,12:00:00,America/New_York,40.7128,-74.006
`;
        const { importResult } = csvWizardImport(csv);
        expect(importResult.errors).toEqual([]);
        expect(importResult.charts.length).toBe(2);

        expect(importResult.warnings).toHaveLength(1);
        const [warning] = importResult.warnings;
        expect(warning).toMatchObject({ line: 2, column: 'time', code: 'dst_gap' });
        expect(warning!.message).toContain(
            '2021-03-14 02:30:00 does not exist in America/New_York',
        );
        expect(warning!.message).toContain('DST gap');
        expect(warning!.message).toContain('UTC-05:00');
        expect(warning!.message).toContain('UTC-04:00');
        expect(warning!.message).toContain('2021-03-14T07:30:00Z');

        const gapResult = importResult.results.find((r) => r.line === 2)!;
        expect(gapResult.warnings).toEqual([warning]);
        expect(importResult.results.find((r) => r.line === 3)!.warnings).toEqual([]);

        const chart = gapResult.chart!;
        expect(NjhChartV2Schema.safeParse(chart).success).toBe(true);
        // The recorded wall clock is preserved, not rewritten to 03:30.
        expect(chart.birth.local).toMatchObject({ hour: 2, minute: 30, second: 0 });
        // 02:30 read with the pre-transition offset (EST, UTC−5).
        expect(chart.birth.tzResolution.resolvedUtc).toBe('2021-03-14T07:30:00Z');
        const gapStep = chart.birth.tzResolution.steps.find((st) => st.code === 'gap_skip');
        expect(gapStep).toMatchObject({
            at: '2021-03-14T07:30:00Z',
            offsetMinutes: -300,
            ianaZone: 'America/New_York',
        });

        const normal = importResult.results.find((r) => r.line === 3)!.chart!;
        expect(normal.birth.tzResolution.steps.some((st) => st.code === 'gap_skip')).toBe(false);
    });

    it('handles a 30-minute gap (Australia/Lord_Howe) and a European gap', () => {
        const csv = `${header}
Lord Howe,2021-10-03,02:15:00,Australia/Lord_Howe,-31.55,159.08
London,2021-03-28,01:30:00,Europe/London,51.5,-0.12
`;
        const { importResult } = csvWizardImport(csv);
        expect(importResult.errors).toEqual([]);
        expect(importResult.warnings.map((w) => [w.line, w.code])).toEqual([
            [2, 'dst_gap'],
            [3, 'dst_gap'],
        ]);
        const [lordHowe, london] = importResult.charts;
        // +10:30 before the transition: 02:15 − 10:30 = 15:45 UTC on the previous day.
        expect(lordHowe!.birth.tzResolution.resolvedUtc).toBe('2021-10-02T15:45:00Z');
        expect(importResult.warnings[0]!.message).toContain('UTC+10:30');
        expect(importResult.warnings[0]!.message).toContain('UTC+11:00');
        // GMT (UTC+0) before the transition.
        expect(london!.birth.tzResolution.resolvedUtc).toBe('2021-03-28T01:30:00Z');
    });

    it('does not warn for a repeated (fall-back) time or for times next to the gap', () => {
        const csv = `${header}
Fold,2021-11-07,01:30:00,America/New_York,40.7,-74
Before,2021-03-14,01:59:59,America/New_York,40.7,-74
After,2021-03-14,03:00:00,America/New_York,40.7,-74
`;
        const { importResult } = csvWizardImport(csv);
        expect(importResult.errors).toEqual([]);
        expect(importResult.warnings).toEqual([]);
        expect(importResult.charts.map((c) => c.birth.tzResolution.resolvedUtc)).toEqual([
            '2021-11-07T05:30:00Z',
            '2021-03-14T06:59:59Z',
            '2021-03-14T07:00:00Z',
        ]);
    });

    it('step 3 validation surfaces the warning while counting the row as valid', () => {
        const table = csvWizardParse(`${header}
Gap Row,2021-03-14,02:30:00,America/New_York,40.7128,-74.006
`);
        const { mappings } = csvWizardSuggestMappings(table);
        const result = csvWizardValidate(table, mappings);
        expect(result.errors).toEqual([]);
        expect(result.validRowCount).toBe(1);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatchObject({ line: 2, code: 'dst_gap' });
    });

    it('offset-only rows honour the stated offset when a matching zone has a gap there', () => {
        const csv = `name,date,time,utc_offset,latitude,longitude
Offset Gap,2021-03-14,02:30:00,-04:00,40.7,-74
`;
        const { importResult } = csvWizardImport(csv);
        expect(importResult.errors).toEqual([]);
        expect(importResult.warnings).toEqual([]);
        // 02:30 at UTC−4 is 06:30 UTC, whatever zone was matched.
        expect(importResult.charts[0]!.birth.tzResolution.resolvedUtc).toBe('2021-03-14T06:30:00Z');
    });
});
