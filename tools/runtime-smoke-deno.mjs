#!/usr/bin/env node
/**
 * Deno import smoke wrapper (see docs/getting-started/deno.md).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const coreDir = join(root, 'packages/core');

if (!existsSync(join(coreDir, 'dist/index.js'))) {
    console.error('runtime-smoke-deno: run pnpm build first');
    process.exit(1);
}

const epheBsp =
    process.env.NODE_JHORA_EPHE_PATH ??
    join(require.resolve('@node-jhora/ephe/package.json'), '..', 'de440s.bsp');

import { pathToFileURL } from 'node:url';

const registerUrl = pathToFileURL(join(coreDir, 'node/register.mjs')).href;
const coreIndexUrl = pathToFileURL(join(coreDir, 'dist/index.js')).href;
const inputUrl = pathToFileURL(join(coreDir, 'dist/validation/input.js')).href;

const script = `
import { registerNodeBspLoaderFromCore } from ${JSON.stringify(registerUrl)};
await registerNodeBspLoaderFromCore();
import { EphemerisEngine } from ${JSON.stringify(coreIndexUrl)};
import { parseEngineDateTimeOrJsDate } from ${JSON.stringify(inputUrl)};
const eph = EphemerisEngine.getInstance();
await eph.initialize();
const when = parseEngineDateTimeOrJsDate(new Date('2000-01-01T12:00:00.000Z'));
const n = eph.getPlanets(when, { latitude: 13.0827, longitude: 80.2707 }).length;
if (typeof n !== 'number' || n < 7) throw new Error('unexpected planet count: ' + n);
console.log('runtime-smoke-deno: ok, planets=' + n);
`;

const r = spawnSync('deno', ['eval', '--allow-read', '--allow-env', script], {
    cwd: coreDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_JHORA_EPHE_PATH: epheBsp },
});
process.exit(r.status ?? 1);
