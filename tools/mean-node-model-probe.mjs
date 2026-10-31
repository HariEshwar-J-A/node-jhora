#!/usr/bin/env node
/** Probe published W3 models vs lunar-node-oracle (not for CI). */
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
const { julianCenturies, mod360 } = await imp('packages/core/dist/engine/coordinates.js');
const { meanObliquity, precessionMatrix, rotateX, matVec, icrfToMeanEclipticOfDate, toSpherical } =
    await imp('packages/core/dist/engine/precession.js');

const fixture = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/core/tests/fixtures/lunar-node-oracle.json'), 'utf8'),
);

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

function w3ArcsecPoly(t, c) {
    return c[0] + c[1] * t + c[2] * t * t + c[3] * t ** 3 + c[4] * t ** 4;
}

/** W3 on J2000 mean ecliptic → tropical lon on Vondrák mean ecliptic of date. */
function w3ToMeanEclipticOfDate(w3Deg, T, jdTT) {
    const lam = w3Deg * (Math.PI / 180);
    const obl0 = meanObliquity(0, 2451545.0) * (Math.PI / 180);
    const v = [Math.cos(lam), Math.cos(obl0) * Math.sin(lam), Math.sin(obl0) * Math.sin(lam)];
    return toSpherical(icrfToMeanEclipticOfDate(v, T, jdTT)).lon;
}

const MODELS = {
    meeus: (T) => meanLunarNode(T),
    elp82b: (T) =>
        mod360(
            w3ArcsecPoly(T, [450160.39816, -6967919.3622, 6.3622, 0.007625, -0.00003586]) / 3600,
        ),
    chapront2002: (T) =>
        mod360(
            w3ArcsecPoly(T, [450160.003265, -6967919.008851, 6.003593, 0.00007625, -0.0000003586]) /
                3600,
        ),
    mpp02_de406: (T) => {
        const w = [
            450160.39816 - 0.07215,
            -6967919.5383 - 0.04317,
            6.359 - 0.0026107,
            0.007625 - 0.00010712,
            -0.00003586,
        ];
        return mod360(w3ArcsecPoly(T, w) / 3600);
    },
};

const eng = EphemerisEngine.getInstance();
await eng.initialize();

const years = [-10000, -5000, -2000, 0, 2000, 2026, 3000, 10000];
console.log('Sidereal mean node |error| vs jhora oracle (arcsec)\n');
console.log('year     meeus   elp82b  ch2002  mpp02   elp+prec');
for (const y of years) {
    const c = fixture.cases.find((x) => x.y === y);
    if (!c) continue;
    const jd = c.jd;
    const jdTT = jd + deltaT(jd) / 86400;
    const T = julianCenturies(jdTT);
    const ayan = eng.getAyanamsa(jd, 27, 0, 'geometric');
    const oracle = c.jhora.mean.lon;
    const row = [String(y).padStart(6)];
    for (const name of ['meeus', 'elp82b', 'chapront2002', 'mpp02_de406']) {
        const trop = MODELS[name](T);
        const sid = mod360(trop - ayan);
        row.push(gapArcsec(sid, oracle).toFixed(2).padStart(8));
    }
    const w3 = mod360(
        w3ArcsecPoly(T, [450160.39816, -6967919.3622, 6.3622, 0.007625, -0.00003586]) / 3600,
    );
    const tropP = w3ToMeanEclipticOfDate(w3, T, jdTT);
    const sidP = mod360(tropP - ayan);
    row.push(gapArcsec(sidP, oracle).toFixed(2).padStart(10));
    console.log(row.join(''));
}
