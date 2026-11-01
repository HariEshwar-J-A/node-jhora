#!/usr/bin/env node
/**
 * Engine self-consistency diagnostic (NOT benchmark truth): production
 * lunar-node.ts / getPlanets(true node) on DE440s. Compare to TN-MED-LT1 in
 * truth/true_node_truth.py for honest frame gaps, not 0″ circular proof.
 */
import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../../packages/core/dist/engine/ephemeris.js';
import { registerNodeBspLoaderFromCore } from '../../../packages/core/node/register.mjs';

const { jdUt, deltaTOverrideSeconds } = JSON.parse(readFileSync(0, 'utf8'));
const ms = (jdUt - 2440587.5) * 86400000;
const when = DateTime.fromMillis(ms, { zone: 'utc' });

await registerNodeBspLoaderFromCore();
const engine = EphemerisEngine.getInstance();
await engine.initialize();

const opts =
    deltaTOverrideSeconds !== undefined && deltaTOverrideSeconds !== null
        ? { deltaTOverrideSeconds, precisionProfile: 'modern' }
        : { precisionProfile: 'modern' };

const planets = engine.getPlanets(when, undefined, {
    zodiac: 'tropical',
    positionMode: 'apparent',
    nodeType: 'true',
    includeOuterPlanets: false,
    ...opts,
});
const rahu = planets.find((p) => p.name === 'Rahu');
if (!rahu) {
    process.stderr.write('Rahu missing from getPlanets\n');
    process.exit(1);
}
process.stdout.write(
    JSON.stringify({
        jdUt,
        trueNodeTropicalLon: rahu.longitude,
        deltaTOverrideSeconds: deltaTOverrideSeconds ?? null,
    }),
);
