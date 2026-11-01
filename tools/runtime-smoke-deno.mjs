/**
 * Deno import smoke (see docs/getting-started/deno.md).
 *
 * Run: deno run --allow-read --allow-env tools/runtime-smoke-deno.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreDir = join(root, 'packages/core');

/** @param {string} message @param {unknown} [cause] */
function fail(message, cause) {
    console.error(`runtime-smoke-deno: ${message}`);
    if (cause !== undefined) {
        if (cause instanceof Error && cause.stack) console.error(cause.stack);
        else console.error(cause);
    }
    if (typeof Deno !== 'undefined') Deno.exit(1);
    process.exit(1);
}

if (typeof Deno === 'undefined') {
    fail('run with Deno: deno run --allow-read --allow-env tools/runtime-smoke-deno.mjs');
}

if (!existsSync(join(coreDir, 'dist/index.js'))) {
    fail('run pnpm build first (missing packages/core/dist/index.js)');
}

const epheBsp =
    Deno.env.get('NODE_JHORA_EPHE_PATH') ?? join(root, 'node_modules/@node-jhora/ephe/de440s.bsp');

if (!existsSync(epheBsp)) {
    fail(`ephemeris kernel not found at ${epheBsp} (run pnpm install or set NODE_JHORA_EPHE_PATH)`);
}

Deno.env.set('NODE_JHORA_EPHE_PATH', epheBsp);

try {
    const registerUrl = new URL('../packages/core/node/register.mjs', import.meta.url).href;
    const coreIndexUrl = new URL('../packages/core/dist/index.js', import.meta.url).href;
    const inputUrl = new URL('../packages/core/dist/validation/input.js', import.meta.url).href;

    const { registerNodeBspLoaderFromCore } = await import(registerUrl);
    await registerNodeBspLoaderFromCore();

    const { EphemerisEngine } = await import(coreIndexUrl);
    const { parseEngineDateTimeOrJsDate } = await import(inputUrl);

    const eph = EphemerisEngine.getInstance();
    await eph.initialize();
    const when = parseEngineDateTimeOrJsDate(new Date('2000-01-01T12:00:00.000Z'));
    const n = eph.getPlanets(when, { latitude: 13.0827, longitude: 80.2707 }).length;
    if (typeof n !== 'number' || n < 7) {
        throw new Error(`unexpected planet count: ${n}`);
    }
    console.log(`runtime-smoke-deno: ok, planets=${n}`);
} catch (cause) {
    fail('smoke test failed', cause);
}
