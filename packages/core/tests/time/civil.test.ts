/**
 * Civil-time resolver tests. Expected instants are derived by hand from the
 * definitions (IANA zone rules, LMT = 4 min of time per degree of longitude,
 * Julian Day counting) — no values sampled from JHora or Swiss Ephemeris.
 */
import { DateTime } from 'luxon';

import { localClockToJulianDay } from '../../src/time/calendar.js';
import {
    CIVIL_YEAR_MAX,
    CIVIL_YEAR_MIN,
    resolveCivilTime,
    type CivilTimeInput,
} from '../../src/time/civil.js';
import { julianDayUt } from '../../src/time/historical.js';
import { getTzdbVersion } from '../../src/time/tzdb.js';

const chennai: Pick<CivilTimeInput, 'latitude' | 'longitude' | 'timezone'> = {
    latitude: 13.0827,
    longitude: 80.2707,
    timezone: 'Asia/Kolkata',
};

const newYork: Pick<CivilTimeInput, 'latitude' | 'longitude' | 'timezone'> = {
    latitude: 40.7,
    longitude: -74.0,
    timezone: 'America/New_York',
};

const clock = (year: number, month: number, day: number, hour: number, minute = 0, second = 0) => ({
    year,
    month,
    day,
    hour,
    minute,
    second,
});

describe('resolveCivilTime — IANA zones', () => {
    test('Sample 2000 resolves with IST (UTC+05:30)', () => {
        const result = resolveCivilTime({ ...chennai, local: clock(2000, 1, 1, 12, 0) });
        expect(result.resolvedUtc).toBe('2000-01-01T12:00:00.000Z');
        expect(result.tzResolution.resolvedUtc).toBe('2000-01-01T12:00:00.000Z');
        expect(result.tzResolution.tzdbVersion).toBe(getTzdbVersion());
        expect(result.tzResolution.steps[0].code).toBe('user_timezone');
        expect(result.inDaylightSaving).toBe(false);
        expect(result.warnings).toHaveLength(0);
        // JD of 2000-01-01 12:00 UT: 2000-01-01 0h = 2451545.0
        expect(result.julianDayUt).toBeCloseTo(2451545.0, 8);
    });

    test('tzdbVersion reports the runtime tz database, not a nominal constant', () => {
        const runtime = (process.versions as Record<string, string | undefined>).tz;
        expect(getTzdbVersion()).toBe(runtime);
    });

    describe('US spring-forward gap (2024-03-10 02:30 America/New_York does not exist)', () => {
        const base = { ...newYork, local: clock(2024, 3, 10, 2, 30) };

        test('forward → 03:30 EDT = 07:30Z', () => {
            const result = resolveCivilTime({ ...base, policy: { gap: 'forward' } });
            expect(result.resolvedUtc).toBe('2024-03-10T07:30:00.000Z');
            expect(result.warnings.some((w) => w.code === 'gap_local')).toBe(true);
            expect(result.tzResolution.steps.some((s) => s.code === 'gap_skip')).toBe(true);
            expect(result.inDaylightSaving).toBe(true);
        });

        test('default policy is forward', () => {
            expect(resolveCivilTime(base).resolvedUtc).toBe('2024-03-10T07:30:00.000Z');
        });

        test('backward → 01:30 EST = 06:30Z', () => {
            const result = resolveCivilTime({ ...base, policy: { gap: 'backward' } });
            expect(result.resolvedUtc).toBe('2024-03-10T06:30:00.000Z');
            expect(result.warnings.some((w) => w.code === 'gap_local')).toBe(true);
            expect(result.inDaylightSaving).toBe(false);
        });

        test('reject throws', () => {
            expect(() => resolveCivilTime({ ...base, policy: { gap: 'reject' } })).toThrow(/gap/);
        });

        test('times either side of the gap are unaffected', () => {
            expect(
                resolveCivilTime({ ...newYork, local: clock(2024, 3, 10, 1, 59) }).resolvedUtc,
            ).toBe('2024-03-10T06:59:00.000Z');
            expect(
                resolveCivilTime({ ...newYork, local: clock(2024, 3, 10, 3, 0) }).resolvedUtc,
            ).toBe('2024-03-10T07:00:00.000Z');
        });
    });

    describe('US fall-back fold (2024-11-03 01:30 America/New_York occurs twice)', () => {
        const base = { ...newYork, local: clock(2024, 11, 3, 1, 30) };

        test('earlier → 01:30 EDT = 05:30Z', () => {
            const result = resolveCivilTime({ ...base, policy: { ambiguous: 'earlier' } });
            expect(result.resolvedUtc).toBe('2024-11-03T05:30:00.000Z');
            expect(result.inDaylightSaving).toBe(true);
            expect(result.warnings.some((w) => w.code === 'ambiguous_local')).toBe(true);
            expect(result.tzResolution.steps.some((s) => s.code === 'ambiguous_fold')).toBe(true);
        });

        test('default policy is earlier', () => {
            expect(resolveCivilTime(base).resolvedUtc).toBe('2024-11-03T05:30:00.000Z');
        });

        test('later → 01:30 EST = 06:30Z', () => {
            const result = resolveCivilTime({ ...base, policy: { ambiguous: 'later' } });
            expect(result.resolvedUtc).toBe('2024-11-03T06:30:00.000Z');
            expect(result.inDaylightSaving).toBe(false);
        });

        test('reject throws', () => {
            expect(() => resolveCivilTime({ ...base, policy: { ambiguous: 'reject' } })).toThrow(
                /Ambiguous/,
            );
        });
    });

    test('Europe/London spring-forward gap 2024-03-31 01:00 → 01:00Z (forward)', () => {
        const result = resolveCivilTime({
            latitude: 51.5,
            longitude: -0.12,
            timezone: 'Europe/London',
            local: clock(2024, 3, 31, 1, 0),
        });
        expect(result.resolvedUtc).toBe('2024-03-31T01:00:00.000Z');
        expect(result.warnings.some((w) => w.code === 'gap_local')).toBe(true);
        expect(result.tzResolution.steps.some((s) => s.code === 'dst_rule')).toBe(true);
    });

    test('agrees with Luxon on ordinary (non-transition) times across zones', () => {
        for (const timezone of [
            'Europe/London',
            'America/Los_Angeles',
            'Australia/Lord_Howe',
            'Asia/Kathmandu',
        ]) {
            const local = clock(1975, 7, 14, 18, 45, 12);
            const result = resolveCivilTime({ latitude: 0, longitude: 0, timezone, local });
            const expected = DateTime.fromObject(local, { zone: timezone }).toUTC().toISO();
            expect(result.resolvedUtc).toBe(expected);
        }
    });

    test('India 1900–1905 uses the IANA Madras Time entry, not a hand-coded offset', () => {
        const result = resolveCivilTime({ ...chennai, local: clock(1901, 1, 1, 12, 0) });
        expect(result.tzResolution.steps.some((s) => s.code === 'lmt_offset')).toBe(false);
        const expected = DateTime.fromObject(clock(1901, 1, 1, 12, 0), { zone: 'Asia/Kolkata' })
            .toUTC()
            .toISO();
        expect(result.resolvedUtc).toBe(expected);
    });

    test('rejects unknown zones', () => {
        expect(() =>
            resolveCivilTime({ ...chennai, timezone: 'Mars/Olympus', local: clock(2000, 1, 1, 0) }),
        ).toThrow(/Unknown IANA/);
    });
});

