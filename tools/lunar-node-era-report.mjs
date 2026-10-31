#!/usr/bin/env node
/**
 * Max |error| (arcsec) for TrueNd, MeanNd, Ketu by era × J/M from lunar-node-oracle.json.
 *
 * Usage: node tools/lunar-node-era-report.mjs
 *
 * Loads DE441/DE431 NJCE chunks when NODE_JHORA_EPHE_LONG_DIR or NJCE_DIR is set
 * (see packages/core/node/ephemeris.mjs). Without chunks, only fixture cases inside
 * the DE440s UT window are evaluated; other eras show "—".
 */
import fs from 'node:fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { registerNodeBspLoaderFromCore } = await imp('packages/core/node/register.mjs');
registerNodeBspLoaderFromCore();
const { registerNodeDe441ChunkStore, registerNodeChunkStore } = await imp(
    'packages/core/node/ephemeris.mjs',
);
const { DateTime } = await imp(
    'node_modules/.pnpm/luxon@3.7.2/node_modules/luxon/build/node/luxon.js',
);
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');

/** Same UT margins as packages/core/tests/engine/lunar-node-oracle-support.ts */
const DE440S_UT_FIRST = 2396758.5 + 1;
const DE440S_UT_LAST = 2506331.5 - 1;

const fixture = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/core/tests/fixtures/lunar-node-oracle.json'), 'utf8'),
);

const ERAS = [
    ['-10000..-5000', -10000, -5000],
    ['-5000..-3000', -5000, -3000],
    ['-3000..-1000', -3000, -1000],
    ['-1000..0', -1000, 0],
    ['0..1000', 0, 1000],
    ['1000..1582', 1000, 1582],
    ['1582..1850', 1582, 1850],
    ['1850..2026', 1850, 2026],
    ['2026..2150', 2026, 2150],
    ['2150..3000', 2150, 3000],
    ['3000..5000', 3000, 5000],
    ['5000..10000', 5000, 10000],
];

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

function eraOfYear(y) {
    for (const [label, lo, hi] of ERAS) {
        if (y >= lo && y < hi) return label;
    }
    return null;
}

function mod360(x) {
    return ((x % 360) + 360) % 360;
}

const eng = EphemerisEngine.getInstance();
let haveLongRangeChunks = false;
const longDir =
    process.env.NODE_JHORA_EPHE_LONG_DIR ??
    process.env.NJCE_DIR ??
    path.join(ROOT, 'packages/ephe-long/dist');
if (fs.existsSync(longDir)) {
    try {
        await registerNodeDe441ChunkStore(eng, { dirs: [longDir] });
        haveLongRangeChunks = true;
    } catch {
        try {
            await registerNodeChunkStore(eng, { dirs: [longDir] });
            haveLongRangeChunks = true;
        } catch {
            /* no chunks in dir */
        }
    }
}

await eng.initialize();

function canComputeCase(jdUt) {
    if (jdUt > DE440S_UT_FIRST && jdUt < DE440S_UT_LAST) return true;
    return haveLongRangeChunks;
}

const bodies = ['TrueNd', 'MeanNd', 'Ketu'];
const modes = [
    ['J', 'jhora', false],
    ['M', 'modern', false],
];

const max = {};
for (const b of bodies) {
    for (const [m] of modes) {
        for (const [label] of ERAS) {
            max[`${b}|${m}|${label}`] = 0;
            if (b === 'TrueNd') max[`TrueNdSpd|${m}|${label}`] = 0;
        }
    }
}

