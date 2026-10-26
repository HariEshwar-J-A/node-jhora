/**
 * Unit tests for the data-provenance guard.
 *   node --test tools/check-data-provenance.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFile, isEnforced, numericArrays, scan } from './check-data-provenance.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const table = (n) => `[${Array.from({ length: n }, (_, i) => i + 0.5).join(', ')}]`;

test('a numeric table without @provenance is flagged', () => {
    assert.equal(checkFile(`const T = ${table(20)};\n`).length, 1);
});

test('an @provenance comment above the table satisfies the rule', () => {
    assert.deepEqual(
        checkFile(`/** @provenance Meeus Table 22.A */\nconst T = ${table(20)};\n`),
        [],
    );
});

test('nested rows count toward the outer table', () => {
    const src = `const T = [\n${Array.from({ length: 6 }, () => '  [1, 2, 3],').join('\n')}\n];\n`;
    assert.equal(numericArrays(src).length, 1);
    assert.equal(numericArrays(src)[0].count, 18);
});

test('object-literal tables are flagged too', () => {
    const body = Array.from({ length: 13 }, (_, i) => `k${i}: ${i}.25`).join(', ');
    assert.equal(checkFile(`export const T = { ${body} };\n`).length, 1);
});

test('index expressions and small arrays are ignored', () => {
    assert.deepEqual(
        checkFile(
            'const x = m[0][1] + m[1][2] + m[2][0] + m[0][0] + m[1][1] + m[2][2] + a[3] + a[4] + a[5] + a[6] + a[7] + a[8];\n',
        ),
        [],
    );
    assert.deepEqual(checkFile('const v = [1, 2, 3];\n'), []);
});

test('numbers inside comments and strings do not count', () => {
    assert.deepEqual(checkFile(`const s = ['${table(20)}'];\n// ${table(30)}\n`), []);
});

test('only core engine source is enforced by default', () => {
    assert.equal(isEnforced('packages/core/src/engine/nutation.ts'), true);
    assert.equal(isEnforced('packages/match/src/kuta/data.ts'), false);
});

test('the repository engine source passes', () => {
    assert.deepEqual(
        scan(repoRoot).filter((f) => isEnforced(f.path)),
        [],
    );
});
