#!/usr/bin/env node
/** Max |mean node error| (arcsec) by era × mode vs lunar-node-oracle.json */
import fs from 'node:fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { registerNodeBspLoaderFromCore } = await imp('packages/core/node/register.mjs');
registerNodeBspLoaderFromCore();
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const { meanLunarNode } = await imp('packages/core/dist/engine/ayanamsa.js');
const { deltaT } = await imp('packages/core/dist/engine/deltat.js');
const { julianCenturies } = await imp('packages/core/dist/engine/coordinates.js');

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

const modes = ['J', 'Jo', 'M', 'Mo'];
const max = {};
for (const m of modes) {
    for (const [label] of ERAS) max[`${m}|${label}`] = 0;
}

for (const c of fixture.cases) {
    const era = eraOfYear(c.y);
    if (!era) continue;
    const jd = c.jd;
    const trop = meanLunarNode(julianCenturies(jd + deltaT(jd) / 86400));
    const ayanJ = eng.getAyanamsa(jd, 27, 0, 'geometric');
    const sidJ = mod360(trop - ayanJ);
    for (const mode of modes) {
        const oracle = mode === 'J' || mode === 'Jo' ? c.jhora : c.modern;
        const err = gapArcsec(sidJ, oracle.mean.lon);
        max[`${mode}|${era}`] = Math.max(max[`${mode}|${era}`], err);
    }
}

console.log('MeanNd max |error| (arcsec) by era × mode\n');
console.log('era              J        Jo       M        Mo');
for (const [label] of ERAS) {
    const row = modes.map((m) => (max[`${m}|${label}`] || 0).toFixed(3).padStart(8));
    console.log(`${label.padEnd(16)}${row.join('')}`);
}
