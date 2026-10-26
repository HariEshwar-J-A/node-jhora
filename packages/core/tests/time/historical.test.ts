import { DateTime } from 'luxon';

import { julday } from '../../src/engine/coordinates.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { NodeJHoraError, NodeJHoraErrorCode } from '../../src/errors.js';
import {
    civilDateFromJulianDay,
    julianDayUt,
    parseHistoricalDateString,
    parseHistoricalTimeString,
    usesProlepticJulian,
} from '../../src/time/historical.js';

describe('historical calendar', () => {
    test('J2000.0 noon matches coordinates.julday (Gregorian)', () => {
        const jdHist = julianDayUt({
            astronomicalYear: 2000,
            month: 1,
            day: 1,
            hour: 12,
            minute: 0,
            second: 0,
        });
        const jdCoord = julday(2000, 1, 1, 12);
        expect(jdHist).toBeCloseTo(jdCoord, 10);
        expect(jdHist).toBeCloseTo(2451545.0, 10);
    });

    test('year 0 = 1 BC uses proleptic Julian', () => {
        expect(usesProlepticJulian({ astronomicalYear: 0, month: 6, day: 1 })).toBe(true);
    });

    test('1582-10-04 is Julian; 1582-10-15 is Gregorian', () => {
        expect(usesProlepticJulian({ astronomicalYear: 1582, month: 10, day: 4 })).toBe(true);
        expect(usesProlepticJulian({ astronomicalYear: 1582, month: 10, day: 15 })).toBe(false);
    });

    test('parseHistoricalDateString accepts astronomical years', () => {
        const p = parseHistoricalDateString('-0001-07-04');
        expect(p.astronomicalYear).toBe(-1);
        expect(p.month).toBe(7);
        expect(p.day).toBe(4);
    });

    test('parseHistoricalTimeString', () => {
        expect(parseHistoricalTimeString('14:30:00')).toEqual({ hour: 14, minute: 30, second: 0 });
    });

    test('10000 BCE and 10000 CE century indices', () => {
        const jdBc = julianDayUt({
            astronomicalYear: -9999,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        });
        const jdAd = julianDayUt({
            astronomicalYear: 10000,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        });
        expect(jdBc).toBeLessThan(jdAd);
        expect(jdBc).toBeLessThan(1721424);
    });

    const jd = (y: number, m: number, d: number, h = 0): number =>
        julianDayUt({ astronomicalYear: y, month: m, day: d, hour: h, minute: 0, second: 0 });

    test('1582 switchover: Julian 1582-10-04 is followed by Gregorian 1582-10-15', () => {
        expect(jd(1582, 10, 15)).toBe(jd(1582, 10, 4) + 1);
        expect(jd(1582, 10, 15)).toBe(2299160.5);
        expect(usesProlepticJulian({ astronomicalYear: 1582, month: 10, day: 4 })).toBe(true);
        expect(usesProlepticJulian({ astronomicalYear: 1582, month: 10, day: 15 })).toBe(false);
    });

    test('year 0 = 1 BC, a Julian leap year; Meeus ch. 7 reference values', () => {
        expect(jd(0, 1, 1)).toBe(1721057.5);
        expect(jd(0, 3, 1) - jd(0, 2, 28)).toBe(2); // 29 Feb 1 BC exists
        expect(jd(-1, 3, 1) - jd(-1, 2, 28)).toBe(1); // 2 BC is common
        expect(jd(1, 1, 1) - jd(0, 1, 1)).toBe(366);
        // Meeus, Astronomical Algorithms (2nd ed.), Example 7.a/7.b and table p. 62
        expect(jd(-4712, 1, 1, 12)).toBe(0);
        expect(jd(333, 1, 27, 12)).toBe(1842713.0);
        expect(jd(-1000, 7, 12, 12)).toBe(1356001.0);
        expect(jd(1600, 1, 1)).toBe(2305447.5);
        expect(jd(1987, 1, 27)).toBe(2446822.5);
    });

    test('rejects unknown calendar mode with INVALID_INPUT', () => {
        const parts = {
            astronomicalYear: 2000,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        };
        try {
            julianDayUt(parts, 'foo' as 'auto');
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(NodeJHoraError);
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
        try {
            julday(2000, 1, 1, 0, 'foo' as 'auto');
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
    });

    test('rejects non-finite time components with INVALID_INPUT', () => {
        try {
            julianDayUt({
                astronomicalYear: 2000,
                month: 1,
                day: 1,
                hour: Number.NaN,
                minute: 0,
                second: 0,
            });
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
    });

    test('rejects impossible civil dates with INVALID_INPUT', () => {
        try {
            julianDayUt({
                astronomicalYear: 2000,
                month: 2,
                day: 30,
                hour: 0,
                minute: 0,
                second: 0,
            });
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(NodeJHoraError);
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
            expect(err).not.toBeInstanceOf(RangeError);
        }
    });

    test('EphemerisEngine.julday rejects unknown calendar', async () => {
        const engine = EphemerisEngine.getInstance();
        await engine.initialize();
        try {
            engine.julday(DateTime.utc(2000, 1, 1), { calendar: 'foo' as 'auto' });
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
    });

    test('civilDateFromJulianDay inverts julianDayUt, including negative JD', () => {
        for (const [y, m, d] of [
            [-9999, 1, 1],
            [-4713, 12, 31],
            [-4712, 1, 1],
            [0, 2, 29],
            [1582, 10, 4],
            [1582, 10, 15],
            [1700, 3, 1],
            [2000, 2, 29],
            [9999, 12, 31],
        ] as const) {
            const c = civilDateFromJulianDay(jd(y, m, d, 6));
            expect([c.astronomicalYear, c.month, c.day]).toEqual([y, m, d]);
            expect(c.dayFraction).toBeCloseTo(0.25, 9);
        }
    });
});
