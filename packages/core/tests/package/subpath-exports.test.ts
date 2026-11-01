import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evalCheby } from '@node-jhora/core/chebyshev';
import { calculateVarga } from '@node-jhora/core/vargas';

const pkgDir = fileURLToPath(new URL('../..', import.meta.url));

describe('@node-jhora/core subpath exports', () => {
    test('chebyshev entry resolves and evaluates', () => {
        expect(evalCheby([1, 2, 3], 0.5)).toBe(0.5);
    });

    test('vargas entry resolves (D9 smoke)', () => {
        const p = calculateVarga(120, 9);
        expect(p.sign).toBeGreaterThanOrEqual(1);
        expect(p.sign).toBeLessThanOrEqual(12);
    });

    test('package.json declares chebyshev and vargas export keys', () => {
        const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8')) as {
            exports: Record<string, unknown>;
        };
        expect(pkg.exports['./chebyshev']).toBeDefined();
        expect(pkg.exports['./vargas']).toBeDefined();
    });

    test('package.json lists sideEffects entry points explicitly (not false)', () => {
        const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8')) as {
            sideEffects: unknown;
        };
        expect(Array.isArray(pkg.sideEffects)).toBe(true);
        expect(pkg.sideEffects).toContain('./dist/index.js');
    });

    test('root entry has no require condition (ESM-only)', () => {
        const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8')) as {
            exports: { '.': { import?: string; require?: string } };
        };
        expect(pkg.exports['.'].import).toBeDefined();
        expect(pkg.exports['.'].require).toBeUndefined();
    });
});
