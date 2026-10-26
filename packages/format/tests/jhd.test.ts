import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { JhdParseError } from '../src/jhd/errors.js';
import {
    hasPositions,
    JHD_BODY_ORDER,
    jhdToUtcISO,
    parseJhd,
    parseJhdDetailed,
    sexagesimalToDecimal,
} from '../src/jhd/index.js';
import { chartsSemanticallyEqual, writeJhd } from '../src/jhd/write.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'jhd');

const LEGACY = [
    '8', '8', '1912',
    '19.3800',
    '-5.30',
    '-77.35',
    '12.59',
    '0.975635',
    '112.980246', '53.638040', '141.357796', '133.951795',
    '222.962485', '122.239615', '40.154017', '352.791606', '309.112932',
    '000100000',
].join('\r\n');

const MODERN = [
    '4', '4', '1970',
    '17.506666666666668',
    '-5.300000',
    '-81.080000',
    '16.100000',
    '0.000000',
    '-5.500000', '-5.500000',
    '0', '105',
    'Machilipatnam', 'India',
    '1', '1013.250000', '20.000000', '0',
].join('\r\n');

describe('sexagesimalToDecimal', () => {
    test.each([
        [19.38, 19 + 38 / 60],
        [-5.3, -(5 + 30 / 60)],
        [-77.35, -(77 + 35 / 60)],
        [12.59, 12 + 59 / 60],
    ])('%p → %p', (packed, expected) => {
        expect(sexagesimalToDecimal(packed)).toBeCloseTo(expected, 9);
    });
});

describe('parseJhd — legacy', () => {
    const chart = parseJhd(LEGACY);

    test('date and coordinates', () => {
        expect(chart).toMatchObject({ year: 1912, month: 8, day: 8 });
        expect(chart.hour).toBeCloseTo(19 + 38 / 60, 9);
        expect(chart.tzHours).toBeCloseTo(5.5, 9);
        expect(chart.longitude).toBeCloseTo(77 + 35 / 60, 9);
        expect(chart.latitude).toBeCloseTo(12 + 59 / 60, 9);
    });

    test('line 8 is not treated as altitude by default', () => {
        expect(chart.line8Raw).toBeCloseTo(0.975635, 6);
        expect(chart.altitudeMetres).toBeUndefined();
    });

    test('positions and retrograde', () => {
        expect(hasPositions(chart)).toBe(true);
        expect(Object.keys(chart.positions!)).toEqual([...JHD_BODY_ORDER]);
        expect(chart.positions!.Sun).toBeCloseTo(112.980246, 6);
        expect(chart.retrograde!.Mercury).toBe(true);
    });

    test('UTC instant', () => {
        expect(jhdToUtcISO(chart)).toBe('1912-08-08T14:08:00.000Z');
    });
});

describe('parseJhd — modern', () => {
    const { chart, meta } = parseJhdDetailed(MODERN);

    test('no positions', () => {
        expect(hasPositions(chart)).toBe(false);
    });

    test('line 8 altitude in km → metres', () => {
        expect(meta.line8AltitudeApplied).toBe('kilometres');
        expect(chart.altitudeMetres).toBe(0);
    });

    test('place metadata', () => {
        expect(chart.placeName).toBe('Machilipatnam');
        expect(chart.country).toBe('India');
    });

    test('line8 metres override', () => {
        const forced = parseJhdDetailed(MODERN.replace('0.000000', '6.700000'), {
            line8Altitude: 'metres',
        });
        expect(forced.chart.altitudeMetres).toBeCloseTo(6.7, 6);
        expect(forced.meta.line8AltitudeApplied).toBe('metres');
    });
});

describe('parseJhd — errors', () => {
    test('truncated file', () => {
        expect(() => parseJhd('1\n2\n1990')).toThrow(JhdParseError);
        try {
            parseJhd('1\n2\n1990');
        } catch (e) {
            expect((e as JhdParseError).code).toBe('too_few_lines');
        }
    });

    test('invalid line number', () => {
        expect(() =>
            parseJhd(['8', 'oops', '1912', '19.38', '-5.30', '-77.35', '12.59'].join('\n')),
        ).toThrow(/line 2/);
    });
});

describe('writeJhd round-trip', () => {
    test('lossless on raw lines', () => {
        const first = parseJhdDetailed(LEGACY);
        const text = writeJhd(first.chart, { meta: first.meta });
        const second = parseJhdDetailed(text);
        expect(chartsSemanticallyEqual(first.chart, second.chart)).toBe(true);
        expect(second.meta.variant).toBe('legacy');
    });

    test('modern lossless with meta', () => {
        const first = parseJhdDetailed(MODERN);
        const text = writeJhd(first.chart, { meta: first.meta });
        const second = parseJhd(text);
        expect(chartsSemanticallyEqual(first.chart, second)).toBe(true);
    });

    test('canonical modern write re-parses', () => {
        const chart = parseJhd(MODERN);
        expect(() => parseJhd(writeJhd(chart))).not.toThrow();
    });
});

describe('fixture corpus', () => {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.jhd'));

    test(`reports fixture count (${files.length} on disk)`, () => {
        expect(files.length).toBeGreaterThan(0);
    });

    test.each(files)('%s parses', (file) => {
        const text = readFileSync(join(FIXTURE_DIR, file), 'utf8');
        expect(() => parseJhdDetailed(text)).not.toThrow();
    });

    test.each(files)('%s canonical write round-trips (parse → write → parse)', (file) => {
        const first = parseJhd(readFileSync(join(FIXTURE_DIR, file), 'utf8'));
        const written = writeJhd(first);
        const second = parseJhd(written);
        expect(chartsSemanticallyEqual(first, second)).toBe(true);
        expect(writeJhd(second)).toBe(written);
    });
});
