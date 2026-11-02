#!/usr/bin/env node
/**
 * Publish all JSR packages (upstream release workflow only).
 */
import { spawnCliSync } from '../tools/spawn-cli.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSR_PUBLISHABLE } from './jsr-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Per-package extra flags. format's public API exports zod schemas whose
 * inferred types JSR treats as slow types; publishing still works, only
 * JSR's .d.ts generation and score are affected.
 */
const EXTRA_ARGS = { format: ['--allow-slow-types'] };

for (const dir of JSR_PUBLISHABLE) {
    const cwd = join(root, 'packages', dir);
    console.log(`\n=== jsr publish: @node-jhora/${dir} ===\n`);
    const r = spawnCliSync('npx', ['--yes', 'jsr@latest', 'publish', ...(EXTRA_ARGS[dir] ?? [])], {
        cwd,
        stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('\njsr-publish-all: done');
