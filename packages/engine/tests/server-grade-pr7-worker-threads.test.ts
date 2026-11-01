import { availableParallelism } from 'node:os';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { describeCalculation, EphemerisEngine } from '@node-jhora/core';
import {
    combinedBenchFingerprint,
    dashaTreeSha256,
    f64Hex,
    housesFingerprintHex,
    planetsFingerprintHex,
} from '@node-jhora/testkit';
import { ChartSession } from '../src/chart-session.js';
import { DateTime } from 'luxon';

const BENCH_INSTANT = DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' });
const BENCH_LOCATION = { latitude: 13.0827, longitude: 80.2707 };
const BENCH_JD_UT = 2_451_153.661_805_555_7;

interface IdentityGoldens {
    benchChart: {
        jhora: { combinedSha256: string };
    };
}

const goldens = JSON.parse(
    readFileSync(join(import.meta.dirname, 'fixtures/server-grade-pr2-identity.json'), 'utf8'),
) as IdentityGoldens;

function mainThreadCombined(engine: EphemerisEngine): string {
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
        snap.planets!.map((p) => ({
            name: p.name,
            longitude: p.longitude,
            latitude: p.latitude,
            speed: p.speed,
        })),
    );
    const housesHex = housesFingerprintHex({
        ascendant: snap.houses!.ascendant,
        mc: snap.houses!.mc,
        cusps: snap.houses!.cusps,
    });
    const dashaSha = dashaTreeSha256(snap.dasha);
    return combinedBenchFingerprint({
        ayanamsaHex: f64Hex(ayanamsa),
        planetsHex,
        housesHex,
        dashaSha256: dashaSha,
    });
}

function runWorkerIdentity(workerUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl);
        worker.on('message', (msg: { combinedSha256: string }) => {
            worker.terminate().catch(() => {});
            resolve(msg.combinedSha256);
        });
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`worker exit ${code}`));
        });
    });
}

describe('server-grade PR7 worker_threads chart identity', () => {
    let engine: EphemerisEngine;
    const workerScript = fileURLToPath(
        new URL('./helpers/pr7-worker-chart-identity.mjs', import.meta.url),
    );

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
    }, 120_000);

    test('main-thread jhora bench fingerprint matches PR2 golden', () => {
        expect(mainThreadCombined(engine)).toBe(goldens.benchChart.jhora.combinedSha256);
    });

    test('concurrent worker_threads outputs match main thread (no shared-state leakage)', async () => {
        const expected = mainThreadCombined(engine);
        const workerCount = Math.min(4, Math.max(2, availableParallelism()));
        const hashes = await Promise.all(
            Array.from({ length: workerCount }, () => runWorkerIdentity(workerScript)),
        );
        for (const h of hashes) {
            expect(h).toBe(expected);
        }
    }, 180_000);
});
