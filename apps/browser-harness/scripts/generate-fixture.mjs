#!/usr/bin/env node
/**
 * Node reference snapshots for browser Playwright parity (strict === on numbers).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { EphemerisEngine } from '@node-jhora/core';
import { ChartSession, CHART_SECTION_IDS } from '@node-jhora/engine';
import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');
mkdirSync(outDir, { recursive: true });

await registerNodeBspLoaderFromCore();

const CASES = [
    {
        id: 'varanasi-2020',
        instant: '2020-12-21T12:50:00.000Z',
        latitude: 25.3176,
        longitude: 82.9739,
        settings: 'node-jhora-default',
    },
    {
        id: 'delhi-2000',
        instant: '2000-01-01T12:00:00.000Z',
        latitude: 28.6139,
        longitude: 77.209,
        settings: 'node-jhora-default',
    },
    {
        id: 'london-1970',
        instant: '1970-06-15T18:30:00.000Z',
        latitude: 51.5074,
        longitude: -0.1278,
        settings: 'node-jhora-default',
    },
];

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const fixture = { generatedAt: new Date().toISOString(), cases: {} };

for (const c of CASES) {
    const session = new ChartSession({
        instant: DateTime.fromISO(c.instant, { zone: 'utc' }),
        location: { latitude: c.latitude, longitude: c.longitude },
        settings: c.settings,
        ephemeris: engine,
    });
    fixture.cases[c.id] = {
        request: {
            instant: c.instant,
            latitude: c.latitude,
            longitude: c.longitude,
            settings: c.settings,
            include: [...CHART_SECTION_IDS],
        },
        snapshot: session.collect(CHART_SECTION_IDS),
    };
}

writeFileSync(join(outDir, 'node-chart-snapshots.json'), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${CASES.length} chart snapshots to ${outDir}/node-chart-snapshots.json`);
