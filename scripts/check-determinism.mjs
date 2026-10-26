#!/usr/bin/env node
/**
 * Run the determinism corpus under UTC, Asia/Kolkata TZ, and Turkish locale;
 * require identical canonical JSON hashes.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const corpusScript = join(root, 'tools/determinism-corpus.mjs');
const node = process.execPath;

const VARIANTS = [
    { name: 'TZ=UTC', env: { TZ: 'UTC', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } },
    { name: 'TZ=Asia/Kolkata', env: { TZ: 'Asia/Kolkata', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } },
    { name: 'LANG=tr_TR', env: { TZ: 'UTC', LANG: 'tr_TR', LC_ALL: 'tr_TR' } },
];

function runVariant(name, extraEnv) {
    const result = spawnSync(node, [corpusScript], {
        cwd: root,
        env: { ...process.env, ...extraEnv },
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
    });
    if (result.status !== 0) {
        console.error(result.stderr || result.stdout);
        throw new Error(`${name}: corpus exited ${result.status ?? 'with signal'}`);
    }
    const line = result.stdout.trim().split('\n').pop();
    return JSON.parse(line);
}

const baseline = runVariant(VARIANTS[0].name, VARIANTS[0].env);
let failed = false;

for (let i = 1; i < VARIANTS.length; i++) {
    const variant = VARIANTS[i];
    const hashes = runVariant(variant.name, variant.env);
    for (const id of Object.keys(baseline)) {
        if (hashes[id] !== baseline[id]) {
            console.error(
                `determinism mismatch for ${id} under ${variant.name}:\n` +
                    `  baseline: ${baseline[id]}\n` +
                    `  variant:  ${hashes[id]}`,
            );
            failed = true;
        }
    }
    const extra = Object.keys(hashes).filter((id) => !(id in baseline));
    if (extra.length > 0) {
        console.error(`unexpected case ids under ${variant.name}: ${extra.join(', ')}`);
        failed = true;
    }
}

if (failed) {
    process.exit(1);
}

console.log(
    `check:determinism ok (${Object.keys(baseline).length} cases, ${VARIANTS.length} environments)`,
);
