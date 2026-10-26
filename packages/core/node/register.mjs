/**
 * Node.js: register a filesystem BSP loader for EphemerisEngine.initialize().
 * Import once before the first initialize() (API startup, Jest setup).
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

function resolveBspPath() {
    if (process.env.NODE_JHORA_EPHE_PATH) {
        return process.env.NODE_JHORA_EPHE_PATH;
    }

    try {
        const pkgJson = require.resolve('@node-jhora/ephe/package.json');
        const candidate = join(dirname(pkgJson), 'de440s.bsp');
        if (existsSync(candidate)) return candidate;
    } catch {
        /* package not installed */
    }

    const devCandidate = fileURLToPath(new URL('../../../de440s.bsp', import.meta.url));
    if (existsSync(devCandidate)) return devCandidate;

    throw new Error(
        'EphemerisEngine: de440s.bsp not found.\n' +
            '  Install the data package:  pnpm add @node-jhora/ephe\n' +
            '  Or set:  NODE_JHORA_EPHE_PATH=/path/to/de440s.bsp',
    );
}

/**
 * @param {import('../dist/engine/bsp-bytes-provider.js').setBspBytesLoader} setBspBytesLoader
 */
export function registerNodeBspLoader(setBspBytesLoader) {
    setBspBytesLoader(async () => new Uint8Array(readFileSync(resolveBspPath())));
}

/** Self-registering import for Node apps (uses built dist provider). */
export async function registerNodeBspLoaderFromCore() {
    const { setBspBytesLoader } = await import('../dist/engine/bsp-bytes-provider.js');
    registerNodeBspLoader(setBspBytesLoader);
}
