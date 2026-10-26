import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    FEATURE_PATH_RULES,
    GoldenCaseSchema,
    formatJsonSchema,
    hashSettings,
    matchFeaturePath,
    type ExpectedEntry,
    type FeaturePathRule,
    type GoldenCase,
    type SettingsDocument,
} from '../src/index.js';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../schema/golden-case.schema.json');

const SAMPLES: Record<string, string> = {
    'varga-planet-angle': 'd1.planets.Sun.lon',
    'varga-planet-sign': 'd9.planets.Rahu.sign',
    'varga-planet-printed': 'd10.planets.Venus.printed',
    'varga-planet-retrograde': 'd1.planets.Saturn.retrograde',
    'varga-asc-angle': 'd60.ascendant.lat',
    'varga-asc-sign': 'd1.ascendant.sign',
    'varga-asc-printed': 'd9.ascendant.printed',
    'ayanamsa-value': 'ayanamsa.value',
    'ayanamsa-printed': 'ayanamsa.printed',
    'ayanamsa-mode': 'ayanamsa.mode',
    'sidereal-hours': 'siderealTime.hours',
    'sidereal-printed': 'siderealTime.printed',
    'panchanga-name': 'panchanga.tithi.name',
    'panchanga-index': 'panchanga.vara.index',
    'panchanga-pada': 'panchanga.nakshatra.pada',
    'panchanga-percent': 'panchanga.yoga.percentLeft',
    'panchanga-tolerance': 'meta.panchanga.tolerancePercent',
    'dasa-start-lord': 'dasa.vimshottari.startLord',
    'dasa-lord': 'dasa.vimshottari[0].lord',
    'dasa-bound': 'dasa.vimshottari[0].start',
    'd10-scheme': 'd10.scheme',
    'd10-label': 'd10.label',
    'd10-even-sign': 'd10.evenSignBodies[0]',
    'horizons-angle': 'horizons.planets.Moon.lat',
    'time-jd': 'time.jd',
    'meta-clock': 'meta.birth.utc.year',
    'meta-offset': 'meta.birth.utcOffsetHours',
    'meta-epoch-label': 'meta.epoch.label',
    'meta-epoch-bodies': 'meta.epoch.bodies[0]',
    'meta-deltat-year': 'meta.contract.lastObservedDeltaTYear',
    'meta-tolerance': 'meta.contract.futureTolerance.latitude',
};

function entryFor(rule: FeaturePathRule): ExpectedEntry {
    const value = rule.valueKind === 'string' ? 'sample'
        : rule.valueKind === 'boolean' ? true
        : rule.valueKind === 'number-or-string' ? '2000-01-01T12:00:00Z'
        : 1;
    if (rule.tolerance === 'arcsec') return { value: 1, tolerance: { type: 'arcsec', arcsec: 0.5 } };
    if (rule.tolerance === 'seconds') return { value, tolerance: { type: 'seconds', seconds: 2 } };
    return { value, tolerance: { type: 'exact' } };
}

function makeCase(expected: GoldenCase['expected'], settings: SettingsDocument = { positionMode: 'geometric' }): GoldenCase {
    return {
        id: 'sample-case',
        provenance: { source: 'published-text', toolVersion: 'test', capturedAt: null },
        input: {
            instant: '2000-01-01T00:00:00Z',
            timezone: 'UTC',
            lat: 0,
            lon: 0,
            alt: 0,
            settingsPresetId: 'test-preset',
            settingsHash: hashSettings(settings),
        },
        settings,
        expected,
    };
}

