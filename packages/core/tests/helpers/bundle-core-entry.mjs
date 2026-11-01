/**
 * esbuild bundle helper — matches scripts/check-core-subpath-bundles.mjs and
 * scripts/check-browser-bundle-size.mjs (tree-shaking, minify, Node stubs).
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** @param {string} s */
function escapeRegExpLiteral(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const nodeStubPlugin = {
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
            build.onResolve({ filter: new RegExp(`^${escapeRegExpLiteral(id)}$`) }, () => ({
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

/** @typedef {{ entry: string, external?: string[], extraPlugins?: import('esbuild').Plugin[] }} BundleOptions */

/**
 * @param {BundleOptions} opts
 * @returns {Promise<{ js: Uint8Array, path: string }>}
 */
export async function bundleCoreEntry(opts) {
    const result = await build({
        entryPoints: [opts.entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        sourcemap: false,
        minify: true,
        treeShaking: true,
        external: opts.external ?? [],
        plugins: [nodeStubPlugin, ...(opts.extraPlugins ?? [])],
        logLevel: 'silent',
    });
    return { js: result.outputFiles[0].contents, path: opts.entry };
}

export function readCorePackageSideEffects() {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/core/package.json'), 'utf8'));
    return pkg.sideEffects;
}
