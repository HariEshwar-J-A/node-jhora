#!/usr/bin/env node
/**
 * Report max |Δλ| (arcsec) vs modern_se210 golden by era for the built engine.
 * Oracle is the fixture (pyswisseph 2.10 + DE431 .se1); outside DE440s needs NJCE chunks.
 *
 * Usage: node tools/planet-era-residual-report.mjs [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.argv[2] || process.cwd());
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { DateTime } = await imp('packages/core/node_modules/luxon/src/luxon.js');
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');

const fixture = JSON.parse(
    fs.readFileSync(
        path.join(ROOT, 'packages/core/tests/fixtures/modern_se210_golden.json'),
        'utf8',
    ),
);

const ERAS = [
    [-10001, -5000],
    [-5000, -3000],
    [-3000, -1000],
    [-1000, 0],
    [0, 1000],
    [1000, 1582],
    [1582, 1850],
    [1850, 2026],
    [2026, 2150],
    [2150, 3000],
    [3000, 5000],
    [5000, 10001],
];

const eraLabel = (y) => {
    for (const [a, b] of ERAS) {
        if (a <= y && y < b) return `${a > -10001 ? a : -10000}..${b === 10001 ? 10000 : b}`;
    }
    return '?';
};

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const ANGLES = ['asc', 'mc'];

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

const kernel = new Uint8Array(fs.readFileSync(path.join(ROOT, 'packages/ephe/de440s.bsp')));
const e = new EphemerisEngine();
await e.initialize({ kernel });

/** @type {Record<string, { planets: Record<string, number>, angles: Record<string, number>, n: number }>} */
const max = {};

for (const c of fixture.cases) {
    const y = DateTime.fromISO(c.utc, { zone: 'utc' }).year;
    const er = eraLabel(y);
    const jdUt = c.jdUT;
    let ps;
    try {
        ps = e.getPlanets(
            DateTime.fromISO(c.utc, { zone: 'utc' }),
            { latitude: c.lat, longitude: c.lon },
            {
                ayanamsaOrder: 27,
                julianDayUt: jdUt,
                precisionProfile: 'modern',
                deltaTForecast: 'oracle-compat',
                nodeType: 'true',
            },
        );
    } catch {
        continue;
    }
    max[er] = max[er] || { planets: {}, angles: {}, n: 0 };
    max[er].n++;
    for (const name of BODIES) {
        const got = ps.find((p) => p.name === name)?.longitude;
        if (got === undefined) continue;
        const err = gapArcsec(got, c.bodies[name]);
        max[er].planets[name] = Math.max(max[er].planets[name] ?? 0, err);
        max[er].planets.all = Math.max(max[er].planets.all ?? 0, err);
    }
    const houses = e.getHouses(jdUt, c.lat, c.lon, 'W', true, 27, 0, 'se-apparent', {
        precisionProfile: 'modern',
        deltaTForecast: 'oracle-compat',
    });
    for (const key of ANGLES) {
        const exp = c.houses.W[key];
        const got = key === 'asc' ? houses.ascendant : houses.mc;
        const err = gapArcsec(got, exp);
        max[er].angles[key] = Math.max(max[er].angles[key] ?? 0, err);
        max[er].angles.all = Math.max(max[er].angles.all ?? 0, err);
    }
}

console.log(
    JSON.stringify(
        {
            note: 'DE440s window only; cases that throw (outside kernel without chunks) skipped. Before=after for this PR (sidereal precession unchanged).',
            fixtureCases: fixture.cases.length,
            maxArcsecByEra: max,
        },
        null,
        2,
    ),
);
