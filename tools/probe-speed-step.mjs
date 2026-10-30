#!/usr/bin/env node
/**
 * Sweep symmetric-difference step h (days) vs oracle speed pins (case 48).
 * Tropical TRUEPOS longitude FD; Moon uses engine analytic for reference.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { DateTime } = await imp('packages/core/node_modules/luxon/src/luxon.js');
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const { NAIF } = await imp('packages/core/dist/engine/spk.js');
const { withDeltaTContext } = await imp('packages/core/dist/engine/deltat.js');
const { registerNodeBspLoaderFromCore } = await imp('packages/core/node/register.mjs');
await registerNodeBspLoaderFromCore();

const ORACLE = {
    jhora: {
        Sun: 0.993948553849,
        Moon: 14.096165650297,
        Mercury: -0.179299969596,
        Venus: 1.213823043018,
        Mars: 0.621580664947,
        Jupiter: -0.066960736907,
        Saturn: -0.061057993027,
        Rahu: 0.000711084031,
    },
    modern: {
        Sun: 0.9939102766857663,
        Moon: 14.09612747272103,
        Mercury: -0.179338248119906,
        Venus: 1.213784765841571,
        Mars: 0.6215423877720735,
        Jupiter: -0.06699901411383506,
        Saturn: -0.06109627021567726,
        Rahu: 0.0006728534517570731,
    },
};

const dt = DateTime.utc(2000, 10, 19, 21, 49, 15);
const loc = { latitude: 12.7843, longitude: -101.8386 };
const eph = EphemerisEngine.getInstance();
await eph.initialize();
const jd0 = eph.julday(dt);

const { getAyanamsa } = await imp('packages/core/dist/engine/ayanamsa.js');
function tropicalLonSync(profile, jdUT, body) {
    return withDeltaTContext({ profile }, () => {
        const ps = eph.getPlanets(dt, loc, {
            ayanamsaOrder: 27,
            nodeType: 'true',
            precisionProfile: profile,
            positionMode: 'geometric',
            julianDayUt: jdUT,
        });
        const p = ps.find((x) => x.name === body);
        const ayan = getAyanamsa(27, jdUT, 'geometric');
        return p.longitude + ayan;
    });
}

function centralDiff(fn, jd, h) {
    let d = fn(jd + h) - fn(jd - h);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d / (2 * h);
}

const steps = [1e-4, 2.5e-4, 5e-4, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1];
const bodies = ['Sun', 'Moon', 'Mercury', 'Mars', 'Rahu'];

for (const profile of ['jhora', 'modern']) {
    console.log(`\n### ${profile} — max |oracle − FD(tropical)| (″/day)`);
    console.log('step_d'.padEnd(10), ...bodies.map((b) => b.padStart(8)));
    for (const h of steps) {
        const errs = bodies.map((body) => {
            const o = ORACLE[profile][body];
            const fd = centralDiff((jd) => tropicalLonSync(profile, jd, body), jd0, h);
            return Math.abs(o - fd) * 3600;
        });
        console.log(h.toExponential(2).padEnd(10), ...errs.map((e) => e.toFixed(4).padStart(8)));
    }
    const eng = withDeltaTContext({ profile }, () =>
        eph.getPlanets(dt, loc, {
            ayanamsaOrder: 27,
            nodeType: 'true',
            precisionProfile: profile,
            positionMode: 'geometric',
        }),
    );
    console.log('engine reported:');
    for (const body of bodies) {
        const p = eng.find((x) => x.name === body);
        const o = ORACLE[profile][body];
        console.log(`  ${body}: ${(Math.abs(p.speed - o) * 3600).toFixed(4)}″/d`);
    }
}
