#!/usr/bin/env node
/**
 * Verify SPDX-style copyright header on library TypeScript sources.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPackageSrcTsFiles } from './git-package-src-files.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const HEADER = '// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.';

const files = listPackageSrcTsFiles(root).filter((rel) => !rel.includes('/generated/'));

let failed = 0;
for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    if (!text.startsWith(HEADER)) {
        console.error(`missing copyright header: ${rel}`);
        failed++;
    }
}
if (failed > 0) {
    console.error(`\n${failed} file(s) missing header. Run: node tools/add-source-copyright.mjs`);
    process.exit(1);
}
