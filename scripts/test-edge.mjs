#!/usr/bin/env node
/**
 * PR5 edge runtime gate: workerd smoke (preferred) or Playwright browser-harness fallback.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
        ...opts,
    });
    return r.status ?? 1;
}

if (!existsSync(join(root, 'packages/core/dist/index.js'))) {
    console.error('test:edge requires pnpm build first');
    process.exit(1);
}

console.log('=== test:edge (workerd) ===');
const workerdStatus = run(process.execPath, ['tools/workerd/bench-sun-smoke.mjs']);
if (workerdStatus === 0) {
    process.exit(0);
}

console.error('\n=== test:edge (workerd failed) — trying Playwright browser-harness ===');
const pw = run('pnpm', [
    '--filter',
    '@node-jhora/browser-harness',
    'exec',
    'playwright',
    'test',
    'tests/edge-kernel-sun-hex.spec.ts',
    '--project=chromium',
]);
process.exit(pw);
