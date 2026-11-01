#!/usr/bin/env node
/**
 * Prepend the standard copyright line to library TypeScript under packages when missing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const HEADER =
    '// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.\n\n';

const files = execSync("git ls-files 'packages/*/src/**/*.ts' ':!:**/*.d.ts'", {
    cwd: root,
    encoding: 'utf8',
})
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((rel) => !rel.includes('/generated/'));

let updated = 0;
for (const rel of files) {
    const path = join(root, rel);
    const text = readFileSync(path, 'utf8');
    if (text.startsWith('// Copyright (c)')) continue;
    writeFileSync(path, HEADER + text);
    updated++;
}
console.log(`Updated ${updated} file(s).`);
