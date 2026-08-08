/**
 * Regression: Ephemeris Engine
 *
 * Locks the engine's sidereal output against the snapshot in
 * `reference_charts.ts` so that unintended changes surface immediately.
 *
 * This is a *regression* suite, not a correctness suite — the fixture is the
 * engine's own output. Correctness is established elsewhere:
 *   horizons.golden.test.ts    astrometry vs JPL Horizons, sub-arcsecond
 *   jhora-bridge.golden.test.ts sidereal zero point vs JHora
 *
 * The physical-plausibility block at the end is the guard that makes this
 * meaningful on its own: it asserts things that must hold no matter what the
 * fixture says, and would have rejected the previous fixture, which had the
 * Sun and Moon moving backwards.
 */
import { EphemerisEngine, AYANAMSA } from '../../src/engine/ephemeris.js';
import { DateTime } from 'luxon';
import { ALL_CHARTS, type ChartRef } from '../fixtures/reference_charts.js';

describe('Regression: EphemerisEngine — Planetary Positions', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
        engine.setAyanamsa(AYANAMSA.TRUE_CITRA);
    });

    for (const chart of ALL_CHARTS) {
        describe(`Chart ${chart.label}`, () => {
            let planets: ReturnType<typeof engine.getPlanets>;

            beforeAll(() => {
                const date = DateTime.fromObject({
                    year: chart.year, month: chart.month, day: chart.day,
                    hour: chart.hour, minute: chart.minute, second: chart.second,
                }, { zone: 'utc' });
                // Engine defaults (true node, geometric places) are JHora's
                // conventions — the snapshot is generated the same way.
                planets = engine.getPlanets(date, undefined, {
                    ayanamsaOrder: AYANAMSA.TRUE_CITRA,
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
            const jd = engine.julday(date);
            expect(jd).toBeCloseTo(2451545.0, 2);
        });

        test('Unix epoch JD = 2440587.5', () => {
            const date = DateTime.fromObject({ year: 1970, month: 1, day: 1, hour: 0 }, { zone: 'utc' });
            const jd = engine.julday(date);
            expect(jd).toBeCloseTo(2440587.5, 2);
        });
    });

    // -----------------------------------------------------------------------
    // Physical plausibility — independent of any fixture
    // -----------------------------------------------------------------------

    /**
     * Bounds taken from orbital mechanics, not from this engine. If a future
     * change reintroduces a velocity or frame defect, these fail even if the
     * fixture has been regenerated alongside it.
     */
    describe('Physical plausibility (fixture-independent)', () => {
        /** name → [min, max] apparent daily motion in degrees. */
        const DAILY_MOTION: Record<string, [number, number]> = {
            // Perigee/apogee extremes of the true anomalistic rate
            Moon:    [ 11.7,  15.4],
            // Perihelion/aphelion extremes of the apparent solar rate
            Sun:     [  0.95,  1.02],
            // Outer planets can retrograde; bounds are on magnitude
            Mercury: [ -1.5,   2.3],
            Venus:   [ -0.7,   1.3],
            Mars:    [ -0.5,   0.85],
            Jupiter: [ -0.15,  0.25],
            Saturn:  [ -0.09,  0.14],
        };

        for (const chart of ALL_CHARTS) {
            test(`${chart.label}: daily motion is within physical bounds`, () => {
                const date = DateTime.fromObject({
                    year: chart.year, month: chart.month, day: chart.day,
                    hour: chart.hour, minute: chart.minute, second: chart.second,
                }, { zone: 'utc' });

                for (const p of engine.getPlanets(date)) {
                    const bounds = DAILY_MOTION[p.name];
                    if (!bounds) continue;   // nodes are handled separately
                    expect(p.speed).toBeGreaterThanOrEqual(bounds[0]);
                    expect(p.speed).toBeLessThanOrEqual(bounds[1]);
                }
            });

            test(`${chart.label}: the ascendant leads the MC by 0°–180°`, () => {
                const date = DateTime.fromObject({
                    year: chart.year, month: chart.month, day: chart.day,
                    hour: chart.hour, minute: chart.minute, second: chart.second,
                }, { zone: 'utc' });
                const h = engine.getHouses(engine.julday(date), chart.lat, chart.lon, 'W', true);

                // Geometric necessity: the rising point always precedes the
                // culminating point. The previous fixture violated this by
                // exactly 180° for Chart A.
                const lead = ((h.ascendant - h.mc) % 360 + 360) % 360;
                expect(lead).toBeGreaterThan(0);
                expect(lead).toBeLessThan(180);
            });
        }

        test('the mean node always regresses at ~0.0529°/day', () => {
            for (const chart of ALL_CHARTS) {
                const date = DateTime.fromObject({
                    year: chart.year, month: chart.month, day: chart.day,
                    hour: chart.hour, minute: chart.minute, second: chart.second,
                }, { zone: 'utc' });
                const rahu = engine.getPlanets(date, undefined, { nodeType: 'mean' })
                    .find(p => p.name === 'Rahu')!;
                expect(rahu.speed).toBeCloseTo(-0.0529538, 5);
            }
        });
    });
});
