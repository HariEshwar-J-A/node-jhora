/**
 * Node-side library adapters: node-jhora, astronomy-engine, astronomia (MIT).
 */

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';

import { EphemerisEngine, AYANAMSA } from '../../../packages/core/dist/engine/ephemeris.js';
import { getAyanamsa } from '../../../packages/core/dist/engine/ayanamsa.js';
import { nutation } from '../../../packages/core/dist/engine/nutation.js';
import { deltaT } from '../../../packages/core/dist/engine/deltat.js';
import { julianCenturies } from '../../../packages/core/dist/engine/precession.js';
import { registerNodeBspLoaderFromCore } from '../../../packages/core/node/register.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCH_ROOT = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function wrap360(deg) {
    return ((deg % 360) + 360) % 360;
}

function jdToUtcIso(jdUt) {
    const ms = (jdUt - 2440587.5) * 86400000;
    return DateTime.fromMillis(ms, { zone: 'utc' }).toISO();
}

function lookupDeltaT(jdUt, table) {
    if (jdUt <= table[0].jdUt) return table[0].deltaT;
    if (jdUt >= table[table.length - 1].jdUt) return table[table.length - 1].deltaT;
    for (let i = 0; i < table.length - 1; i++) {
        const a = table[i];
        const b = table[i + 1];
        if (a.jdUt <= jdUt && jdUt <= b.jdUt) {
            const t = (jdUt - a.jdUt) / (b.jdUt - a.jdUt);
            return a.deltaT + t * (b.deltaT - a.deltaT);
        }
    }
    return table[table.length - 1].deltaT;
}

function nutationDpsiDeg(jdUt, deltaTOverride) {
    const jdTT = jdUt + (deltaTOverride ?? deltaT(jdUt)) / 86400;
    return nutation(julianCenturies(jdTT)).dpsi;
}

function lahiriIaeSidereal(tropicalTrueLon, jdUt) {
    const ayan = getAyanamsa(AYANAMSA.LAHIRI, jdUt, 'geometric', 'modern');
    return wrap360(tropicalTrueLon - ayan);
}

/**
 * Mean ecliptic chart lon → true ecliptic of date (Horizons / Skyfield truth frame).
 */
function toTropicalTrue(meanLon, dpsi, kind) {
    if (kind === 'planet') return wrap360(meanLon + dpsi);
    return wrap360(meanLon);
}

async function nodeJhoraSample(jdUt, deltaTMode, sharedDeltaT, engine) {
    const iso = jdToUtcIso(jdUt);
    const dt = DateTime.fromISO(iso, { zone: 'utc' });
    const precisionOpts =
        deltaTMode === 'shared' && sharedDeltaT !== undefined
            ? { deltaTOverrideSeconds: sharedDeltaT, precisionProfile: 'modern' }
            : { precisionProfile: 'modern' };

    const dpsi = nutationDpsiDeg(jdUt, sharedDeltaT);

    const tropPlanets = engine.getPlanets(dt, undefined, {
        zodiac: 'tropical',
        positionMode: 'apparent',
        includeOuterPlanets: true,
        nodeType: 'true',
        ...precisionOpts,
    });

    const sidPlanets = engine.getPlanets(dt, undefined, {
        zodiac: 'sidereal',
        positionMode: 'apparent',
        includeOuterPlanets: true,
        nodeType: 'true',
        ayanamsaOrder: AYANAMSA.LAHIRI,
        ...precisionOpts,
    });

    const meanNodeTrop = engine.getPlanets(dt, undefined, {
        zodiac: 'tropical',
        positionMode: 'apparent',
        nodeType: 'mean',
        includeOuterPlanets: false,
        ...precisionOpts,
    });
    const meanNodeSid = engine.getPlanets(dt, undefined, {
        zodiac: 'sidereal',
        positionMode: 'apparent',
        nodeType: 'mean',
        includeOuterPlanets: false,
        ayanamsaOrder: AYANAMSA.LAHIRI,
        ...precisionOpts,
    });

    const out = {};
    for (const p of tropPlanets) {
        if (p.name === 'Ketu') continue;
        const sid = sidPlanets.find((s) => s.name === p.name);
        if (p.name === 'Rahu') {
            const tropTrue = toTropicalTrue(p.longitude, dpsi, 'trueNode');
            out.TrueNode = {
                tropicalTrue: { lon: tropTrue, lat: p.latitude },
                lahiriIae: { lon: lahiriIaeSidereal(tropTrue, jdUt), lat: p.latitude },
                nodeJhoraLahiri: sid ? { lon: sid.longitude, lat: sid.latitude } : undefined,
            };
            continue;
        }
        const tropTrue = toTropicalTrue(p.longitude, dpsi, 'planet');
        out[p.name] = {
            tropicalTrue: { lon: tropTrue, lat: p.latitude },
            lahiriIae: { lon: lahiriIaeSidereal(tropTrue, jdUt), lat: p.latitude },
            nodeJhoraLahiri: sid ? { lon: sid.longitude, lat: sid.latitude } : undefined,
        };
    }
    const meanRahuT = meanNodeTrop.find((p) => p.name === 'Rahu');
    const meanRahuS = meanNodeSid.find((p) => p.name === 'Rahu');
    if (meanRahuT) {
        const tropTrue = toTropicalTrue(meanRahuT.longitude, dpsi, 'meanNode');
        out.MeanNode = {
            tropicalTrue: { lon: tropTrue, lat: meanRahuT.latitude },
            lahiriIae: { lon: lahiriIaeSidereal(tropTrue, jdUt), lat: meanRahuT.latitude },
            nodeJhoraLahiri: meanRahuS
                ? { lon: meanRahuS.longitude, lat: meanRahuS.latitude }
                : undefined,
        };
    }
    return out;
}