describe('resolveCivilTime — local mean time', () => {
    test('India 1850 uses exact longitude LMT (80.2707° E = UTC+05:21:04.968)', () => {
        const result = resolveCivilTime({ ...chennai, local: clock(1850, 6, 15, 12, 0) });
        expect(result.tzResolution.steps.some((s) => s.code === 'lmt_offset')).toBe(true);
        expect(result.warnings.some((w) => w.code === 'lmt_fallback')).toBe(true);
        // 80.2707° × 240 s/° = 19264.968 s = 5h21m04.968s; 12:00:00 − that = 06:38:55.032 UT
        expect(result.resolvedUtc).toBe('1850-06-15T06:38:55.032Z');
        const jd0 = 2396923.5; // 1850-06-15 0h UT (Gregorian)
        expect(result.julianDayUt).toBeCloseTo(jd0 + (12 * 3600 - 19264.968) / 86400, 8);
        // Trace keeps the integer-minute schema; summary carries the exact offset.
        const lmt = result.tzResolution.steps.find((s) => s.code === 'lmt_offset')!;
        expect(lmt.offsetMinutes).toBe(321);
        expect(lmt.summary).toContain('+05:21:04.968');
    });

    test('preferIanaForIndia switches India pre-1900 to the IANA entry', () => {
        const lmt = resolveCivilTime({ ...chennai, local: clock(1850, 6, 15, 12, 0) });
        const iana = resolveCivilTime({
            ...chennai,
            local: clock(1850, 6, 15, 12, 0),
            preferIanaForIndia: true,
        });
        expect(iana.tzResolution.steps.some((s) => s.code === 'lmt_offset')).toBe(false);
        expect(iana.resolvedUtc).toBe(
            DateTime.fromObject(clock(1850, 6, 15, 12, 0), { zone: 'Asia/Kolkata' })
                .toUTC()
                .toISO(),
        );
        expect(iana.resolvedUtc).not.toBe(lmt.resolvedUtc);
    });

    test('BC date: 101 BC (year −100) March 1 in the proleptic Julian calendar, Paris LMT', () => {
        const result = resolveCivilTime({
            latitude: 48.8,
            longitude: 2.35,
            timezone: 'Europe/Paris',
            local: clock(-100, 3, 1, 12, 0),
        });
        expect(result.tzResolution.steps.some((s) => s.code === 'lmt_offset')).toBe(true);
        // −4712-01-01 0h = JD −0.5; 4612 Julian years × 365.25 d → −100-01-01 0h = 1684532.5;
        // −100 is a Julian leap year, Jan (31) + Feb (29) → Mar 1 0h = 1684592.5.
        // LMT 2.35° = +564 s, so 12:00 local = 11:50:36 UT.
        expect(result.julianDayUt).toBeCloseTo(1684592.5 + (12 * 3600 - 564) / 86400, 8);
    });

    test('year 0 (1 BC) is a Julian leap year: Feb 29 exists and precedes Mar 1 by one day', () => {
        const at = (month: number, day: number) =>
            resolveCivilTime({
                latitude: 0,
                longitude: 0,
                timezone: 'UTC',
                local: clock(0, month, day, 0),
            }).julianDayUt;
        expect(at(3, 1) - at(2, 29)).toBeCloseTo(1, 12);
        // 0001-01-01 0h (Julian) = JD 1721423.5
        expect(
            resolveCivilTime({
                latitude: 0,
                longitude: 0,
                timezone: 'UTC',
                local: clock(1, 1, 1, 0),
            }).julianDayUt,
        ).toBeCloseTo(1721423.5, 8);
    });

    test('1582 switchover: Julian 1582-10-04 is followed by Gregorian 1582-10-15', () => {
        const rome = { latitude: 41.9, longitude: 12.5, timezone: 'Europe/Rome' };
        const oct4 = resolveCivilTime({ ...rome, local: clock(1582, 10, 4, 23, 0) });
        const oct15 = resolveCivilTime({ ...rome, local: clock(1582, 10, 15, 1, 0) });
        expect(oct15.julianDayUt - oct4.julianDayUt).toBeCloseTo(2 / 24, 8);
        // Both sides use LMT (12.5° = +50 min) and JD 2299160.5 = 1582-10-15 0h UT.
        expect(oct15.julianDayUt).toBeCloseTo(2299160.5 + (1 - 50 / 60) / 24, 8);
        expect(oct15.resolvedUtc).toBe('1582-10-15T00:10:00.000Z');
    });

    test('uses the shared historical.ts calendar (one implementation)', () => {
        for (const [y, m, d] of [
            [-9999, 1, 1],
            [-100, 3, 1],
            [1582, 10, 4],
            [1582, 10, 15],
            [2024, 2, 29],
            [10000, 12, 31],
        ]) {
            const local = clock(y, m, d, 6, 30, 15);
            expect(localClockToJulianDay(local)).toBe(
                julianDayUt({
                    astronomicalYear: y,
                    month: m,
                    day: d,
                    hour: 6,
                    minute: 30,
                    second: 15,
                }),
            );
        }
    });

    test('dates before the IANA window (1800) use LMT even in modern zones', () => {
        const result = resolveCivilTime({ ...newYork, local: clock(1750, 1, 1, 12, 0) });
        expect(result.tzResolution.steps.some((s) => s.code === 'lmt_offset')).toBe(true);
        // −74.0° = −296 min → 12:00 local = 16:56 UT
        expect(result.resolvedUtc).toBe('1750-01-01T16:56:00.000Z');
    });

    test('forceLmt overrides the zone', () => {
        const result = resolveCivilTime({
            ...chennai,
            local: clock(2000, 1, 1, 12, 0),
            forceLmt: true,
        });
        expect(result.resolvedUtc).toBe('2000-01-01T04:01:55.032Z');
    });
});

