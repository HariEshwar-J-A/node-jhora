#!/usr/bin/env node
/**
 * Fail when jsr.json version drifts from package.json for JSR publish packages.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSR_PUBLISHABLE } from '../scripts/jsr-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const problems = [];

for (const dir of JSR_PUBLISHABLE) {
    const pkgDir = join(root, 'packages', dir);
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const jsrPath = join(pkgDir, 'jsr.json');
    let jsr;
    try {
        jsr = JSON.parse(readFileSync(jsrPath, 'utf8'));
    } catch {
        problems.push(`packages/${dir}: missing jsr.json`);
        continue;
    }
    if (jsr.version !== pkg.version) {
        problems.push(
            `packages/${dir}: jsr.json version ${jsr.version} != package.json ${pkg.version} (run pnpm jsr:sync-versions)`,
        );
    }
}

if (problems.length) {
    console.error('check-jsr-versions failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
}
console.log('check-jsr-versions: all JSR package versions match package.json');
