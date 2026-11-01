#!/usr/bin/env node
/**
 * Regenerate server-grade PR2 identity goldens (bench chart + dasha tree SHA-256).
 * Run from repo root after `pnpm build`. Only refresh when output intentionally changes.
 */

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'packages/engine/package.json'));
const outPath = join(root, 'packages/engine/tests/fixtures/server-grade-pr2-identity.json');

const { registerNodeBspLoaderFromCore } = await import(
    join(root, 'packages/core/node/register.mjs')
);
await registerNodeBspLoaderFromCore();

const { EphemerisEngine, describeCalculation } = await import(
    join(root, 'packages/core/dist/index.js')
);
const { ChartSession } = await import(join(root, 'packages/engine/dist/index.js'));
const {
    DASHA_IDENTITY_CORPUS,
    combinedBenchFingerprint,
    dashaTreeSha256,
    f64Hex,
    housesFingerprintHex,
    planetsFingerprintHex,
} = await import(join(root, 'packages/testkit/dist/index.js'));
const { DateTime } = await import(require.resolve('luxon'));

const BENCH = {
    instant: DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' }),
    location: { latitude: 13.0827, longitude: 80.2707 },
    dasha: { depth: 5 },
};

const PROFILES = [
    { id: 'jhora', settings: 'node-jhora-default', precisionProfile: 'jhora' },
    {
        id: 'modern',
        settings: { preset: 'node-jhora-default', precisionProfile: 'modern' },
        precisionProfile: 'modern',
    },
    {
        id: 'truth',
        settings: { preset: 'node-jhora-default', precisionProfile: 'truth' },
        precisionProfile: 'truth',
    },
];

function precisionOpts(profile, resolved) {
    const o = { calendar: resolved.config.calendar, precisionProfile: profile };
    if (resolved.config.deltaTOverrideSeconds !== undefined) {
        o.deltaTOverrideSeconds = resolved.config.deltaTOverrideSeconds;
    }
    if (resolved.config.deltaTForecast === 'oracle-compat') {
        o.deltaTForecast = resolved.config.deltaTForecast;
    }
    return o;
}

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const benchProfiles = {};
for (const profile of PROFILES) {
    const resolved = describeCalculation(profile.settings);
    const session = new ChartSession({
        instant: BENCH.instant,
        location: BENCH.location,
        settings: profile.settings,
        dasha: BENCH.dasha,
        ephemeris: engine,
    });
    const jd = 2451545.0;
    const snap = session.collect(['planets', 'houses', 'dasha']);
    const frame =
        profile.precisionProfile === 'modern' || profile.precisionProfile === 'truth'
            ? 'apparent'
            : 'geometric';
    const ayanamsa = engine.getAyanamsa(
        jd,
        resolved.config.ayanamsaMode,
        resolved.config.ayanamsaOffset,
        frame,
        precisionOpts(profile.precisionProfile, resolved),
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
    benchProfiles[profile.id] = {
        ayanamsaHex: f64Hex(ayanamsa),
        planetsHex,
        housesHex,
        dashaSha256: dashaSha,
        combinedSha256: combinedBenchFingerprint({
            ayanamsaHex: f64Hex(ayanamsa),
            planetsHex,
            housesHex,
            dashaSha256: dashaSha,
        }),
    };
}

const dashaCases = {};
for (const caseDef of DASHA_IDENTITY_CORPUS) {
    const instant = DateTime.fromISO(caseDef.instant, { zone: caseDef.timezone });
    if (!instant.isValid) {
        throw new Error(`invalid instant ${caseDef.id}`);
    }
    const session = new ChartSession({
        instant,
        location: {
            latitude: caseDef.latitude,
            longitude: caseDef.longitude,
            altitude: caseDef.altitude ?? 0,
        },
        settings: caseDef.settings,
        dasha: { depth: 5 },
        ephemeris: engine,
    });
    const dasha = session.getDasha();
    dashaCases[caseDef.id] = dashaTreeSha256(dasha);
}

const payload = {
    schemaVersion: 1,
    generatedFrom: 'tools/generate-server-grade-pr2-goldens.mjs',
    benchChart: benchProfiles,
    dashaTreeSha256: dashaCases,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${outPath} (${Object.keys(dashaCases).length} dasha cases)`);
