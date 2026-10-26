import { jest } from '@jest/globals';
import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { julianDayUt } from '../../src/time/historical.js';

/** New Delhi — longitude must not shift UTC-labelled civil times. */
const DELHI = { latitude: 28.6139, longitude: 77.209 };

describe('EphemerisEngine — UTC civil time ignores birth longitude for JD', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
    });

    function expectedJd(y: number, m: number, d: number, hour: number): number {
        return julianDayUt({
            astronomicalYear: y,
            month: m,
            day: d,
            hour,
            minute: 0,
            second: 0,
        });
    }

    const eras = [
        { y: 1000, m: 6, d: 15, hour: 12 },
        { y: 1700, m: 3, d: 20, hour: 6 },
        { y: 2500, m: 1, d: 1, hour: 0 },
    ] as const;

    for (const { y, m, d, hour } of eras) {
        test(`julday at ${y} UTC matches julianDayUt even with Delhi coordinates`, () => {
            const dt = DateTime.fromObject(
                { year: y, month: m, day: d, hour, minute: 0, second: 0 },
                { zone: 'utc' },
            );
            const jd = engine.julday(dt, {
                latitude: DELHI.latitude,
                longitude: DELHI.longitude,
            });
            expect(jd).toBeCloseTo(expectedJd(y, m, d, hour), 10);
        });

        test(`getPlanets at ${y} UTC uses the same julday with and without Delhi`, () => {
            const dt = DateTime.fromObject(
                { year: y, month: m, day: d, hour, minute: 0, second: 0 },
                { zone: 'utc' },
            );
            const spy = jest.spyOn(engine, 'julday');
            const opts = { ayanamsaOrder: 27 };
            try {
                engine.getPlanets(dt, DELHI, opts);
            } catch (e) {
                if (!(e instanceof RangeError && String(e).includes('outside DE440s'))) throw e;
            }
            const jdWithLoc = spy.mock.results.at(-1)?.value as number;
            spy.mockClear();
            try {
                engine.getPlanets(dt, undefined, opts);
            } catch (e) {
                if (!(e instanceof RangeError && String(e).includes('outside DE440s'))) throw e;
            }
            const jdBare = spy.mock.results.at(-1)?.value as number;
            spy.mockRestore();
            expect(jdWithLoc).toBeCloseTo(jdBare, 10);
            expect(jdWithLoc).toBeCloseTo(expectedJd(y, m, d, hour), 10);
        });
    }

    test('getPlanets longitudes match for UTC 2000 with vs without Delhi (in DE440s)', () => {
        const dt = DateTime.fromObject(
            { year: 2000, month: 6, day: 15, hour: 12, minute: 0, second: 0 },
            { zone: 'utc' },
        );
        const withLoc = engine.getPlanets(dt, DELHI, { ayanamsaOrder: 27 });
        const bare = engine.getPlanets(dt, undefined, { ayanamsaOrder: 27 });
        for (const p of withLoc) {
            const other = bare.find((q) => q.id === p.id)!;
            expect(p.longitude).toBeCloseTo(other.longitude, 8);
        }
    });
});