describe('resolveCivilTime — overrides and range', () => {
    test('manual war-time offset override', () => {
        const result = resolveCivilTime({
            ...chennai,
            local: clock(1942, 6, 15, 12, 0),
            manualOffset: {
                offsetMinutes: 120,
                kind: 'war_time',
                label: 'British Double Summer Time',
            },
        });
        expect(result.tzResolution.steps.some((s) => s.code === 'manual_override')).toBe(true);
        expect(result.resolvedUtc).toBe('1942-06-15T10:00:00.000Z');
    });

    test('accepts the full 10 000 BC … 10 000 AD span and rejects beyond it', () => {
        expect(CIVIL_YEAR_MIN).toBe(-9_999);
        expect(CIVIL_YEAR_MAX).toBe(10_000);
        const utc = { latitude: 0, longitude: 0, timezone: 'UTC' };
        expect(() =>
            resolveCivilTime({ ...utc, local: clock(CIVIL_YEAR_MIN, 1, 1, 0) }),
        ).not.toThrow();
        expect(() =>
            resolveCivilTime({ ...utc, local: clock(CIVIL_YEAR_MAX, 12, 31, 23) }),
        ).not.toThrow();
        expect(() =>
            resolveCivilTime({ ...utc, local: clock(CIVIL_YEAR_MIN - 1, 1, 1, 0) }),
        ).toThrow(RangeError);
        expect(() =>
            resolveCivilTime({ ...utc, local: clock(CIVIL_YEAR_MAX + 1, 1, 1, 0) }),
        ).toThrow(RangeError);
    });
});
