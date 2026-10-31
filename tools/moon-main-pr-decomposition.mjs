#!/usr/bin/env node
/**
 * Per-sample Moon / ΔT decomposition: main c677828 vs PR, modes M and Mo.
 * Uses modern_se210_golden.json (same oracle as kit modern path).
 *
 * Usage: node tools/moon-main-pr-decomposition.mjs [mainRoot] [prRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAIN = path.resolve(process.argv[2] || '/tmp/jhora-main');
const PR = path.resolve(process.argv[3] || process.cwd());

const imp = (root, p) => import(pathToFileURL(path.join(root, p)).href);

const { DateTime } = await imp(PR, 'packages/core/node_modules/luxon/src/luxon.js');

const fixture = JSON.parse(
    fs.readFileSync(path.join(PR, 'packages/core/tests/fixtures/modern_se210_golden.json'), 'utf8'),
);

const DE440S_FIRST = 2396758.5 + 1;
const DE440S_LAST = 2506331.5 - 1;

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d * 3600;
}

function utcYear(utc) {
    return Number.parseInt(utc.slice(0, 4), 10);
}

async function loadEngine(root) {
    const { EphemerisEngine } = await imp(root, 'packages/core/dist/engine/ephemeris.js');
    const { deltaT } = await imp(root, 'packages/core/dist/engine/deltat.js');
    const e = new EphemerisEngine();
    const bsp = fs.readFileSync(path.join(PR, 'packages/ephe/de440s.bsp'));
    await e.initialize({ kernel: new Uint8Array(bsp) });
    return { e, deltaT };
}

const mainEng = await loadEngine(MAIN);
const prEng = await loadEngine(PR);

function filterEra(yMin, yMax) {
    return fixture.cases.filter(
        (c) =>
            c.jdUT > DE440S_FIRST &&
            c.jdUT < DE440S_LAST &&
            utcYear(c.utc) >= yMin &&
            utcYear(c.utc) < yMax &&
            c.bodies?.Moon !== undefined,
    );
}

function buildRows(eraCases) {
    const rows = [];
    for (const c of eraCases) {
        const dt = DateTime.fromISO(c.utc, { zone: 'utc' });
        const loc = { latitude: c.lat, longitude: c.lon };
        const base = {
            ayanamsaOrder: 27,
            nodeType: 'true',
            positionMode: 'geometric',
        };

        const run = (eng, inject) => {
            const opts = {
                ...base,
                precisionProfile: 'modern',
                deltaTForecast: 'oracle-compat',
                ...(inject ? { deltaTOverrideSeconds: c.deltaTSeconds } : {}),
            };
            const moon = eng.e.getPlanets(dt, loc, opts).find((p) => p.name === 'Moon')?.longitude;
            const dT = eng.deltaT(c.jdUT, 'modern', 'oracle-compat');
            return { moon, dT };
        };

        const mMain = run(mainEng, false);
        const mPr = run(prEng, false);
        const moMain = run(mainEng, true);
        const moPr = run(prEng, true);

        rows.push({
            id: c.id,
            utc: c.utc,
            jdUT: c.jdUT,
            oracleMoon: c.bodies.Moon,
            oracleDt: c.deltaTSeconds,
            M: {
                mainMoonErr: gapArcsec(mMain.moon, c.bodies.Moon),
                prMoonErr: gapArcsec(mPr.moon, c.bodies.Moon),
                mainDtErr: mMain.dT - c.deltaTSeconds,
                prDtErr: mPr.dT - c.deltaTSeconds,
                engineDeltaArcsec: gapArcsec(mPr.moon, mMain.moon),
            },
            Mo: {
                mainMoonErr: gapArcsec(moMain.moon, c.bodies.Moon),
                prMoonErr: gapArcsec(moPr.moon, c.bodies.Moon),
                engineDeltaArcsec: gapArcsec(moPr.moon, moMain.moon),
            },
        });
    }
    return rows;
}

function eraMax(rows) {
    const max = (pick) => Math.max(...rows.map((r) => Math.abs(pick(r))), 0);
    return {
        samples: rows.length,
        maxAbsMoonErrArcsec: {
            mainM: max((r) => r.M.mainMoonErr),
            prM: max((r) => r.M.prMoonErr),
            mainMo: max((r) => r.Mo.mainMoonErr),
            prMo: max((r) => r.Mo.prMoonErr),
        },
    };
}

const rows2026 = buildRows(filterEra(2026, 2150));
rows2026.sort((a, b) => b.M.prMoonErr - a.M.prMoonErr);
const rows1850 = buildRows(filterEra(1850, 2026));

console.log(
    JSON.stringify(
        {
            era1850to2026: eraMax(rows1850),
            era2026to2150: eraMax(rows2026),
            worstSample2026: rows2026[0],
            top5PrM2026: rows2026.slice(0, 5).map((r) => ({
                id: r.id,
                utc: r.utc,
                prMoonErr: r.M.prMoonErr,
                mainMoonErr: r.M.mainMoonErr,
                moPrMoonErr: r.Mo.prMoonErr,
                moMainMoonErr: r.Mo.mainMoonErr,
            })),
        },
        null,
        2,
    ),
);