describe('feature path registry', () => {
    it('matches exactly one sample per rule', () => {
        expect(Object.keys(SAMPLES).sort()).toEqual(FEATURE_PATH_RULES.map((rule) => rule.id).sort());
        for (const rule of FEATURE_PATH_RULES) {
            expect(matchFeaturePath(SAMPLES[rule.id])?.id).toBe(rule.id);
        }
    });

    it('rejects unknown paths', () => {
        for (const path of ['d1.planets.Sun.speed', 'd1.planets.Pluto.lon', 'd99.planets.Sun.lon', 'd61.planets.Sun.lon', 'd0.planets.Sun.lon', 'd01.planets.Sun.lon', 'dasa.vimshottari.lord', 'dasa.vimshottari[0][1][2][3][4][5][6].end', 'dasa.unknown[0].lord', 'dasa.vimshottari[0].middle', 'D1.planets.Sun.lon']) {
            expect(matchFeaturePath(path)).toBeUndefined();
            const parsed = GoldenCaseSchema.safeParse(makeCase({
                'd1.planets.Sun.lon': { value: 1, tolerance: { type: 'arcsec', arcsec: 1 } },
                [path]: { value: 1, tolerance: { type: 'exact' } },
            }));
            expect(parsed.success).toBe(false);
            if (!parsed.success) {
                expect(parsed.error.issues.some((issue) => issue.message.includes('Unknown feature path'))).toBe(true);
            }
        }
    });

    it('accepts every varga from D1 to D60 and nested dasa periods', () => {
        for (let n = 1; n <= 60; n += 1) {
            expect(matchFeaturePath(`d${n}.planets.Sun.lon`)?.id).toBe('varga-planet-angle');
        }
        expect(matchFeaturePath('dasa.vimshottari[2][4].lord')?.id).toBe('dasa-lord');
        expect(matchFeaturePath('dasa.vimshottari[0][1][2][3][4][5].end')?.id).toBe('dasa-bound');
    });
});

describe('GoldenCaseSchema', () => {
    it('accepts the documented path shapes', () => {
        const expected: GoldenCase['expected'] = {};
        for (const rule of FEATURE_PATH_RULES) expected[SAMPLES[rule.id]] = entryFor(rule);
        expect(GoldenCaseSchema.parse(makeCase(expected)).id).toBe('sample-case');
    });

    it('rejects a tolerance kind that does not match the path', () => {
        const parsed = GoldenCaseSchema.safeParse(makeCase({
            'd1.planets.Sun.lon': { value: 10, tolerance: { type: 'exact' } },
        }));
        expect(parsed.success).toBe(false);
        const start = GoldenCaseSchema.safeParse(makeCase({
            'dasa.vimshottari[0].start': { value: '2000-01-01T00:00:00Z', tolerance: { type: 'arcsec', arcsec: 1 } },
        }));
        expect(start.success).toBe(false);
    });

    it('rejects a value of the wrong kind and a sign outside 1..12', () => {
        expect(GoldenCaseSchema.safeParse(makeCase({
            'd1.planets.Saturn.retrograde': { value: 1, tolerance: { type: 'exact' } },
        })).success).toBe(false);
        expect(GoldenCaseSchema.safeParse(makeCase({
            'd1.ascendant.sign': { value: 13, tolerance: { type: 'exact' } },
        })).success).toBe(false);
    });

    it('rejects a settings hash, time zone, or instant that does not match', () => {
        const base = makeCase({ 'time.jd': { value: 2451545, tolerance: { type: 'exact' } } });
        expect(GoldenCaseSchema.safeParse({ ...base, input: { ...base.input, settingsHash: 'a'.repeat(64) } }).success).toBe(false);
        expect(GoldenCaseSchema.safeParse({ ...base, input: { ...base.input, timezone: 'Not/AZone' } }).success).toBe(false);
        expect(GoldenCaseSchema.safeParse({ ...base, input: { ...base.input, instant: '1998-13-01T00:00:00Z' } }).success).toBe(false);
        expect(GoldenCaseSchema.safeParse({ ...base, input: { ...base.input, lat: 91 } }).success).toBe(false);
        expect(GoldenCaseSchema.safeParse({ ...base, expected: {} }).success).toBe(false);
        expect(GoldenCaseSchema.safeParse({ ...base, extra: true }).success).toBe(false);
    });
});

describe('JSON Schema', () => {
    it('is generated from the Zod schemas and the path registry', () => {
        const text = formatJsonSchema();
        if (process.env.WRITE_GOLDENS === '1') {
            mkdirSync(dirname(schemaPath), { recursive: true });
            writeFileSync(schemaPath, text);
        }
        expect(readFileSync(schemaPath, 'utf8')).toBe(text);
        const json = JSON.parse(text) as {
            additionalProperties: boolean;
            properties: { expected: { additionalProperties: boolean; patternProperties: Record<string, unknown> } };
        };
        expect(json.additionalProperties).toBe(false);
        expect(json.properties.expected.additionalProperties).toBe(false);
        const patterns = Object.keys(json.properties.expected.patternProperties).sort();
        expect(patterns).toEqual(FEATURE_PATH_RULES.map((rule) => `^(?:${rule.pattern})$`).sort());
    });
});
