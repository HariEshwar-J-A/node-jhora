import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { julday } from '../../src/engine/coordinates.js';
import {
    assertValidCivilDate,
    civilDateFromJulianDay,
    GregorianReformGapError,
    julianDayUt,
    resolveCalendar,
} from '../../src/time/historical.js';
import { dateTimeToJulianDayUt, resolveCivilTime } from '../../src/time/civil.js';

/** Swiss Ephemeris / JHora julday reference (from nj-fullrange-oracle-kit calendar.json). */
/** Civil dates valid in calendar `auto` (reform gap 1582-10-05…14 excluded). */
const SE_JULDAY_AUTO: Array<[number, number, number, number]> = [
    [2000, 1, 1, 2451544.5],
    [1582, 10, 15, 2299160.5],
    [1582, 10, 4, 2299159.5],
    [1500, 3, 1, 2268992.5],
    [1500, 2, 29, 2268991.5],
    [1000, 6, 1, 2086459.5],
    [0, 2, 29, 1721116.5],
    [-1, 6, 1, 1720843.5],
    [-4712, 1, 1, -0.5],
];

/** Last Julian day before the reform; only valid when calendar is forced to `julian`. */
const SE_JULDAY_JULIAN_ONLY: Array<[number, number, number, number]> = [[1582, 10, 14, 2299169.5]];

describe('calendar mode (JHora / SE)', () => {
    test('julianDayUt matches SE julday at reference civil dates', () => {
        for (const [y, m, d, expected] of SE_JULDAY_AUTO) {
            const jd = julianDayUt({
                astronomicalYear: y,
                month: m,
                day: d,
                hour: 0,
                minute: 0,
                second: 0,
            });
            expect(jd).toBeCloseTo(expected, 10);
            expect(julday(y, m, d, 0, 'auto')).toBeCloseTo(expected, 10);
        }
    });

    test('forced julian calendar matches SE on reform-gap labels', () => {
        for (const [y, m, d, expected] of SE_JULDAY_JULIAN_ONLY) {
            const jd = julianDayUt(
                {
                    astronomicalYear: y,
                    month: m,
                    day: d,
                    hour: 0,
                    minute: 0,
                    second: 0,
                },
                'julian',
            );
            expect(jd).toBeCloseTo(expected, 10);
        }
    });

    test('civilDateFromJulianDay round-trips SE cases', () => {
        for (const [y, m, d] of SE_JULDAY_AUTO) {
            const cal = 'auto';
            const jd = julianDayUt(
                {
                    astronomicalYear: y,
                    month: m,
                    day: d,
                    hour: 6,
                    minute: 0,
                    second: 0,
                },
                cal,
            );
            const c = civilDateFromJulianDay(jd);
            expect([c.astronomicalYear, c.month, c.day]).toEqual([y, m, d]);
            expect(c.dayFraction).toBeCloseTo(0.25, 9);
        }
    });

    test('Julian leap 1500-02-29 is valid in auto; invalid in forced Gregorian', () => {
        const parts = { astronomicalYear: 1500, month: 2, day: 29 };
        expect(() => assertValidCivilDate(parts, 'auto')).not.toThrow();
        expect(() => assertValidCivilDate(parts, 'gregorian')).toThrow(RangeError);
        expect(resolveCalendar(parts, 'julian')).toBe('julian');
    });

    test('Gregorian reform gap (1582-10-05 … 14) throws in auto', () => {
        for (const day of [5, 10, 14]) {
            expect(() =>
                julianDayUt({
                    astronomicalYear: 1582,
                    month: 10,
                    day,
                    hour: 0,
                    minute: 0,
                    second: 0,
                }),
            ).toThrow(GregorianReformGapError);
        }
    });

    test('forced gregorian allows reform-gap labels', () => {
        const jd = julianDayUt(
            {
                astronomicalYear: 1582,
                month: 10,
                day: 10,
                hour: 0,
                minute: 0,
                second: 0,
            },
            'gregorian',
        );
        expect(jd).toBeCloseTo(2299155.5, 10);
    });

    test('EphemerisEngine.julday agrees with julianDayUt for UTC civil labels', async () => {
        const engine = EphemerisEngine.getInstance();
        await engine.initialize();
        for (const [y, m, d, expected] of SE_JULDAY_AUTO) {
            const dt = DateTime.fromObject({ year: y, month: m, day: d }, { zone: 'utc' });
            if (!dt.isValid && y === 1500 && m === 2 && d === 29) {
                const jd = julianDayUt({
                    astronomicalYear: y,
                    month: m,
                    day: d,
                    hour: 0,
                    minute: 0,
                    second: 0,
                });
                expect(jd).toBeCloseTo(expected, 10);
                continue;
            }
            expect(engine.julday(dt)).toBeCloseTo(expected, 10);
            expect(dateTimeToJulianDayUt(dt)).toBeCloseTo(expected, 10);
        }
    });

    test('julianDayUt at 10000 BCE (outside civil resolver span)', () => {
        expect(
            julianDayUt({
                astronomicalYear: -10000,
                month: 1,
                day: 1,
                hour: 0,
                minute: 0,
                second: 0,
            }),
        ).toBeCloseTo(-1931442.5, 6);
    });

    test('resolveCivilTime: Julian 1500-02-29 noon UTC', () => {
        const r = resolveCivilTime({
            local: { year: 1500, month: 2, day: 29, hour: 12, minute: 0, second: 0 },
            timezone: 'UTC',
            latitude: 0,
            longitude: 0,
        });
        expect(r.julianDayUt).toBeCloseTo(2268992.0, 10);
    });
});
