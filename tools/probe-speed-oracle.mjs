#!/usr/bin/env node
/**
 * Black-box probe: which differentiation model matches oracle speed pins?
 *
 * Without pyswisseph, compares engine-reported speed to symmetric differences
 * on sidereal longitude (1 s and 0.25 d) and tropical−ayan rate (modern).
 *
 * Usage: node tools/probe-speed-oracle.mjs
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { DateTime } = await imp('packages/core/node_modules/luxon/src/luxon.js');
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const { getAyanamsa } = await imp('packages/core/dist/engine/ayanamsa.js');
const { withDeltaTContext } = await imp('packages/core/dist/engine/deltat.js');
const { registerNodeBspLoaderFromCore } = await imp('packages/core/node/register.mjs');
await registerNodeBspLoaderFromCore();
/** Case 48 — nj-fullrange-oracle-kit (2000-10-19). */
const CASE = {
    y: Number(process.env.PROBE_YEAR ?? 2000),
    m: 10,
    d: 19,
    H: 21,
    M: 49,
    S: 15,
    lat: 12.7843,
    lon: -101.8386,
};
const HAS_ORACLE_PINS = CASE.y === 2000;

const ORACLE_JHORA = {
    Sun: 0.993948553849,
    Moon: 14.096165650297,
    Mercury: -0.179299969596,
    Venus: 1.213823043018,
    Mars: 0.621580664947,
    Jupiter: -0.066960736907,
    Saturn: -0.061057993027,
    Rahu: 0.000711084031,
};

const ORACLE_MODERN = {
    Sun: 0.9939102766857663,
    Moon: 14.09612747272103,
    Mercury: -0.179338248119906,
    Venus: 1.213784765841571,
    Mars: 0.6215423877720735,
    Jupiter: -0.06699901411383506,
    Saturn: -0.06109627021567726,
    Rahu: 0.0006728534517570731,
};

const BODIES = Object.keys(ORACLE_JHORA);

const eph = EphemerisEngine.getInstance();
await eph.initialize();

const dt = DateTime.fromObject(
    {
        year: CASE.y,
        month: CASE.m,
        day: CASE.d,
        hour: CASE.H,
        minute: CASE.M,
        second: CASE.S,
    },
    { zone: 'utc' },
);
const jd0 = eph.julday(dt);
const loc = { latitude: CASE.lat, longitude: CASE.lon };

function siderealLon(profile, jdUT, bodyName) {
    return withDeltaTContext({ profile }, () => {
        const ps = eph.getPlanets(dt, loc, {
            ayanamsaOrder: 27,
            nodeType: 'true',
            precisionProfile: profile,
            positionMode: 'geometric',
            julianDayUt: jdUT,
        });
        const p = ps.find((x) => x.name === bodyName);
        return p ? p.longitude : undefined;
    });
}

function centralDiff(fn, jd, h) {
    let d = fn(jd + h) - fn(jd - h);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d / (2 * h);
}

for (const profile of ['jhora', 'modern']) {
    const oracle = profile === 'jhora' ? ORACLE_JHORA : ORACLE_MODERN;
    const h1 = 1 / 86400;
    const h25 = 0.25;
    console.log(`\n=== profile ${profile} (case 48) ===`);
    console.log(
        'body'.padEnd(8),
        'oracle″/d',
        'eng″/d',
        'Δeng',
        'fd1s_sid',
        'fd025_sid',
        'Δfd1s',
        'Δfd025',
    );
    for (const body of BODIES) {
        const name = body;
        const o = HAS_ORACLE_PINS ? oracle[name] : undefined;
        const opts = {
            ayanamsaOrder: 27,
            nodeType: 'true',
            precisionProfile: profile,
            positionMode: 'geometric',
        };
        const reported = withDeltaTContext({ profile }, () => {
            const ps = eph.getPlanets(dt, loc, opts);
            return ps.find((x) => x.name === name).speed;
        });
        const lonFn = (jd) => siderealLon(profile, jd, name);
        const fd1 = centralDiff(lonFn, jd0, h1);
        const fd25 = centralDiff(lonFn, jd0, h25);
        const fmt = (x) => (o === undefined ? 'n/a' : (Math.abs(x - o) * 3600).toFixed(4));
        console.log(
            name.padEnd(8),
            o === undefined ? 'n/a'.padStart(10) : (o * 3600).toFixed(4).padStart(10),
            (reported * 3600).toFixed(4).padStart(10),
            fmt(reported).padStart(8),
            (fd1 * 3600).toFixed(4).padStart(10),
            (fd25 * 3600).toFixed(4).padStart(10),
            fmt(fd1).padStart(8),
            fmt(fd25).padStart(8),
        );
    }
    const ayanRate =
        (getAyanamsa(27, jd0 + h1, 'geometric') - getAyanamsa(27, jd0 - h1, 'geometric')) /
        (2 * h1);
    console.log(`ayanamsa rate (geometric, 1s): ${(ayanRate * 3600).toFixed(4)} ″/day`);
    console.log(
        `J−M oracle Sun gap: ${((ORACLE_JHORA.Sun - ORACLE_MODERN.Sun) * 3600).toFixed(4)} ″/day`,
    );
}
