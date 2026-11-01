#!/usr/bin/env node
/**
 * Prepend the standard copyright line to library TypeScript under packages when missing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPackageSrcTsFiles } from './git-package-src-files.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const HEADER =
    '// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.\n\n';

const files = listPackageSrcTsFiles(root).filter((rel) => !rel.includes('/generated/'));

let updated = 0;
for (const rel of files) {
    const path = join(root, rel);
    const text = readFileSync(path, 'utf8');
    if (text.startsWith('// Copyright (c)')) continue;
    writeFileSync(path, HEADER + text);
    updated++;
}
console.log(`Updated ${updated} file(s).`);
