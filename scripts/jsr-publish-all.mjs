#!/usr/bin/env node
/**
 * Publish all JSR packages (upstream release workflow only).
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSR_PUBLISHABLE } from './jsr-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

for (const dir of JSR_PUBLISHABLE) {
    const cwd = join(root, 'packages', dir);
    console.log(`\n=== jsr publish: @node-jhora/${dir} ===\n`);
    const r = spawnSync('npx', ['--yes', 'jsr@latest', 'publish'], {
        cwd,
        stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('\njsr-publish-all: done');
