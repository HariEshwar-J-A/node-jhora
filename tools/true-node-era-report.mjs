#!/usr/bin/env node
/**
 * Per-era TrueNode max |error| (arcsec) for J, M, Jo, Mo vs oracle kit or golden fixtures.
 *
 * Usage: node tools/true-node-era-report.mjs [kitDir]
 *   kitDir defaults to /tmp/oracle-kit (oracle_jhora.json, oracle_modern.json, cases.json).
 *   Without kit: uses modern_se210 + jhora_dll golden JSON (DE440s published-era cases only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const KIT = process.argv[2] ? path.resolve(process.argv[2]) : '/tmp/oracle-kit';

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { registerNodeBspLoaderFromCore } = await imp('packages/core/node/register.mjs');
registerNodeBspLoaderFromCore();
const { DateTime } = await imp(
    'node_modules/.pnpm/luxon@3.7.2/node_modules/luxon/build/node/luxon.js',
);
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');

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

function loadGoldenCases() {
    const modern = JSON.parse(
        fs.readFileSync(
            path.join(ROOT, 'packages/core/tests/fixtures/modern_se210_golden.json'),
            'utf8',
        ),
    );
    const jhora = JSON.parse(
        fs.readFileSync(
            path.join(ROOT, 'packages/core/tests/fixtures/jhora_dll_golden.json'),
            'utf8',
        ),
    );
    const DE440S_FIRST = 2396758.5 + 1;
    const DE440S_LAST = 2506331.5 - 1;
    const PUB_LAST = 2026;
    const rows = [];
    for (const c of modern.cases) {
        if (c.jdUT <= DE440S_FIRST || c.jdUT >= DE440S_LAST) continue;
        const y = Number.parseInt(c.utc.slice(0, 4), 10);
        if (y > PUB_LAST) continue;
        rows.push({
            utc: c.utc,
            lat: c.lat,
            lon: c.lon,
            jdUT: c.jdUT,
            deltaTSeconds: c.deltaTSeconds,
            trueNodeModern: c.bodies.TrueNode,
        });
    }
    const jById = new Map(jhora.cases.map((c) => [c.id, c]));
    for (const c of modern.cases) {
        const j = jById.get(c.id);
        if (!j || c.jdUT <= DE440S_FIRST || c.jdUT >= DE440S_LAST) continue;
        const y = Number.parseInt(c.utc.slice(0, 4), 10);
        if (y > PUB_LAST) continue;
        const row = rows.find((r) => r.utc === c.utc);
        if (row) row.trueNodeJhora = j.bodies.TrueNode;
    }
    return rows;
}

function loadKitCases() {
    const cases = JSON.parse(fs.readFileSync(path.join(KIT, 'cases.json'), 'utf8'));
    const oj = JSON.parse(fs.readFileSync(path.join(KIT, 'oracle_jhora.json'), 'utf8'));
    const om = JSON.parse(fs.readFileSync(path.join(KIT, 'oracle_modern.json'), 'utf8'));
    return cases.map((c) => ({
        utc: c.utc,
        lat: c.lat,
        lon: c.lon,
        jdUT: c.jdUT,
        deltaTSeconds: om[String(c.id)]?.deltaTSeconds ?? oj[String(c.id)]?.deltaTSeconds,
        trueNodeJhora: oj[String(c.id)]?.bodies?.TrueNode,
        trueNodeModern: om[String(c.id)]?.bodies?.TrueNode,
    }));
}

const haveKit =
    fs.existsSync(path.join(KIT, 'cases.json')) &&
    fs.existsSync(path.join(KIT, 'oracle_jhora.json')) &&
    fs.existsSync(path.join(KIT, 'oracle_modern.json'));

const cases = haveKit ? loadKitCases() : loadGoldenCases();
if (!haveKit) {
    console.warn('true-node-era-report: no oracle kit; using golden fixtures (DE440s, UTC≤2026)\n');
}

const eng = EphemerisEngine.getInstance();
await eng.initialize();

const modes = [
    ['J', 'jhora', false],
    ['Jo', 'jhora', true],
    ['M', 'modern', false],
    ['Mo', 'modern', true],
];

const max = {};
for (const [mode] of modes) {
    for (const [label] of ERAS) max[`${mode}|${label}`] = 0;
}

for (const c of cases) {
    const y = Number.parseInt(c.utc.slice(0, 4), 10);
    const era = eraOfYear(y);
    if (!era) continue;
    const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
    const loc = { latitude: c.lat, longitude: c.lon };

    for (const [mode, profile, injectDt] of modes) {
        const oracle = profile === 'jhora' ? c.trueNodeJhora : c.trueNodeModern;
        if (oracle === undefined) continue;
        const precision = injectDt
            ? { precisionProfile: profile, deltaTOverrideSeconds: c.deltaTSeconds }
            : { precisionProfile: profile };
        const rahu = eng
            .getPlanets(utc, loc, {
                ayanamsaOrder: 27,
                nodeType: 'true',
                julianDayUt: c.jdUT,
                calendar: 'gregorian',
                ...precision,
            })
            .find((p) => p.name === 'Rahu').longitude;
        const err = gapArcsec(rahu, oracle);
        const key = `${mode}|${era}`;
        max[key] = Math.max(max[key], err);
    }
}

console.log('TrueNd max |error| (arcsec) by era × mode\n');
console.log('era              J        Jo       M        Mo');
for (const [label] of ERAS) {
    const row = modes.map(([m]) => (max[`${m}|${label}`] || 0).toFixed(3).padStart(8));
    console.log(`${label.padEnd(16)}${row.join('')}`);
}