let skippedOutsideKernel = 0;
for (const c of fixture.cases) {
    const era = eraOfYear(c.y);
    if (!era) continue;
    if (!canComputeCase(c.jd)) {
        skippedOutsideKernel += 1;
        continue;
    }
    const utc = DateTime.fromObject(
        { year: c.y, month: c.m, day: c.d, hour: c.H, minute: c.M, second: c.S },
        { zone: 'utc' },
    );
    const loc = { latitude: c.lat, longitude: c.lon };

    for (const [mode, profile, injectDt] of modes) {
        const oracle = profile === 'jhora' ? c.jhora : c.modern;
        const precision = injectDt
            ? {
                  precisionProfile: profile,
                  deltaTOverrideSeconds: profile === 'jhora' ? c.jhora.deltaT : c.modern.deltaT,
              }
            : { precisionProfile: profile };

        const planets = eng.getPlanets(utc, loc, {
            ayanamsaOrder: 27,
            julianDayUt: c.jd,
            calendar: 'gregorian',
            ...precision,
        });
        const rahu = planets.find((p) => p.name === 'Rahu');
        const ketu = planets.find((p) => p.name === 'Ketu');
        if (!rahu || !ketu) continue;
        const meanRahu = eng
            .getPlanets(utc, loc, {
                ayanamsaOrder: 27,
                nodeType: 'mean',
                julianDayUt: c.jd,
                calendar: 'gregorian',
                ...precision,
            })
            .find((p) => p.name === 'Rahu');
        if (!meanRahu) continue;

        const trueErr = gapArcsec(rahu.longitude, oracle.true.lon);
        const trueSpdErr = gapArcsec(rahu.speed, oracle.true.speed);
        const meanErr = gapArcsec(meanRahu.longitude, oracle.mean.lon);
        const ketuErr = gapArcsec(ketu.longitude, mod360(oracle.true.lon + 180));

        max[`TrueNd|${mode}|${era}`] = Math.max(max[`TrueNd|${mode}|${era}`], trueErr);
        max[`TrueNdSpd|${mode}|${era}`] = Math.max(
            max[`TrueNdSpd|${mode}|${era}`] ?? 0,
            trueSpdErr,
        );
        max[`MeanNd|${mode}|${era}`] = Math.max(max[`MeanNd|${mode}|${era}`], meanErr);
        max[`Ketu|${mode}|${era}`] = Math.max(max[`Ketu|${mode}|${era}`], ketuErr);
    }
}

if (skippedOutsideKernel > 0) {
    console.warn(
        `lunar-node-era-report: skipped ${skippedOutsideKernel} fixture cases outside ` +
            `DE440s (attach NJCE via NODE_JHORA_EPHE_LONG_DIR for −10000..10000).\n`,
    );
}

console.log('Max |error| (arcsec) — TrueNd position / speed (″/day) × J / M\n');
console.log('TrueNd position (arcsec)');
for (const b of bodies) {
    if (b !== 'TrueNd') continue;
    console.log(`\n${b}`);
    console.log('era                  J        M');
    for (const [label] of ERAS) {
        const jKey = `${b}|J|${label}`;
        const mKey = `${b}|M|${label}`;
        const j = max[jKey] > 0 ? max[jKey].toFixed(3).padStart(8) : '       —'.padStart(8);
        const m = max[mKey] > 0 ? max[mKey].toFixed(3).padStart(8) : '       —'.padStart(8);
        console.log(`${label.padEnd(20)}${j}${m}`);
    }
}
console.log('\nTrueNd speed (arcsec/day)');
console.log('era                  J        M');
for (const [label] of ERAS) {
    const jKey = `TrueNdSpd|J|${label}`;
    const mKey = `TrueNdSpd|M|${label}`;
    const j = max[jKey] > 0 ? max[jKey].toFixed(3).padStart(8) : '       —'.padStart(8);
    const m = max[mKey] > 0 ? max[mKey].toFixed(3).padStart(8) : '       —'.padStart(8);
    console.log(`${label.padEnd(20)}${j}${m}`);
}

console.log('\nMeanNd / Ketu position (arcsec)');
for (const b of bodies) {
    if (b === 'TrueNd') continue;
    console.log(`\n${b}`);
    console.log('era                  J        M');
    for (const [label] of ERAS) {
        const jKey = `${b}|J|${label}`;
        const mKey = `${b}|M|${label}`;
        const j = max[jKey] > 0 ? max[jKey].toFixed(3).padStart(8) : '       —'.padStart(8);
        const m = max[mKey] > 0 ? max[mKey].toFixed(3).padStart(8) : '       —'.padStart(8);
        console.log(`${label.padEnd(20)}${j}${m}`);
    }
}
