import {
    angleDeltaArcsec,
    compareGoldenCase,
    compareGoldenPaths,
    hashSettings,
    signedAngleDeltaDegrees,
    type GoldenCase,
} from '../src/index.js';

function makeCase(expected: GoldenCase['expected']): GoldenCase {
    const settings = { positionMode: 'geometric' };
    return {
        id: 'compare-fixture',
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
        expected,
    };
}

describe('angle delta', () => {
    it('handles 359°59′59″ vs 0°00′01″ (wrap-around)', () => {
        const a = 359 + 59 / 60 + 59 / 3600;
        const b = 1 / 3600;
        expect(angleDeltaArcsec(a, b)).toBeCloseTo(2, 5);
        expect(signedAngleDeltaDegrees(a, b) * 3600).toBeCloseTo(2, 5);
    });

    it('wraps 359.9997° vs 0.0002° to 1.8″ in both directions', () => {
        expect(angleDeltaArcsec(359.9997, 0.0002)).toBeCloseTo(1.8, 6);
        expect(signedAngleDeltaDegrees(359.9997, 0.0002) * 3600).toBeCloseTo(1.8, 6);
        expect(signedAngleDeltaDegrees(0.0002, 359.9997) * 3600).toBeCloseTo(-1.8, 6);
    });

    it('wraps inputs outside [0, 360)', () => {
        expect(signedAngleDeltaDegrees(359.9997, 360.0002) * 3600).toBeCloseTo(1.8, 6);
        expect(signedAngleDeltaDegrees(-0.0003, 0.0002) * 3600).toBeCloseTo(1.8, 6);
        expect(signedAngleDeltaDegrees(0.0002, 720.0002)).toBeCloseTo(0, 10);
        expect(signedAngleDeltaDegrees(10, -710)).toBeCloseTo(0, 10);
    });

    it('returns +180 (not −180) for antipodal points', () => {
        expect(signedAngleDeltaDegrees(0, 180)).toBe(180);
        expect(signedAngleDeltaDegrees(180, 0)).toBe(180);
    });

    it('applies the tolerance across the 0/360 seam', () => {
        const path = 'd1.planets.Sun.lon';
        const within = compareGoldenPaths(
            { [path]: { value: 359.9997, tolerance: { type: 'arcsec', arcsec: 2 } } },
            { [path]: 0.0002 },
        );
        expect(within[0].pass).toBe(true);
        expect(within[0].delta).toBeCloseTo(1.8, 6);
        const beyond = compareGoldenPaths(
            { [path]: { value: 359.9997, tolerance: { type: 'arcsec', arcsec: 1 } } },
            { [path]: 0.0002 },
        );
        expect(beyond[0].pass).toBe(false);
    });

    it('is antisymmetric on the circle', () => {
        const a = 10;
        const b = 350;
        expect(signedAngleDeltaDegrees(a, b)).toBeCloseTo(-20, 10);
        expect(signedAngleDeltaDegrees(b, a)).toBeCloseTo(20, 10);
    });
});

describe('compareGoldenPaths', () => {
    it('passes arcsecond paths within tolerance', () => {
        const rows = compareGoldenPaths(
            {
                'd1.planets.Sun.lon': { value: 100, tolerance: { type: 'arcsec', arcsec: 1 } },
            },
            { 'd1.planets.Sun.lon': 100 + 0.9 / 3600 },
        );
        expect(rows[0].pass).toBe(true);
        expect(rows[0].delta).toBeCloseTo(0.9, 3);
    });

    it('fails arcsecond paths beyond tolerance', () => {
        const rows = compareGoldenPaths(
            {
                'd1.planets.Sun.lon': { value: 100, tolerance: { type: 'arcsec', arcsec: 0.5 } },
            },
            { 'd1.planets.Sun.lon': 100 + 2 / 3600 },
        );
        expect(rows[0].pass).toBe(false);
    });

    it('compares sidereal hours with second slack', () => {
        const rows = compareGoldenPaths(
            {
                'siderealTime.hours': { value: 12, tolerance: { type: 'seconds', seconds: 2 } },
            },
            { 'siderealTime.hours': 12 + 1 / 3600 },
        );
        expect(rows[0].pass).toBe(true);
        expect(rows[0].delta).toBeCloseTo(1, 3);
    });

    it('compares dasa end dates in seconds', () => {
        const rows = compareGoldenPaths(
            {
                'dasa.vimshottari[0].end': { value: '2009-07-07', tolerance: { type: 'seconds', seconds: 86400 } },
            },
            { 'dasa.vimshottari[0].end': '2009-07-08' },
        );
        expect(rows[0].pass).toBe(true);
    });

    it('requires exact equality for strings and booleans', () => {
        const rows = compareGoldenPaths(
            {
                'd1.planets.Sun.printed': { value: '1 Ar 00\' 00.00"', tolerance: { type: 'exact' } },
                'd1.planets.Saturn.retrograde': { value: true, tolerance: { type: 'exact' } },
            },
            {
                'd1.planets.Sun.printed': '1 Ar 00\' 00.00"',
                'd1.planets.Saturn.retrograde': false,
            },
        );
        const printed = rows.find((row) => row.path === 'd1.planets.Sun.printed');
        const retro = rows.find((row) => row.path === 'd1.planets.Saturn.retrograde');
        expect(printed?.pass).toBe(true);
        expect(retro?.pass).toBe(false);
    });
});

describe('compareGoldenCase report', () => {
    it('lists worst offenders grouped by feature id', () => {
        const golden = makeCase({
            'd1.planets.Sun.lon': { value: 0, tolerance: { type: 'arcsec', arcsec: 1 } },
            'd1.planets.Moon.lon': { value: 0, tolerance: { type: 'arcsec', arcsec: 1 } },
            'd1.planets.Sun.sign': { value: 1, tolerance: { type: 'exact' } },
        });
        const result = compareGoldenCase(golden, {
            'd1.planets.Sun.lon': 5 / 3600,
            'd1.planets.Moon.lon': 0.1 / 3600,
            'd1.planets.Sun.sign': 2,
        });
        expect(result.pass).toBe(false);
        expect(result.worstByFeature.length).toBeGreaterThan(0);
        expect(result.worstByFeature[0].path).toBe('d1.planets.Sun.lon');
    });
});
