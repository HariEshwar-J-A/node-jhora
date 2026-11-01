#!/usr/bin/env node
/**
 * Fail when any package LICENSE file differs from the repository root LICENSE.
 */
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const canonical = readFileSync(join(root, 'LICENSE'), 'utf8');
const problems = [];

for (const dir of readdirSync(join(root, 'packages')).sort()) {
    const path = join(root, 'packages', dir, 'LICENSE');
    try {
        const text = readFileSync(path, 'utf8');
        if (text !== canonical) {
            problems.push(`packages/${dir}/LICENSE differs from root LICENSE`);
        }
    } catch {
        /* packages without LICENSE (data-only) are ok */
    }
}

if (problems.length) {
    console.error('check-license-sync failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
}
console.log('check-license-sync: all packages/*/LICENSE match root LICENSE');
