import * as fc from 'fast-check';
import { DateTime } from 'luxon';

import { isNodeJHoraError, NodeJHoraErrorCode } from '../../src/errors.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { EPHEMERIS_ASTRO_YEAR_MAX, EPHEMERIS_ASTRO_YEAR_MIN } from '../../src/validation/bounds.js';

function nonFiniteDeep(value: unknown, path = '$'): string[] {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? [] : [`${path}=${value}`];
    }
    if (Array.isArray(value)) {
        return value.flatMap((v, i) => nonFiniteDeep(v, `${path}[${i}]`));
    }
    if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([k, v]) => nonFiniteDeep(v, `${path}.${k}`));
    }
    return [];
}

describe('property-based validation', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = new EphemerisEngine();
        await engine.initialize();
    });

    test('valid civil dates inside DE440s never throw and never return non-finite numbers', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1850, max: 2149 }),
                fc.integer({ min: 1, max: 12 }),
                fc.integer({ min: 1, max: 28 }),
                fc.integer({ min: 0, max: 23 }),
                (year, month, day, hour) => {
                    const dt = DateTime.fromObject(
                        { year, month, day, hour, minute: 0, second: 0 },
                        { zone: 'utc' },
                    );
                    if (!dt.isValid) return true;
                    const planets = engine.getPlanets(dt, { latitude: 10, longitude: 77 });
                    expect(nonFiniteDeep(planets)).toEqual([]);
                    const jd = engine.julday(dt);
                    const houses = engine.getHouses(jd, 10, 77, 'W');
                    expect(nonFiniteDeep(houses)).toEqual([]);
                    return true;
                },
            ),
            { numRuns: 40 },
        );
    });

    test('invalid latitudes always throw INVALID_INPUT or OUT_OF_RANGE', () => {
        const jd = engine.julday(DateTime.utc(2020, 6, 15));
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant(NaN),
                    fc.constant(Infinity),
                    fc.double({ min: 90.0001, max: 200, noNaN: true }),
                    fc.double({ min: -200, max: -90.0001, noNaN: true }),
                ),
                (lat) => {
                    try {
                        engine.getHouses(jd, lat, 0, 'W');
                        return false;
                    } catch (err) {
                        return (
                            isNodeJHoraError(err) &&
                            (err.code === NodeJHoraErrorCode.INVALID_INPUT ||
                                err.code === NodeJHoraErrorCode.OUT_OF_RANGE)
                        );
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    test('years outside the advertised span throw OUT_OF_RANGE', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer({ max: EPHEMERIS_ASTRO_YEAR_MIN - 1 }),
                    fc.integer({ min: EPHEMERIS_ASTRO_YEAR_MAX + 1 }),
                ),
                (year) => {
                    const dt = DateTime.fromObject(
                        { year, month: 6, day: 15, hour: 12 },
                        { zone: 'utc' },
                    );
                    try {
                        engine.getPlanets(dt);
                        return false;
                    } catch (err) {
                        return (
                            isNodeJHoraError(err) &&
                            (err.code === NodeJHoraErrorCode.OUT_OF_RANGE ||
                                err.code === NodeJHoraErrorCode.INVALID_INPUT)
                        );
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});
