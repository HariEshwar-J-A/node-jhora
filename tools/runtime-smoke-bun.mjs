#!/usr/bin/env node
/**
 * Bun import smoke (see docs/getting-started/bun.md).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const coreDir = join(root, 'packages/core');
const require = createRequire(import.meta.url);

if (!existsSync(join(coreDir, 'dist/index.js'))) {
    console.error('runtime-smoke-bun: run pnpm build first');
    process.exit(1);
}

const epheBsp =
    process.env.NODE_JHORA_EPHE_PATH ??
    join(require.resolve('@node-jhora/ephe/package.json'), '..', 'de440s.bsp');

const script = `
import { registerNodeBspLoaderFromCore } from './node/register.mjs';
await registerNodeBspLoaderFromCore();
import { EphemerisEngine } from './dist/index.js';
import { parseEngineDateTimeOrJsDate } from './dist/validation/input.js';
const eph = EphemerisEngine.getInstance();
await eph.initialize();
const when = parseEngineDateTimeOrJsDate(new Date('2000-01-01T12:00:00.000Z'));
const n = eph.getPlanets(when, { latitude: 51.476852, longitude: -0.0005 }).length;
if (typeof n !== 'number' || n < 7) throw new Error('unexpected planet count: ' + n);
console.log('runtime-smoke-bun: ok, planets=' + n);
`;

const r = spawnSync('bun', ['--eval', script], {
    cwd: coreDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_JHORA_EPHE_PATH: epheBsp },
});
process.exit(r.status ?? 1);
