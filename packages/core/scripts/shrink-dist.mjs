#!/usr/bin/env node
/** Minify published JS under dist/ to stay within the core pack budget (ADR 0006). */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));
const dist = join(pkgDir, 'dist');

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
    const source = readFileSync(file, 'utf8');
    const { code } = transformSync(source, {
        minifyWhitespace: true,
        minifySyntax: true,
        loader: 'js',
    });
    writeFileSync(file, code);
}
