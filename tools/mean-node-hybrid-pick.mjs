#!/usr/bin/env node
/** Pick Meeus vs ELP+DE441 hybrid year bounds from lunar-node-oracle fixture. */
import fs from 'node:fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { registerNodeBspLoaderFromCore } = await imp('packages/core/node/register.mjs');
registerNodeBspLoaderFromCore();
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const { meanLunarNodeMeeus, meanLunarNodeElpCorrectedTropical } = await imp(
    'packages/core/dist/engine/mean-lunar-node.js',
);
const { deltaT } = await imp('packages/core/dist/engine/deltat.js');
const { julianCenturies, mod360 } = await imp('packages/core/dist/engine/coordinates.js');

const fixture = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/core/tests/fixtures/lunar-node-oracle.json'), 'utf8'),
);

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

const eng = EphemerisEngine.getInstance();
await eng.initialize();

let elpWins = 0;
let meeusWins = 0;
const byEra = {};

for (const c of fixture.cases) {
    const jd = c.jd;
    const jdTT = jd + deltaT(jd) / 86400;
    const T = julianCenturies(jdTT);
    const ayan = eng.getAyanamsa(jd, 27, 0, 'geometric');
    const sidM = mod360(meanLunarNodeMeeus(T) - ayan);
    const sidE = mod360(meanLunarNodeElpCorrectedTropical(jdTT) - ayan);
    const o = c.jhora.mean.lon;
    const eM = gapArcsec(sidM, o);
    const eE = gapArcsec(sidE, o);
    if (eE < eM) elpWins++;
    else meeusWins++;
    const era = Math.floor(c.y / 500) * 500;
    byEra[era] ??= { elp: 0, meeus: 0, maxM: 0, maxE: 0 };
    byEra[era].maxM = Math.max(byEra[era].maxM, eM);
    byEra[era].maxE = Math.max(byEra[era].maxE, eE);
    if (eE < eM) byEra[era].elp++;
    else byEra[era].meeus++;
}

console.log('cases elp wins', elpWins, 'meeus wins', meeusWins);
for (const era of Object.keys(byEra).sort((a, b) => Number(a) - Number(b))) {
    const x = byEra[era];
    console.log(
        `era ${era}: maxM=${x.maxM.toFixed(2)} maxE=${x.maxE.toFixed(2)} elpWins=${x.elp} meeusWins=${x.meeus}`,
    );
}
