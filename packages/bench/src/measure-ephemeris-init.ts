/**
 * Standalone entry: cold EphemerisEngine.initialize() in a fresh Node process.
 * Emits one JSON line: { "ms": number }
 */
import { performance } from 'node:perf_hooks';

import { EphemerisEngine } from '@node-jhora/core';
import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register';

await registerNodeBspLoaderFromCore();

const start = performance.now();
await EphemerisEngine.getInstance().initialize();
const ms = performance.now() - start;
process.stdout.write(`${JSON.stringify({ ms })}\n`);
