#!/usr/bin/env node
/**
 * Copy each publishable package's package.json version into jsr.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSR_PUBLISHABLE } from '../scripts/jsr-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

for (const dir of JSR_PUBLISHABLE) {
    const pkgDir = join(root, 'packages', dir);
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const jsrPath = join(pkgDir, 'jsr.json');
    const jsr = JSON.parse(readFileSync(jsrPath, 'utf8'));
    if (jsr.version === pkg.version) continue;
    jsr.version = pkg.version;
    writeFileSync(jsrPath, `${JSON.stringify(jsr, null, 4)}\n`, 'utf8');
    console.log(`sync-jsr-versions: ${pkg.name} → ${pkg.version}`);
}

console.log('sync-jsr-versions: done');
