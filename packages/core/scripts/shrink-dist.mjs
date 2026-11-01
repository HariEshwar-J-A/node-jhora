#!/usr/bin/env node
/** Minify published JS under dist/ to stay within the core pack budget (ADR 0006). */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));
const dist = join(pkgDir, 'dist');
const esbuild = join(pkgDir, '../../node_modules/.bin/esbuild');

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (name.endsWith('.js') && !name.endsWith('.test.js')) out.push(p);
    }
    return out;
}

for (const file of walk(dist)) {
    execFileSync(
        esbuild,
        [file, '--allow-overwrite', '--minify-whitespace', '--minify-syntax', '--outfile=' + file],
        { stdio: 'inherit' },
    );
}
