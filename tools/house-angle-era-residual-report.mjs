#!/usr/bin/env node
/**
 * Max sidereal house-angle residuals vs modern_se210 golden by era (both profiles).
 * Uses fixture jdUT (proleptic Gregorian) like the golden tests.
 *
 * Usage: node tools/house-angle-era-residual-report.mjs [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.argv[2] || process.cwd());
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { DateTime } = await imp('packages/core/node_modules/luxon/src/luxon.js');
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const { deltaT, LAST_OBSERVED_YEAR_MODERN } = await imp('packages/core/dist/engine/deltat.js');

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

const BODIES = ['Moon'];
const SYSTEMS = ['W', 'E', 'P', 'O'];

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

const kernel = new Uint8Array(fs.readFileSync(path.join(ROOT, 'packages/ephe/de440s.bsp')));
const e = new EphemerisEngine();
await e.initialize({ kernel });

function initEra() {
    return {
        asc: 0,
        mc: 0,
        vertex: 0,
        cusps: 0,
        Moon: 0,
        MoonNoDtOverride: 0,
        n: 0,
    };
}

/** @type {Record<string, Record<string, ReturnType<typeof initEra>>>} */
const max = { modern: {}, jhora: {} };

for (const c of fixture.cases) {
    const y = DateTime.fromISO(c.utc, { zone: 'utc' }).year;
    const er = eraLabel(y);
    const jd = c.jdUT;
    const afterRecord = y > LAST_OBSERVED_YEAR_MODERN;
    const loc = { latitude: c.lat, longitude: c.lon };
    const utc = DateTime.fromISO(c.utc, { zone: 'utc' });

    for (const profile of ['modern', 'jhora']) {
        const precision = {
            precisionProfile: profile,
            ...(afterRecord ? { deltaTOverrideSeconds: c.deltaTSeconds } : {}),
        };
        max[profile][er] = max[profile][er] || initEra();
        max[profile][er].n++;

        try {
            const ps = e.getPlanets(utc, loc, {
                ayanamsaOrder: 27,
                julianDayUt: jd,
                nodeType: 'true',
                ...precision,
            });
            const moon = ps.find((p) => p.name === 'Moon')?.longitude;
            if (moon !== undefined) {
                max[profile][er].Moon = Math.max(
                    max[profile][er].Moon,
                    gapArcsec(moon, c.bodies.Moon),
                );
                if (profile === 'modern' && !afterRecord) {
                    const psNative = e.getPlanets(utc, loc, {
                        ayanamsaOrder: 27,
                        julianDayUt: jd,
                        nodeType: 'true',
                        precisionProfile: 'modern',
                    });
                    const m2 = psNative.find((p) => p.name === 'Moon')?.longitude;
                    if (m2 !== undefined) {
                        max[profile][er].MoonNoDtOverride = Math.max(
                            max[profile][er].MoonNoDtOverride,
                            gapArcsec(m2, c.bodies.Moon),
                        );
                    }
                }
            }
        } catch {
            continue;
        }

        for (const s of SYSTEMS) {
            const exp = c.houses[s];
            const got = e.getHouses(jd, c.lat, c.lon, s, true, 27, 0, undefined, precision);
            max[profile][er].asc = Math.max(
                max[profile][er].asc,
                gapArcsec(got.ascendant, exp.asc),
            );
            max[profile][er].mc = Math.max(max[profile][er].mc, gapArcsec(got.mc, exp.mc));
            if (got.vertex !== undefined && exp.vertex !== undefined) {
                max[profile][er].vertex = Math.max(
                    max[profile][er].vertex,
                    gapArcsec(got.vertex, exp.vertex),
                );
            }
            for (let i = 0; i < 12; i++) {
                max[profile][er].cusps = Math.max(
                    max[profile][er].cusps,
                    gapArcsec(got.cusps[i], exp.cusps[i]),
                );
            }
        }
    }
}

console.log(
    JSON.stringify(
        {
            note: 'modern oracle = SE 2.10 golden; jhora angles vs same fixture are informational only. jdUT from fixture. MoonNoDtOverride: modern profile native ΔT only (published era).',
            fixtureCases: fixture.cases.length,
            maxArcsecByEra: max,
        },
        null,
        2,
    ),
);
