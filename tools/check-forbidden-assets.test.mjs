/**
 * Unit tests for the clean-room asset guard.
 *   node --test tools/check-forbidden-assets.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedJhd, scan } from './check-forbidden-assets.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function withTree(files, fn) {
    const root = mkdtempSync(join(tmpdir(), 'clean-room-'));
    try {
        for (const [rel, body] of Object.entries(files)) {
            const abs = join(root, rel);
            mkdirSync(dirname(abs), { recursive: true });
            writeFileSync(abs, body);
        }
        fn(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function rules(root) {
    return scan(root).map((finding) => `${finding.rule}:${finding.path}`);
}

test('jhd allowlist is only the fixture directories', () => {
    assert.equal(isAllowedJhd('packages/core/tests/fixtures/chennai.jhd'), true);
    assert.equal(isAllowedJhd('packages/core/tests/io/fixtures/nested.jhd'), true);
    assert.equal(isAllowedJhd('test-fixtures/legacy/chart.jhd'), true);
    assert.equal(isAllowedJhd('data/chart.jhd'), false);
    assert.equal(isAllowedJhd('packages/core/src/chart.jhd'), false);
    assert.equal(isAllowedJhd('packages/core/tests/chart.jhd'), false);
});

test('a plain source tree is clean', () => {
    withTree({ 'packages/core/src/math.ts': 'export const x = 1;\n' }, (root) => {
        assert.deepEqual(scan(root), []);
    });
});

test('forbidden asset extensions fail anywhere, including fixture dirs', () => {
    const files = {};
    for (const ext of ['.chm', '.hlp', '.ico', '.bmp', '.exe', '.dll']) {
        files[`drop/file${ext}`] = '';
    }
    files['packages/core/tests/fixtures/icon.ico'] = '';
    withTree(files, (root) => {
        const found = scan(root);
        assert.equal(found.length, 7);
        assert.ok(found.every((finding) => finding.rule === 'forbidden-extension'));
    });
});

test('jhd files pass only under an allowlisted fixture path', () => {
    withTree({
        'data/from-install.jhd': '1\n',
        'packages/core/tests/fixtures/oracle.jhd': '1\n',
        'test-fixtures/batch/oracle.jhd': '1\n',
    }, (root) => {
        assert.deepEqual(rules(root), ['jhd-outside-fixtures:data/from-install.jhd']);
    });
});

test('decompiler markers fail in source and are ignored in exempt policy files', () => {
    withTree({
        'packages/core/src/leaked.ts': '/* Decompiled by JD-GUI */\nlet undefined4 = 1;\n',
        'notes/ghidra.md': 'Opened in Ghidra.\n',
        'docs/CLEAN_ROOM.md': 'markers: Decompiled by, Ghidra, undefined4\n',
        'docs/decisions/0002-clean-room-policy.md': 'Ghidra\n',
        'tools/check-forbidden-assets.mjs': 'Ghidra\n',
    }, (root) => {
        const found = rules(root);
        assert.ok(found.includes('decompiler-marker:packages/core/src/leaked.ts'));
        assert.ok(found.includes('decompiler-marker:notes/ghidra.md'));
        assert.equal(found.some((line) => line.includes('CLEAN_ROOM')), false);
        assert.equal(found.some((line) => line.includes('0002-clean-room-policy')), false);
        assert.equal(found.some((line) => line.includes('check-forbidden-assets.mjs')), false);
    });
});

test('node_modules and dist are not scanned', () => {
    withTree({
        'node_modules/pkg/tool.exe': '',
        'dist/out.dll': '',
        'src/ok.ts': 'export {}\n',
    }, (root) => {
        assert.deepEqual(scan(root), []);
    });
});

test('the repository itself is clean', () => {
    const findings = scan(repoRoot);
    assert.deepEqual(findings, [], JSON.stringify(findings, null, 2));
});
