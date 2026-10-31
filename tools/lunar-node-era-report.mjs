#!/usr/bin/env node
/**
 * Max |error| (arcsec) for TrueNd, MeanNd, Ketu by era × J/M from lunar-node-oracle.json.
 *
 * Usage: node tools/lunar-node-era-report.mjs
 */
import fs from 'node:fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { registerNodeBspLoaderFromCore } = await imp('packages/core/node/register.mjs');
registerNodeBspLoaderFromCore();
const { DateTime } = await imp(
    'node_modules/.pnpm/luxon@3.7.2/node_modules/luxon/build/node/luxon.js',
);
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');

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
await eng.initialize();

const bodies = ['TrueNd', 'MeanNd', 'Ketu'];
const modes = [
    ['J', 'jhora', false],
    ['M', 'modern', false],
];

const max = {};
for (const b of bodies) {
    for (const [m] of modes) {
        for (const [label] of ERAS) max[`${b}|${m}|${label}`] = 0;
    }
}

for (const c of fixture.cases) {
    const era = eraOfYear(c.y);
    if (!era) continue;
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
        const meanErr = gapArcsec(meanRahu.longitude, oracle.mean.lon);
        const ketuErr = gapArcsec(ketu.longitude, mod360(oracle.true.lon + 180));

        max[`TrueNd|${mode}|${era}`] = Math.max(max[`TrueNd|${mode}|${era}`], trueErr);
        max[`MeanNd|${mode}|${era}`] = Math.max(max[`MeanNd|${mode}|${era}`], meanErr);
        max[`Ketu|${mode}|${era}`] = Math.max(max[`Ketu|${mode}|${era}`], ketuErr);
    }
}

console.log('Max |error| (arcsec) — TrueNd / MeanNd / Ketu × J / M\n');
for (const b of bodies) {
    console.log(`\n${b}`);
    console.log('era                  J        M');
    for (const [label] of ERAS) {
        const j = (max[`${b}|J|${label}`] || 0).toFixed(3).padStart(8);
        const m = (max[`${b}|M|${label}`] || 0).toFixed(3).padStart(8);
        console.log(`${label.padEnd(20)}${j}${m}`);
    }
}
