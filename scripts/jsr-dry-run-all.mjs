#!/usr/bin/env node
/**
 * Run `jsr publish --dry-run` for every JSR publish package; print a summary.
 */
import { spawnCliSync } from '../tools/spawn-cli.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSR_PUBLISHABLE } from './jsr-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const results = [];

for (const dir of JSR_PUBLISHABLE) {
    const cwd = join(root, 'packages', dir);
    const slowTypesFlag = dir === 'format' ? ['--allow-slow-types'] : [];
    console.log(`\n=== jsr dry-run: @node-jhora/${dir} ===\n`);
    const r = spawnCliSync(
        'npx',
        ['--yes', 'jsr@latest', 'publish', '--dry-run', '--allow-dirty', ...slowTypesFlag],
        {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    if (out.trim()) process.stdout.write(out);
    results.push({ dir, ok: r.status === 0, status: r.status ?? 1 });
}

console.log('\n=== jsr dry-run summary ===');
for (const { dir, ok, status } of results) {
    console.log(`  @node-jhora/${dir}: ${ok ? 'OK' : `FAILED (exit ${status})`}`);
}

if (results.some((r) => !r.ok)) process.exit(1);
