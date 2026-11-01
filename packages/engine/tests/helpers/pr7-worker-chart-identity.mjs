/**
 * Worker: compute jhora bench-chart combined identity SHA-256 (same as server-grade PR2 goldens).
 */
import { parentPort } from 'node:worker_threads';

import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register';
import { describeCalculation, EphemerisEngine } from '@node-jhora/core';
import { ChartSession } from '@node-jhora/engine';
import {
    combinedBenchFingerprint,
    dashaTreeSha256,
    f64Hex,
    housesFingerprintHex,
    planetsFingerprintHex,
} from '@node-jhora/testkit';
import { DateTime } from 'luxon';

const BENCH_INSTANT = DateTime.fromISO('2020-12-21T18:20:00', { zone: 'Asia/Kolkata' });
const BENCH_LOCATION = { latitude: 25.3176, longitude: 82.9739 };
const BENCH_JD_UT = 2_459_205.034_722_222;

await registerNodeBspLoaderFromCore();
const engine = new EphemerisEngine();
await engine.initialize();

const settings = 'node-jhora-default';
const resolved = describeCalculation(settings);
const session = new ChartSession({
    instant: BENCH_INSTANT,
    location: BENCH_LOCATION,
    settings,
    dasha: { depth: 5 },
    ephemeris: engine,
});
const snap = session.collect(['planets', 'houses', 'dasha']);
const ayanamsa = engine.getAyanamsa(
    BENCH_JD_UT,
    resolved.config.ayanamsaMode,
    resolved.config.ayanamsaOffset,
    'geometric',
    { calendar: resolved.config.calendar, precisionProfile: 'jhora' },
);
const planetsHex = planetsFingerprintHex(
    snap.planets.map((p) => ({
        name: p.name,
        longitude: p.longitude,
        latitude: p.latitude,
        speed: p.speed,
    })),
);
const housesHex = housesFingerprintHex({
    ascendant: snap.houses.ascendant,
    mc: snap.houses.mc,
    cusps: snap.houses.cusps,
});
const dashaSha = dashaTreeSha256(snap.dasha);
const combinedSha256 = combinedBenchFingerprint({
    ayanamsaHex: f64Hex(ayanamsa),
    planetsHex,
    housesHex,
    dashaSha256: dashaSha,
});

parentPort.postMessage({ combinedSha256 });
