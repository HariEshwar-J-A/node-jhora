import { DateTime } from 'luxon';

import { NodeJHoraError, NodeJHoraErrorCode } from '../../src/errors.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { describeCalculation } from '../../src/settings/index.js';
import { type CalendarMode, julianDayUt } from '../../src/time/historical.js';
import {
    EPHEMERIS_ASTRO_YEAR_MAX,
    EPHEMERIS_ASTRO_YEAR_MIN,
    EPHEMERIS_JD_UT_MAX,
    EPHEMERIS_JD_UT_MIN,
} from '../../src/validation/bounds.js';

describe('input validation', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
    });

    test('getHouses rejects invalid latitude and house method', () => {
        const jd = engine.julday(DateTime.utc(2024, 1, 1));
        try {
            engine.getHouses(jd, 91, 0, 'P');
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.OUT_OF_RANGE });
        }
        try {
            engine.getHouses(jd, 10, 0, 'Z');
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
    });

    test('getHouses normalizes equivalent longitudes', () => {
        const jd = engine.julday(DateTime.utc(2024, 5, 5, 5));
        const ref = engine.getHouses(jd, 45, 180, 'P');
        const wrapped = engine.getHouses(jd, 45, -180, 'P');
        expect(wrapped.cusps.map((c, i) => Math.abs(c - ref.cusps[i])).every((d) => d < 1e-9)).toBe(
            true,
        );
    });

    test('getPlanets rejects invalid DateTime and JavaScript Date', () => {
        try {
            engine.getPlanets(DateTime.fromISO('nope'));
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
        try {
            engine.getPlanets(new Date('2024-01-01T00:00:00Z') as never);
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
    });

    test('julday still accepts a JavaScript Date', () => {
        const jd = engine.julday(new Date('2024-01-01T00:00:00Z'));
        expect(Number.isFinite(jd)).toBe(true);
    });

    function expectCivilEdgeUniform(
        calendar: CalendarMode,
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        second: number,
        expectedJd: number,
    ): void {
        const dt = DateTime.utc(year, month, day, hour, minute, second);
        const jd = engine.julday(dt, { calendar });
        expect(jd).toBe(expectedJd);
        expect(() => engine.getHouses(jd, 0, 0, 'W')).not.toThrow();
        expect(() => engine.getAyanamsa(jd)).not.toThrow();
        try {
            engine.getPlanets(dt, undefined, { calendar });
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE });
        }
    }

    test('civil min uses the same UT bounds for julday, houses, ayanamsa, and getPlanets', () => {
        const parts = {
            astronomicalYear: EPHEMERIS_ASTRO_YEAR_MIN,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        };
        expectCivilEdgeUniform('auto', -10_000, 1, 1, 0, 0, 0, EPHEMERIS_JD_UT_MIN);
        expectCivilEdgeUniform('julian', -10_000, 1, 1, 0, 0, 0, julianDayUt(parts, 'julian'));
        expectCivilEdgeUniform(
            'gregorian',
            -10_000,
            1,
            1,
            0,
            0,
            0,
            julianDayUt(parts, 'gregorian'),
        );
    });

    test('civil max uses the same UT bounds for julday, houses, ayanamsa, and getPlanets', () => {
        const endJd = julianDayUt(
            {
                astronomicalYear: EPHEMERIS_ASTRO_YEAR_MAX,
                month: 12,
                day: 31,
                hour: 23,
                minute: 59,
                second: 59,
            },
            'gregorian',
        );
        expect(endJd).toBeLessThan(EPHEMERIS_JD_UT_MAX);
        const jdAtMax = EPHEMERIS_JD_UT_MAX - 1 / 86_400;
        expect(() => engine.getHouses(jdAtMax, 0, 0, 'W')).not.toThrow();
        expect(() => engine.getAyanamsa(jdAtMax)).not.toThrow();
        try {
            engine.getPlanets(DateTime.utc(10_000, 12, 31, 23, 59, 59), undefined, {
                calendar: 'gregorian',
            });
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE });
        }
        const over = EPHEMERIS_JD_UT_MAX + 1 / 86_400;
        for (const fn of [
            () => engine.getHouses(over, 0, 0, 'W'),
            () => engine.getAyanamsa(over),
        ]) {
            try {
                fn();
                throw new Error('expected throw');
            } catch (err) {
                expect(err).toMatchObject({ code: NodeJHoraErrorCode.OUT_OF_RANGE });
            }
        }
    });

    test('getHouses rejects longitude outside ±360°', () => {
        const jd = engine.julday(DateTime.utc(2024, 1, 1));
        try {
            engine.getHouses(jd, 10, 1000, 'P');
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
    });

    test('getPlanets throws EPHEMERIS_UNAVAILABLE when NJCE chunks are missing', () => {
        const longEngine = new EphemerisEngine();
        const store = {
            get: () => undefined,
            prefetchSyncForJdTdb: () => {},
            asGetter: () => () => undefined,
        };
        longEngine.setChunkStore(store as never);
        return longEngine.initialize().then(() => {
            longEngine.setEphemerisPolicy('auto');
            const dt = DateTime.utc(300, 6, 15, 12);
            try {
                longEngine.getPlanets(dt);
                throw new Error('expected throw');
            } catch (err) {
                expect(err).toMatchObject({ code: NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE });
            }
        });
    });

    test('describeCalculation rejects unknown settings', () => {
        try {
            describeCalculation({ houseSystem: 'Z' as 'whole_sign' });
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toMatchObject({ code: NodeJHoraErrorCode.INVALID_INPUT });
        }
    });
});
