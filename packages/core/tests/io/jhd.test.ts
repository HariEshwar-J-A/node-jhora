/**
 * `.jhd` reader tests.
 *
 * The sexagesimal packing in lines 4-7 is the whole risk here. JHora writes
 * `-5.30` for UTC+5:30 and `-77.35` for 77°35′ E. Read naively as decimals those
 * become +5.30 h and 77.35°, errors of 18 minutes of clock time and 9 arcminutes
 * of longitude — which shifts the ascendant by roughly 4.5° while leaving every
 * planet looking correct. That failure is silent and plausible, so it is pinned
 * explicitly.
 */

import {
    parseJhd,
    sexagesimalToDecimal,
    jhdToUtcISO,
    hasPositions,
    JHD_BODY_ORDER,
} from '../../src/io/jhd.js';

// ---------------------------------------------------------------------------
// Sexagesimal decoding
// ---------------------------------------------------------------------------

describe('sexagesimalToDecimal', () => {
    test.each([
        [19.38,   19 + 38 / 60],           // 19:38
        [-5.30,  -(5 + 30 / 60)],          // UTC+5:30, stored sign-flipped
        [-77.35, -(77 + 35 / 60)],         // 77°35′ E
        [12.59,   12 + 59 / 60],           // 12°59′ N
        [6.33,    6 + 33 / 60],            // 06:33
        [0,       0],
    ])('%p decodes to %p', (packed, expected) => {
        expect(sexagesimalToDecimal(packed)).toBeCloseTo(expected, 9);
    });

    test('reading the packed value as a plain decimal would be badly wrong', () => {
        // 5.30 packed is 5.5 h; taken literally it is 5.30 h — 12 minutes out.
        expect(Math.abs(sexagesimalToDecimal(5.30) - 5.30) * 60).toBeCloseTo(12, 6);
    });

    test('handles a seconds field', () => {
        expect(sexagesimalToDecimal(12.5930)).toBeCloseTo(12 + 59 / 60 + 30 / 3600, 6);
    });
});

// ---------------------------------------------------------------------------
// Legacy variant — carries JHora's computed positions
// ---------------------------------------------------------------------------

const LEGACY = [
    '8', '8', '1912',
    '19.3800',      // 19:38 local
    '-5.30',        // UTC+5:30
    '-77.35',       // 77°35′ E
    '12.59',        // 12°59′ N
    '0.975635',
    '112.980246', '53.638040', '141.357796', '133.951795',
    '222.962485', '122.239615', '40.154017', '352.791606', '309.112932',
    '000100000',
].join('\r\n');

describe('parseJhd — legacy variant', () => {
    const chart = parseJhd(LEGACY);

    test('decodes the date', () => {
        expect(chart).toMatchObject({ year: 1912, month: 8, day: 8 });
    });

    test('decodes packed time, zone and coordinates', () => {
        expect(chart.hour).toBeCloseTo(19 + 38 / 60, 9);
        expect(chart.tzHours).toBeCloseTo(5.5, 9);
        expect(chart.longitude).toBeCloseTo(77 + 35 / 60, 9);
        expect(chart.latitude).toBeCloseTo(12 + 59 / 60, 9);
    });

    test('extracts the nine stored longitudes in JHora order', () => {
        expect(hasPositions(chart)).toBe(true);
        expect(Object.keys(chart.positions!)).toEqual([...JHD_BODY_ORDER]);
        // Lagna is written last, not first — getting this wrong rotates the
        // whole set by one body and looks like a systematic ephemeris error.
        expect(chart.positions!.Sun).toBeCloseTo(112.980246, 6);
        expect(chart.positions!.Lagna).toBeCloseTo(309.112932, 6);
    });

    test('maps the retrograde flag string to the right body', () => {
        expect(chart.retrograde!.Mercury).toBe(true);
        expect(chart.retrograde!.Sun).toBe(false);
        expect(chart.retrograde!.Lagna).toBe(false);
    });

    test('converts to the correct UTC instant', () => {
        // 19:38 at UTC+5:30 is 14:08 UTC the same day.
        expect(jhdToUtcISO(chart)).toBe('1912-08-08T14:08:00.000Z');
    });
});

// ---------------------------------------------------------------------------
// Modern variant — birth data only
// ---------------------------------------------------------------------------

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

describe('parseJhd — modern variant', () => {
    const chart = parseJhd(MODERN);

    test('reports no stored positions', () => {
        expect(hasPositions(chart)).toBe(false);
        expect(chart.positions).toBeUndefined();
    });

    test('reads place metadata', () => {
        expect(chart.placeName).toBe('Machilipatnam');
        expect(chart.country).toBe('India');
    });

    test('decodes coordinates from the packed form', () => {
        expect(chart.longitude).toBeCloseTo(81 + 8 / 60, 6);
        expect(chart.latitude).toBeCloseTo(16 + 10 / 60, 6);
        expect(chart.tzHours).toBeCloseTo(5.5, 6);
    });

    test('does not mistake the place-metadata lines for positions', () => {
        // The modern layout has non-numeric text where the legacy layout keeps
        // longitudes, so variant detection must not be fooled by line count.
        expect(chart.retrograde).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

describe('parseJhd — malformed input', () => {
    test('rejects a truncated file', () => {
        expect(() => parseJhd('1\r\n2\r\n1990')).toThrow(/at least 7 lines/);
    });

    test('reports which line is unparseable', () => {
        expect(() => parseJhd(['8', 'oops', '1912', '19.38', '-5.30', '-77.35', '12.59'].join('\n')))
            .toThrow(/line 2/);
    });

    test('accepts LF-only line endings', () => {
        const chart = parseJhd(LEGACY.replace(/\r/g, ''));
        expect(chart.positions!.Sun).toBeCloseTo(112.980246, 6);
    });
});
