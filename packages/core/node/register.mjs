/**
 * Node.js: register a filesystem BSP loader for EphemerisEngine.initialize().
 * Import once before the first initialize() (API startup, Jest setup).
 *
 * The kernel is found by resolveDe440sPath() in ./ephemeris.mjs:
 * NODE_JHORA_EPHE_PATH → installed @node-jhora/ephe → user cache →
 * verified download from JPL into the cache (skipped when NODE_JHORA_OFFLINE=1).
 */

import { readFileSync } from 'node:fs';

import { resolveDe440sPath } from './ephemeris.mjs';

/**
 * @param {import('../dist/engine/bsp-bytes-provider.js').setBspBytesLoader} setBspBytesLoader
 * @param {Parameters<typeof resolveDe440sPath>[0]} [options]
 */
export function registerNodeBspLoader(setBspBytesLoader, options) {
    setBspBytesLoader(async () => new Uint8Array(readFileSync(await resolveDe440sPath(options))));
}

/** Self-registering import for Node apps (uses built dist provider). */
export async function registerNodeBspLoaderFromCore(options) {
    const { setBspBytesLoader } = await import('../dist/engine/bsp-bytes-provider.js');
    registerNodeBspLoader(setBspBytesLoader, options);
}
