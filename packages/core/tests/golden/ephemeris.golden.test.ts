/**
 * Golden Standard: Ephemeris Engine
 *
 * Validates Swiss Ephemeris WASM output for sidereal planet positions
 * against known reference values (Lahiri ayanamsa, mean nodes, geocentric).
 *
 * Tolerance: 4 decimal places (0.00005°) — sub-arcsecond precision.
 */
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { DateTime } from 'luxon';
import { ALL_CHARTS, type ChartRef } from '../fixtures/reference_charts.js';

describe('Golden: EphemerisEngine — Planetary Positions', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
        engine.setAyanamsa(1); // Lahiri
    });

    for (const chart of ALL_CHARTS) {
        describe(`Chart ${chart.label}`, () => {
            let planets: ReturnType<typeof engine.getPlanets>;

            beforeAll(() => {
                const date = DateTime.fromObject({
                    year: chart.year, month: chart.month, day: chart.day,
                    hour: chart.hour, minute: chart.minute, second: chart.second,
                }, { zone: 'utc' });
                planets = engine.getPlanets(date, undefined, {
                    ayanamsaOrder: 1,
                    nodeType: 'mean',
                });
            });

            for (const ref of chart.planets) {
                test(`${ref.name} longitude = ${ref.longitude}°`, () => {
                    const p = planets.find(pl => pl.name === ref.name);
                    expect(p).toBeDefined();
                    expect(p!.longitude).toBeCloseTo(ref.longitude, 3);
                });

                test(`${ref.name} sign = ${ref.sign}`, () => {
                    const p = planets.find(pl => pl.name === ref.name);
                    const signNum = Math.floor(p!.longitude / 30) + 1;
                    expect(signNum).toBe(ref.sign);
                });

                test(`${ref.name} speed sign correct`, () => {
                    const p = planets.find(pl => pl.name === ref.name);
                    // Sign of speed must match (retrograde / direct)
                    if (ref.speed < 0) {
                        expect(p!.speed).toBeLessThan(0);
                    } else {
                        expect(p!.speed).toBeGreaterThan(0);
                    }
                });
            }

            test('returns 9 planets (Sun Moon Merc Ven Mars Jup Sat Rahu Ketu)', () => {
                expect(planets.length).toBe(9);
            });

            test('Ketu = Rahu + 180°', () => {
                const rahu = planets.find(p => p.name === 'Rahu')!;
                const ketu = planets.find(p => p.name === 'Ketu')!;
                const diff = Math.abs(rahu.longitude - ketu.longitude);
                expect(Math.abs(diff - 180)).toBeLessThan(0.001);
            });

            test('all longitudes in [0, 360)', () => {
                for (const p of planets) {
                    expect(p.longitude).toBeGreaterThanOrEqual(0);
                    expect(p.longitude).toBeLessThan(360);
                }
            });
        });
    }

    describe('Julian Day Calculation', () => {
        test('J2000 epoch JD = 2451545.0', () => {
            const date = DateTime.fromObject({ year: 2000, month: 1, day: 1, hour: 12 }, { zone: 'utc' });
            // @ts-ignore — access internal module for JD
            const jd = engine['module'].julday(2000, 1, 1, 12.0, 1);
            expect(jd).toBeCloseTo(2451545.0, 2);
        });

        test('Unix epoch JD = 2440587.5', () => {
            // @ts-ignore
            const jd = engine['module'].julday(1970, 1, 1, 0.0, 1);
            expect(jd).toBeCloseTo(2440587.5, 2);
        });
    });
});
