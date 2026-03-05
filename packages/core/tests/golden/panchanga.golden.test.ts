/**
 * Golden Standard: Panchanga
 *
 * Validates Tithi, Nakshatra, Yoga, Karana, and Vara calculations
 * against reference values for three known dates.
 *
 * NOTE: After Decimal.js refactor the Karana cycle is corrected.
 *       Update KARANA expected values if they differ post-refactor.
 */
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { calculatePanchanga } from '../../src/vedic/panchanga.js';
import { DateTime } from 'luxon';
import { ALL_CHARTS } from '../fixtures/reference_charts.js';

describe('Golden: Panchanga', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
        engine.setAyanamsa(1);
    });

    for (const chart of ALL_CHARTS) {
        describe(`Chart ${chart.label}`, () => {
            const ref = chart.panchanga;
            let result: ReturnType<typeof calculatePanchanga>;

            beforeAll(() => {
                const date = DateTime.fromObject({
                    year: chart.year, month: chart.month, day: chart.day,
                    hour: chart.hour, minute: chart.minute, second: chart.second,
                }, { zone: 'utc' });
                const planets = engine.getPlanets(date, undefined, { ayanamsaOrder: 1, nodeType: 'mean' });
                const sun  = planets.find(p => p.name === 'Sun')!;
                const moon = planets.find(p => p.name === 'Moon')!;
                result = calculatePanchanga(sun.longitude, moon.longitude, date);
            });

            test(`Tithi index = ${ref.tithiIndex}`, () => {
                expect(result.tithi.index).toBe(ref.tithiIndex);
            });

            test(`Tithi name = "${ref.tithiName}"`, () => {
                expect(result.tithi.name).toBe(ref.tithiName);
            });

            test(`Nakshatra index = ${ref.nakshatraIndex}`, () => {
                expect(result.nakshatra.index).toBe(ref.nakshatraIndex);
            });

            test(`Nakshatra name = "${ref.nakshatraName}"`, () => {
                expect(result.nakshatra.name).toBe(ref.nakshatraName);
            });

            test(`Nakshatra pada = ${ref.nakshatraPada}`, () => {
                expect(result.nakshatra.pada).toBe(ref.nakshatraPada);
            });

            test(`Yoga index = ${ref.yogaIndex}`, () => {
                expect(result.yoga.index).toBe(ref.yogaIndex);
            });

            test(`Yoga name = "${ref.yogaName}"`, () => {
                expect(result.yoga.name).toBe(ref.yogaName);
            });

            test(`Karana index = ${ref.karanaIndex}`, () => {
                expect(result.karana.index).toBe(ref.karanaIndex);
            });

            test(`Karana name = "${ref.karanaName}"`, () => {
                expect(result.karana.name).toBe(ref.karanaName);
            });

            test(`Vara name = "${ref.varaName}"`, () => {
                expect(result.vara.name).toBe(ref.varaName);
            });
        });
    }

    // ---------------------------------------------------------------------------
    // Boundary / formula tests
    // ---------------------------------------------------------------------------
    describe('Formula invariants', () => {
        test('Tithi 1 at exact new moon (Sun=Moon)', () => {
            const res = calculatePanchanga(0, 0.001, DateTime.now());
            expect(res.tithi.index).toBe(1);
        });

        test('Tithi 30 (Amavasya) at ~353° diff', () => {
            const res = calculatePanchanga(0, 353, DateTime.now());
            expect(res.tithi.index).toBe(30);
        });

        test('Purnima at ~173° diff', () => {
            const res = calculatePanchanga(0, 173, DateTime.now());
            expect(res.tithi.index).toBe(15);
            expect(res.tithi.name).toBe('Purnima');
        });

        test('Nakshatra 1 (Ashwini) at Moon=0°', () => {
            const res = calculatePanchanga(0, 0, DateTime.now());
            expect(res.nakshatra.name).toBe('Ashwini');
            expect(res.nakshatra.index).toBe(1);
        });

        test('Nakshatra 27 (Revati) at Moon=359°', () => {
            const res = calculatePanchanga(0, 359, DateTime.now());
            expect(res.nakshatra.name).toBe('Revati');
            expect(res.nakshatra.index).toBe(27);
        });

        test('Tithi percent is in [0, 100)', () => {
            const res = calculatePanchanga(0, 45, DateTime.now());
            expect(res.tithi.percent).toBeGreaterThanOrEqual(0);
            expect(res.tithi.percent).toBeLessThan(100);
        });
    });
});
