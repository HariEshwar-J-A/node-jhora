#!/usr/bin/env node
/**
 * Compute SHA-256 hashes of canonical ChartSession JSON for the determinism corpus.
 * Invoked by scripts/check-determinism.mjs under varying TZ/LANG.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'packages/engine/package.json'));

const { registerNodeBspLoaderFromCore } = await import(join(root, 'packages/core/node/register.mjs'));
await registerNodeBspLoaderFromCore();

const { EphemerisEngine } = await import(join(root, 'packages/core/dist/index.js'));
const { ChartSession } = await import(join(root, 'packages/engine/dist/index.js'));
const { canonicalSerialize, DETERMINISM_CORPUS, hashCanonicalSerialize } = await import(
    join(root, 'packages/testkit/dist/index.js'),
);
const { DateTime } = await import(require.resolve('luxon'));

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const hashes = {};

for (const caseDef of DETERMINISM_CORPUS) {
    const instant = DateTime.fromISO(caseDef.instant, { zone: caseDef.timezone });
    if (!instant.isValid) {
        throw new Error(`invalid instant for ${caseDef.id}: ${instant.invalidReason}`);
    }
    const session = new ChartSession({
        instant,
        location: {
            latitude: caseDef.latitude,
            longitude: caseDef.longitude,
            altitude: caseDef.altitude ?? 0,
        },
        settings: caseDef.settings,
        ephemeris: engine,
    });
    const snapshot = session.toJSON();
    const text = canonicalSerialize(snapshot);
    const hash = hashCanonicalSerialize(snapshot);
    if (hash !== hashCanonicalSerialize(JSON.parse(text))) {
        throw new Error(`canonical round-trip mismatch for ${caseDef.id}`);
    }
    hashes[caseDef.id] = hash;
}

process.stdout.write(`${JSON.stringify(hashes)}\n`);
