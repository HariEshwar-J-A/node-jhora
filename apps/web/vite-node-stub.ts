import type { Plugin } from 'vite';

/** @param {string} s */
function escapeRegExpLiteral(s: string) {
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

const STUB_BODY = `
export function existsSync(){return false;}
export async function readFile(){throw new Error('no fs in browser');}
export function join(...p){return p.join('/');}
export function dirname(){return '';}
export function createRequire(){return {resolve(){throw new Error('no require in browser');}};}
export default {};
`;

/** Stub Node built-ins so core chunk-loader dynamic imports resolve at build time. */
export function nodeStubPlugin(): Plugin {
    return {
        name: 'node-jhora-node-stub',
        enforce: 'pre',
        resolveId(id) {
            if (id === 'spk-node.js' || id.endsWith('/spk-node.js')) {
                return '\0njh-spk-node-stub';
            }
            if (NODE_STUB_IDS.includes(id)) {
                return `\0njh-node-stub:${id}`;
            }
            return undefined;
        },
        load(id) {
            if (id === '\0njh-spk-node-stub') {
                return `export function loadSpk(){throw new Error('spk-node unavailable in browser');}`;
            }
            if (id.startsWith('\0njh-node-stub:')) {
                return STUB_BODY;
            }
            return undefined;
        },
    };
}

/** Prevent Vite from externalizing node: imports in the worker bundle. */
export function forceNodeShimsPlugin(): Plugin {
    return {
        name: 'force-node-shims',
        enforce: 'pre',
        resolveId(source, importer, options) {
            if (!NODE_STUB_IDS.includes(source)) return undefined;
            if (options?.custom?.vite?.ssr) return undefined;
            return `\0njh-node-stub:${source}`;
        },
    };
}
