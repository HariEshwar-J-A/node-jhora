import {
    DELTA_T_MODEL,
    EPHEMERIS_PROVIDER,
    createResultEnvelope,
    withResultEnvelope,
} from '../src/envelope.js';
import { ENGINE_VERSION, TZDB_VERSION } from '../src/generated/build-constants.js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('generated build constants', () => {
    test('match package.json and the installed luxon (not stale)', () => {
        const pkg = JSON.parse(readFileSync(join(coreRoot, 'package.json'), 'utf8'));
        const luxonPkg = createRequire(join(coreRoot, 'package.json')).resolve('luxon/package.json');
        const luxon = JSON.parse(readFileSync(luxonPkg, 'utf8'));
        expect(ENGINE_VERSION).toBe(pkg.version);
        expect(TZDB_VERSION).toBe(`luxon-${luxon.version}`);
    });

    test('the generated module has no imports (browser-safe constants only)', () => {
        const src = readFileSync(join(coreRoot, 'src/generated/build-constants.ts'), 'utf8');
        expect(src).not.toMatch(/\bimport\b|\brequire\(|process\.|node:/);
    });
});

describe('result envelope', () => {
    test('createResultEnvelope carries stable provenance fields', () => {
        const hash = 'abc123def456';
        const envelope = createResultEnvelope({ settingsHash: hash });

        expect(envelope.engineVersion).toBe(ENGINE_VERSION);
        expect(envelope.settingsHash).toBe(hash);
        expect(envelope.ephemerisProvider).toBe(EPHEMERIS_PROVIDER);
        expect(envelope.tzdbVersion).toBe(TZDB_VERSION);
        expect(envelope.deltaTModel).toBe(DELTA_T_MODEL);
        expect(envelope.warnings).toEqual([]);
        expect(envelope.computedAt).toBeUndefined();
    });

    test('omitting computedAt keeps serialisation deterministic', () => {
        const a = createResultEnvelope({ settingsHash: 'same' });
        const b = createResultEnvelope({ settingsHash: 'same' });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test('computedAt is included only when provided', () => {
        const stamped = createResultEnvelope({
            settingsHash: 'x',
            computedAt: '2026-01-01T00:00:00.000Z',
        });
        expect(stamped.computedAt).toBe('2026-01-01T00:00:00.000Z');

        const plain = createResultEnvelope({ settingsHash: 'x' });
        expect('computedAt' in plain).toBe(false);
    });

    test('withResultEnvelope merges additively and preserves payload fields', () => {
        const payload = { planets: [{ id: 0 }], settingsHash: 'deadbeef' };
        const merged = withResultEnvelope(payload);

        expect(merged.planets).toEqual(payload.planets);
        expect(merged.engineVersion).toBe(ENGINE_VERSION);
        expect(merged.settingsHash).toBe('deadbeef');
        expect(merged.warnings).toEqual([]);
    });

    test('withResultEnvelope supports paired settings hashes (match)', () => {
        const pair = { person1: 'aaa', person2: 'bbb' };
        const merged = withResultEnvelope({ score: 28, settingsHash: pair });
        expect(merged.settingsHash).toEqual(pair);
        expect(merged.engineVersion).toBe(ENGINE_VERSION);
    });

    test('warnings are copied when provided', () => {
        const envelope = createResultEnvelope({
            settingsHash: 'h',
            warnings: ['nominal sunrise hour in use'],
        });
        expect(envelope.warnings).toEqual(['nominal sunrise hour in use']);
    });
});
