/**
 * Worker thread: one EphemerisEngine, repeated full-chart runs (jhora profile).
 * Posts { latenciesMs, rssAfterInitMb, rssAfterWorkMb } to parent.
 */
import { performance } from 'node:perf_hooks';
import { parentPort, workerData } from 'node:worker_threads';

import { EphemerisEngine } from '@node-jhora/core';
import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register';
import { CHART_SECTION_IDS, ChartSession } from '@node-jhora/engine';
import { DateTime } from 'luxon';

const { iterations } = workerData;

await registerNodeBspLoaderFromCore();
const engine = new EphemerisEngine();
await engine.initialize();

const rssAfterInitMb = process.memoryUsage().rss / (1024 * 1024);

const instant = DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' });
const location = { latitude: 13.0827, longitude: 80.2707 };
const settings = 'node-jhora-default';
const dasha = { depth: 3 };

const latenciesMs = [];
for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const session = new ChartSession({
        instant,
        location,
        settings,
        dasha,
        ephemeris: engine,
    });
    session.collect([...CHART_SECTION_IDS]);
    latenciesMs.push(performance.now() - t0);
}

const rssAfterWorkMb = process.memoryUsage().rss / (1024 * 1024);

parentPort.postMessage({ latenciesMs, rssAfterInitMb, rssAfterWorkMb });
