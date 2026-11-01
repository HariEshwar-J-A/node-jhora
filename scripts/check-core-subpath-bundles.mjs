#!/usr/bin/env node
/**
 * Gzip budgets for @node-jhora/core subpath entry points (server-grade PR6).
 */
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeStubPlugin } from '../tools/esbuild-node-stub-plugin.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CASES = [
    {
        label: '@node-jhora/core/chebyshev',
        entry: join(ROOT, 'packages/core/src/engine/chebyshev.ts'),
        maxGzipBytes: 2 * 1024,
        external: [],
    },
    {
        label: '@node-jhora/core/vargas',
        entry: join(ROOT, 'packages/core/src/vedic/vargas.ts'),
        maxGzipBytes: 8 * 1024,
        external: ['decimal.js'],
    },
];

let failed = false;

for (const c of CASES) {
    const result = await build({
        entryPoints: [c.entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        sourcemap: false,
        minify: true,
        external: c.external,
        plugins: [nodeStubPlugin],
        logLevel: 'silent',
    });

    const js = result.outputFiles[0].contents;
    const gz = gzipSync(js);
    const gzipKb = (gz.length / 1024).toFixed(2);
    console.log(
        `${c.label}: ${(js.length / 1024).toFixed(1)} KiB raw, ${gzipKb} KiB gzip (budget ${(c.maxGzipBytes / 1024).toFixed(0)} KiB)`,
    );

    if (gz.length > c.maxGzipBytes) {
        console.error(`${c.label} exceeds gzip budget by ${gz.length - c.maxGzipBytes} bytes`);
        failed = true;
    }
}

if (failed) {
    process.exit(1);
}
