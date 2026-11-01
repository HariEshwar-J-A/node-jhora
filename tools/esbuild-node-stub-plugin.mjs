/** Shared esbuild plugin: stub Node built-ins for browser bundle checks. */

/** @param {string} s */
function escapeRegExpLiteral(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NODE_STUB_IDS = [
    'fs',
    'path',
    'module',
    'node:fs',
    'node:path',
    'node:module',
    'fs/promises',
    'node:fs/promises',
];

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
        for (const id of NODE_STUB_IDS) {
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
