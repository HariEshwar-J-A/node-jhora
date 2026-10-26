#!/usr/bin/env node
/**
 * Ensures @node-jhora/core browser entry stays under the gzipped budget (excl. ephemeris).
 */
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'packages/core/src/browser/index.ts');
const MAX_GZIP_BYTES = 150 * 1024;

const nodeStubPlugin = {
    name: 'node-stub',
    setup(build) {
        build.onResolve({ filter: /spk-node\.js$/ }, () => ({
            path: 'spk-node-stub',
            namespace: 'njh-stub',
        }));
        build.onLoad({ filter: /.*/, namespace: 'njh-stub' }, () => ({
            contents:
                'export function loadSpk(){throw new Error("spk-node unavailable in browser bundle");}',
            loader: 'js',
        }));
        for (const id of [
            'fs',
            'path',
            'module',
            'node:fs',
            'node:path',
            'node:module',
            'fs/promises',
            'node:fs/promises',
        ]) {
            build.onResolve({ filter: new RegExp(`^${id.replace(':', ':')}$`) }, () => ({
                path: id,
                namespace: 'njh-node',
            }));
        }
        build.onLoad({ filter: /.*/, namespace: 'njh-node' }, () => ({
            contents: `
                export function existsSync(){return false;}
                export async function readFile(){throw new Error('no fs in browser');}
                export function join(...p){return p.join('/');}
                export function dirname(){return '';}
                export function createRequire(){return {resolve(){throw new Error('no require in browser');}};}
            `,
            loader: 'js',
        }));
    },
};

const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    sourcemap: false,
    minify: true,
    external: ['luxon', 'decimal.js', 'zod'],
    plugins: [nodeStubPlugin],
    logLevel: 'silent',
});

const js = result.outputFiles[0].contents;
const gz = gzipSync(js);
const gzipKb = (gz.length / 1024).toFixed(1);

console.log(
    `@node-jhora/core/browser bundle: ${(js.length / 1024).toFixed(1)} KiB raw, ${gzipKb} KiB gzip (budget ${MAX_GZIP_BYTES / 1024} KiB)`,
);

if (gz.length > MAX_GZIP_BYTES) {
    console.error(
        `Bundle exceeds ${MAX_GZIP_BYTES} byte gzip budget by ${gz.length - MAX_GZIP_BYTES} bytes`,
    );
    process.exit(1);
}
