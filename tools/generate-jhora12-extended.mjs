#!/usr/bin/env node
/**
 * Append reference-chart regression exports (D9, D10, panchanga, dasha) to jhora_golden.ts.
 * Values are engine output at main after D1 matches JHora — not additional JHora transcription.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(
    new URL('../packages/core/node_modules/luxon/package.json', import.meta.url),
);
const { DateTime } = require('luxon');

import { registerNodeBspLoaderFromCore } from '../packages/core/node/register.mjs';

await registerNodeBspLoaderFromCore();

const { EphemerisEngine } = await import('../packages/core/dist/engine/ephemeris.js');
const { calculatePanchanga } = await import('../packages/core/dist/vedic/panchanga.js');
const { calculateVarga } = await import('../packages/core/dist/vedic/vargas.js');
const { generateVimshottari } = await import('../packages/prediction/dist/dasha.js');

const goldenPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../packages/core/tests/fixtures/jhora_golden.ts',
);

const REF = {
    utc: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 },
    lat: 51.476852,
    lon: -0.0005,
};

function d9(l) {
    const v = calculateVarga(l, 9);
    return { sign: v.sign, longitude: v.longitude };
}

function d10(l) {
    const v = calculateVarga(l, 10, { dasamsaScheme: 'jhora_5_8' });
    return { sign: v.sign, longitude: v.longitude };
}

const engine = EphemerisEngine.getInstance();
await engine.initialize();
engine.setAyanamsa(27);
const dt = DateTime.fromObject(REF.utc, { zone: 'utc' });
const jd = engine.julday(dt);
const planets = engine.getPlanets(dt);
const asc = engine.getHouses(jd, REF.lat, REF.lon, 'W', true).ascendant;
const bodyLon = (n) => planets.find((p) => p.name === n).longitude;

const bodies = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const d1Bodies = bodies.map((name) => {
    const p = planets.find((x) => x.name === name);
    return {
        name,
        sign: Math.floor(p.longitude / 30) + 1,
        longitude: p.longitude,
        retrograde: p.speed < 0,
    };
});

const d9Bodies = d1Bodies.map((b) => ({ name: b.name, ...d9(bodyLon(b.name)) }));
const d10Bodies = d1Bodies.map((b) => ({ name: b.name, ...d10(bodyLon(b.name)) }));
const d9Asc = d9(asc);
const d10Asc = d10(asc);

const local = dt.setZone('UTC');
const pa = calculatePanchanga(bodyLon('Sun'), bodyLon('Moon'), local);
const dasha = generateVimshottari(local, bodyLon('Moon'), 1);

const localSt = (engine.getSiderealTime(jd) + REF.lon / 15 + 24) % 24;

const pctLeft = (elapsed) => {
    const v = 100 - elapsed;
    return Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
};

const evenSignBodies = d1Bodies.filter((b) => b.sign % 2 === 0).map((b) => b.name);

const block = `
// ---------------------------------------------------------------------------
// Reference chart (Greenwich J2000) — varga / panchanga / dasha regression
// Engine snapshot; D1 for this chart is pinned to JHora screen transcription above.
// ---------------------------------------------------------------------------

export const JHORA_SIDEREAL_TIME = {
    printed: 'engine@main',
    hours: ${localSt},
    toleranceSeconds: 2,
} as const;

export const JHORA_D9 = ${JSON.stringify(
    d9Bodies.map((b) => ({
        name: b.name,
        printed: 'engine@main',
        sign: b.sign,
        longitude: b.longitude,
        toleranceArcsec: b.name === 'Rahu' || b.name === 'Ketu' ? 18 : 9,
    })),
    null,
    4,
)} as const;

export const JHORA_D9_ASCENDANT = {
    printed: 'engine@main',
    sign: ${d9Asc.sign},
    longitude: ${d9Asc.longitude},
    toleranceArcsec: 9,
} as const;

export const JHORA_PANCHANGA = {
    tithi: { name: ${JSON.stringify(pa.tithi.name)}, index: ${pa.tithi.index}, percentLeft: ${pctLeft(pa.tithi.percent)} },
    nakshatra: { name: ${JSON.stringify(pa.nakshatra.name)}, index: ${pa.nakshatra.index}, pada: ${pa.nakshatra.pada}, percentLeft: ${pctLeft(pa.nakshatra.percent)} },
    yoga: { name: ${JSON.stringify(pa.yoga.name)}, percentLeft: ${pctLeft(pa.yoga.percent ?? 0)} },
    karana: { name: ${JSON.stringify(pa.karana.name)}, percentLeft: ${pctLeft(pa.karana.percent ?? 0)} },
    vara: { name: ${JSON.stringify(pa.vara.name)}, index: ${pa.vara.index} },
    tolerancePercent: 0.02,
} as const;

export const JHORA_DASHA = {
    startLord: ${JSON.stringify(dasha[0]?.planet ?? 'Sun')},
    boundaries: ${JSON.stringify(
        dasha.slice(0, 9).map((m) => ({ lord: m.planet, endsOn: m.end.toISODate() })),
        null,
        8,
    )},
    toleranceDays: 3,
} as const;

export const JHORA_D10_SCHEME = 'jhora_5_8' as const;
export const JHORA_D10_LABEL = 'D-10 (5-8)';

export const JHORA_D10 = ${JSON.stringify(
    d10Bodies.map((b) => ({
        name: b.name,
        printed: 'engine@main',
        sign: b.sign,
        longitude: b.longitude,
        toleranceArcsec: b.name === 'Rahu' || b.name === 'Ketu' ? 20 : 10,
    })),
    null,
    4,
)} as const;

export const JHORA_D10_ASCENDANT = {
    printed: 'engine@main',
    sign: ${d10Asc.sign},
    longitude: ${d10Asc.longitude},
    toleranceArcsec: 10,
} as const;

export const JHORA_D10_EVEN_SIGN_BODIES = ${JSON.stringify(evenSignBodies)} as const;
`;

let text = readFileSync(goldenPath, 'utf8');
if (text.includes('JHORA_SIDEREAL_TIME')) {
    text = text.replace(/\n\/\/ -+\n\/\/ Reference chart[\s\S]*$/m, '');
}
writeFileSync(goldenPath, text.trimEnd() + block + '\n', 'utf8');
console.log('Appended extended regression exports');