function astronomyEngineSample(jdUt, lahiriIaeAyan) {
    const Astronomy = require('astronomy-engine');
    const time = new Astronomy.AstroTime(jdUt);
    const bodies = [
        ['Sun', Astronomy.Body.Sun],
        ['Moon', Astronomy.Body.Moon],
        ['Mercury', Astronomy.Body.Mercury],
        ['Venus', Astronomy.Body.Venus],
        ['Mars', Astronomy.Body.Mars],
        ['Jupiter', Astronomy.Body.Jupiter],
        ['Saturn', Astronomy.Body.Saturn],
        ['Uranus', Astronomy.Body.Uranus],
        ['Neptune', Astronomy.Body.Neptune],
        ['Pluto', Astronomy.Body.Pluto],
    ];
    const out = {};
    for (const [name, body] of bodies) {
        const ecl = Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true));
        const tropLon = wrap360(ecl.elon);
        const tropLat = ecl.elat;
        out[name] = {
            tropicalTrue: { lon: tropLon, lat: tropLat },
            lahiriIae: { lon: lahiriIaeSidereal(tropLon, jdUt), lat: tropLat },
        };
    }
    return out;
}

function astronomiaSample(jdUt) {
    const planet = require('astronomia/planet');
    const moonposition = require('astronomia/moonposition');
    const base = require('astronomia/base');
    const j2000 = 2451545.0;
    const T = (jdUt - j2000) / 36525;
    const out = {};
    const ear = planet.position.planet('earth', T);
    const sunLon = wrap360((base.pmod(ear.lon + Math.PI, 2 * Math.PI) * 180) / Math.PI);
    out.Sun = {
        tropicalTrue: { lon: sunLon, lat: (ear.lat * 180) / Math.PI },
        lahiriIae: {
            lon: lahiriIaeSidereal(sunLon, jdUt),
            lat: (ear.lat * 180) / Math.PI,
        },
    };
    const moon = moonposition.position(jdUt);
    out.Moon = {
        tropicalTrue: { lon: wrap360(moon.lon), lat: moon.lat },
        lahiriIae: { lon: lahiriIaeSidereal(moon.lon, jdUt), lat: moon.lat },
    };
    for (const [name, key] of [
        ['Mercury', 'mercury'],
        ['Venus', 'venus'],
        ['Mars', 'mars'],
        ['Jupiter', 'jupiter'],
        ['Saturn', 'saturn'],
    ]) {
        const pos = planet.position.planet(key, T);
        const lon = wrap360((pos.lon * 180) / Math.PI);
        const lat = (pos.lat * 180) / Math.PI;
        out[name] = {
            tropicalTrue: { lon, lat },
            lahiriIae: { lon: lahiriIaeSidereal(lon, jdUt), lat },
        };
    }
    return out;
}

async function main() {
    const epochsPath = process.argv[2];
    const outPath = process.argv[3];
    const deltaTMode = process.argv[4] ?? 'shared';

    const epochs = JSON.parse(readFileSync(epochsPath, 'utf8'));
    const deltat = JSON.parse(readFileSync(join(BENCH_ROOT, 'lib/deltat.json'), 'utf8')).samples;

    const engine = EphemerisEngine.getInstance();
    await registerNodeBspLoaderFromCore();
    await engine.initialize();

    const samples = [];

    for (const entry of epochs) {
        const jdUt = entry.jdUt;
        const sharedDeltaT = deltaTMode === 'shared' ? lookupDeltaT(jdUt, deltat) : undefined;
        try {
            const nj = await nodeJhoraSample(jdUt, deltaTMode, sharedDeltaT, engine);
            for (const [body, coords] of Object.entries(nj)) {
                samples.push({
                    jdUt,
                    body,
                    library: 'node-jhora',
                    deltaTMode,
                    ...coords,
                });
            }
        } catch (err) {
            samples.push({ jdUt, library: 'node-jhora', error: String(err) });
        }

        try {
            const ae = astronomyEngineSample(jdUt);
            for (const [body, coords] of Object.entries(ae)) {
                samples.push({ jdUt, body, library: 'astronomy-engine', deltaTMode, ...coords });
            }
        } catch (err) {
            samples.push({ jdUt, library: 'astronomy-engine', error: String(err) });
        }

        try {
            const ast = astronomiaSample(jdUt);
            for (const [body, coords] of Object.entries(ast)) {
                samples.push({ jdUt, body, library: 'astronomia', deltaTMode, ...coords });
            }
        } catch (err) {
            samples.push({ jdUt, library: 'astronomia', error: String(err) });
        }
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({ deltaTMode, samples }, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
