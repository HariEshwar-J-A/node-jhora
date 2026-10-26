import { expectGolden } from '../src/jest.js';
import { formatGoldenReportText, goldenCompareResultToJson } from '../src/index.js';
import { compareGoldenCase, hashSettings, type GoldenCase } from '../src/index.js';

function tinyCase(): GoldenCase {
    const settings = { positionMode: 'geometric' };
    return {
        id: 'jest-fixture',
        provenance: { source: 'published-text', toolVersion: 'test', capturedAt: null },
        input: {
            instant: '2000-01-01T00:00:00Z',
            timezone: 'UTC',
            lat: 0,
            lon: 0,
            alt: 0,
            settingsPresetId: 'test',
            settingsHash: hashSettings(settings),
        },
        settings,
        expected: {
            'd1.planets.Sun.lon': { value: 10, tolerance: { type: 'arcsec', arcsec: 1 } },
        },
    };
}

describe('expectGolden', () => {
    it('returns the compare result when all paths pass', () => {
        const result = expectGolden(tinyCase(), { 'd1.planets.Sun.lon': 10 });
        expect(result.pass).toBe(true);
    });

    it('throws a text report when a path fails', () => {
        expect(() => expectGolden(tinyCase(), { 'd1.planets.Sun.lon': 20 }))
            .toThrow(/jest-fixture/);
    });
});

describe('report JSON', () => {
    it('round-trips the compare result', () => {
        const result = compareGoldenCase(tinyCase(), { 'd1.planets.Sun.lon': 20 });
        const json = goldenCompareResultToJson(result);
        expect(json.pass).toBe(false);
        expect(json.failureCount).toBe(1);
        expect(formatGoldenReportText(result)).toContain('Worst offenders');
    });
});
