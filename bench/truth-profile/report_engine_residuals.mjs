/**
 * Report engine vs truth_profile_erfa.json residuals (bench-only).
 * Run from repo root after `pnpm --filter @node-jhora/core build`.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EphemerisEngine } from '../../packages/core/dist/engine/ephemeris.js';
import { getGAST } from '../../packages/core/dist/engine/coordinates.js';
import { withDeltaTContext } from '../../packages/core/dist/engine/deltat.js';
import { parseEopBin } from '../../packages/eop/index.mjs';
import { registerNodeBspLoaderFromCore } from '../../packages/core/node/register.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'packages/core/package.json'));
const { DateTime } = require('luxon');
const FIXTURE = JSON.parse(
    readFileSync(join(root, 'packages/core/tests/fixtures/truth_profile_erfa.json'), 'utf8'),
);

const JOIN_MIN = 2305448.0;
const JOIN_MAX = 2524594.0;
const CHENNAI = { lat: 13.0827, lon: 80.2707 };

function deltaArcsec(a, b) {
    let d = a - b;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

function maxUpdate(map, key, val) {
    const prev = map.get(key) ?? 0;
    if (val > prev) map.set(key, val);
}

const eopBytes = readFileSync(join(root, 'packages/eop/eop.bin'));
const engine = EphemerisEngine.getInstance();
engine.setIersEopTable(parseEopBin(eopBytes));
await registerNodeBspLoaderFromCore();
await engine.initialize();

const maxByQty = new Map();
const rows = [];

for (const c of FIXTURE.cases) {
    const utc = DateTime.fromMillis((c.jdUt - 2440587.5) * 86400000, { zone: 'utc' });
    const opts = {
        precisionProfile: 'truth',
        deltaTOverrideSeconds: c.deltaTSeconds,
        zodiac: 'tropical',
        positionMode: 'apparent',
        includeOuterPlanets: true,
        nodeType: 'true',
        julianDayUt: c.jdUt,
    };
    const jdTT = c.jdUt + c.deltaTSeconds / 86400;
    const inJoin = jdTT >= JOIN_MIN && jdTT <= JOIN_MAX;
    const planets = engine.getPlanets(utc, undefined, opts);

    for (const [name, exp] of Object.entries(c.bodies)) {
        const got = planets.find((p) => p.name === name);
        const dLon = deltaArcsec(got.longitude, exp.lon);
        const dLat = Math.abs((got.latitude - exp.lat) * 3600);
        maxUpdate(maxByQty, `${name} λ`, dLon);
        maxUpdate(maxByQty, `${name} β`, dLat);
        rows.push({ case: c.id, qty: `${name} λ`, arcsec: dLon, inJoin });
        rows.push({ case: c.id, qty: `${name} β`, arcsec: dLat, inJoin });
    }

    if (c.speedsDegPerDay && inJoin) {
        for (const [name, expSpeed] of Object.entries(c.speedsDegPerDay)) {
            const got = planets.find((p) => p.name === name);
            const d = Math.abs(got.speed - expSpeed) * 3600;
            maxUpdate(maxByQty, `${name} speed`, d);
            rows.push({ case: c.id, qty: `${name} speed ″/d`, arcsec: d, inJoin });
        }
    }

    const meanNode = engine
        .getPlanets(utc, undefined, { ...opts, nodeType: 'mean' })
        .find((p) => p.name === 'Rahu');
    const trueNode = planets.find((p) => p.name === 'Rahu');
    maxUpdate(maxByQty, 'mean node λ', deltaArcsec(meanNode.longitude, c.meanNodeDeg));
    maxUpdate(maxByQty, 'true node λ', deltaArcsec(trueNode.longitude, c.trueNodeDeg));
    rows.push({
        case: c.id,
        qty: 'mean node λ',
        arcsec: deltaArcsec(meanNode.longitude, c.meanNodeDeg),
        inJoin,
    });
    rows.push({
        case: c.id,
        qty: 'true node λ',
        arcsec: deltaArcsec(trueNode.longitude, c.trueNodeDeg),
        inJoin,
    });

    const gast = withDeltaTContext({ profile: 'truth', overrideSeconds: c.deltaTSeconds }, () =>
        getGAST(c.jdUt, 'truth'),
    );
    const dGast = deltaArcsec(gast, c.gastDeg);
    maxUpdate(maxByQty, 'GAST', dGast);
    rows.push({ case: c.id, qty: 'GAST', arcsec: dGast, inJoin });

    if (inJoin && (c.chennaiAscDeg !== undefined || c.chennaiMcDeg !== undefined)) {
        const houses = engine.getHouses(
            c.jdUt,
            CHENNAI.lat,
            CHENNAI.lon,
            'W',
            false,
            undefined,
            0,
            undefined,
            {
                precisionProfile: 'truth',
                deltaTOverrideSeconds: c.deltaTSeconds,
            },
        );
        if (c.chennaiAscDeg !== undefined) {
            const d = deltaArcsec(houses.ascendant, c.chennaiAscDeg);
            maxUpdate(maxByQty, 'Chennai asc', d);
            rows.push({ case: c.id, qty: 'Chennai asc', arcsec: d, inJoin });
        }
        if (c.chennaiMcDeg !== undefined) {
            const d = deltaArcsec(houses.mc, c.chennaiMcDeg);
            maxUpdate(maxByQty, 'Chennai MC', d);
            rows.push({ case: c.id, qty: 'Chennai MC', arcsec: d, inJoin });
        }
    }
}

console.log('=== Max residuals (in-window cases only where applicable) ===');
const inWindowKeys = [
    'Sun λ',
    'Moon λ',
    'Pluto λ',
    'Neptune λ',
    'GAST',
    'Chennai asc',
    'Chennai MC',
    'Sun speed',
    'Moon speed',
    'mean node λ',
    'true node λ',
];
for (const k of inWindowKeys) {
    const v = maxByQty.get(k);
    if (v !== undefined) console.log(`${k.padEnd(16)} ${v.toExponential(4)}″`);
}
console.log('\n=== Per-case (in-window quantities, arcsec) ===');
const byCase = new Map();
for (const r of rows) {
    if (!r.inJoin) continue;
    if (!byCase.has(r.case)) byCase.set(r.case, []);
    byCase.get(r.case).push(r);
}
for (const [id, rs] of byCase) {
    const parts = rs.map((r) => `${r.qty}=${r.arcsec.toExponential(3)}`).join(', ');
    console.log(`${id}: ${parts}`);
}
