#!/usr/bin/env node
/**
 * Full-range chart sweep vs nj-fullrange-oracle-kit using the ChartSession path
 * (same as HTTP /v1/chart): julianDayUt from civil resolver, precision profile on
 * planets and houses. M/Mo vs oracle_modern; J/Jo vs oracle_jhora.
 *
 * Usage: NJCE_DIR=… node tools/fullrange-chart-sweep.mjs [kitDir] [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const KIT = path.resolve(process.argv[2] || '/tmp/oracle-kit');
const ROOT = path.resolve(process.argv[3] || process.cwd());
const CHUNKS = process.env.NJCE_DIR || '/workspace/ephe-data/njce';

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

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

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

function initEra() {
    return {
        st: 0,
        armc: 0,
        asc: 0,
        mc: 0,
        cusps: 0,
        vertex: 0,
        ayan: 0,
        Moon: 0,
        n: 0,
    };
}

const HOUSE_MAP = {
    W: 'WholeSign',
    E: 'Equal',
    P: 'Placidus',
    O: 'Porphyry',
};

if (!fs.existsSync(path.join(KIT, 'cases.json'))) {
    console.error(`fullrange-chart-sweep: missing kit at ${KIT}`);
    process.exit(2);
}
if (!fs.existsSync(CHUNKS)) {
    console.error(`fullrange-chart-sweep: NJCE_DIR missing: ${CHUNKS}`);
    process.exit(2);
}

const { DateTime } = await imp('packages/core/node_modules/luxon/src/luxon.js');
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const { ChartSession } = await imp('packages/engine/dist/chart-session.js');
const prov = await imp('packages/core/dist/engine/provider/index.js');

const cases = JSON.parse(fs.readFileSync(path.join(KIT, 'cases.json'), 'utf8'));
const OJ = JSON.parse(fs.readFileSync(path.join(KIT, 'oracle_jhora.json'), 'utf8'));
const OM = JSON.parse(fs.readFileSync(path.join(KIT, 'oracle_modern.json'), 'utf8'));

const store = new prov.De431ChunkStore(prov.nodeFsChunkLoader(CHUNKS));
const e = new EphemerisEngine();
e.setChunkStore(store);
await e.initialize({
    kernel: new Uint8Array(fs.readFileSync(path.join(ROOT, 'packages/ephe/de440s.bsp'))),
});

const MODES = {
    J: { profile: 'jhora', inject: false, oracle: OJ },
    Jo: { profile: 'jhora', inject: true, oracle: OJ },
    M: { profile: 'modern', inject: false, oracle: OM },
    Mo: { profile: 'modern', inject: true, oracle: OM },
};

/** @type {Record<string, Record<string, ReturnType<typeof initEra>>>} */
const max = {};
for (const mode of Object.keys(MODES)) max[mode] = {};

for (const c of cases) {
    const er = eraLabel(c.y);
    const dt = DateTime.fromObject(
        { year: c.y, month: c.m, day: c.d, hour: c.H, minute: c.M, second: c.S },
        { zone: 'utc' },
    );
    const jdUt = c.jdUT ?? c.jd;

    for (const [mode, spec] of Object.entries(MODES)) {
        const oracle = spec.oracle[String(c.id)] ?? spec.oracle[c.id];
        if (!oracle) continue;
        max[mode][er] = max[mode][er] || initEra();
        max[mode][er].n++;

        const settings = {
            schemaVersion: 1,
            ayanamsa: 'true_citra',
            precisionProfile: spec.profile,
            ...(spec.inject && oracle.deltaT !== undefined
                ? { deltaTOverrideSeconds: oracle.deltaT }
                : {}),
        };

        let session;
        try {
            session = new ChartSession({
                instant: dt,
                julianDayUt: jdUt,
                location: { latitude: c.lat, longitude: c.lon },
                settings,
                ephemeris: e,
            });
        } catch (err) {
            console.error(`case ${c.id} mode ${mode}: ${err}`);
            continue;
        }

        const ayanGot = e.getAyanamsa(jdUt, 27, 0, undefined, {
            precisionProfile: spec.profile,
            ...(spec.inject && oracle.deltaT !== undefined
                ? { deltaTOverrideSeconds: oracle.deltaT }
                : {}),
        });
        if (oracle.ayan !== undefined) {
            max[mode][er].ayan = Math.max(max[mode][er].ayan, gapArcsec(ayanGot, oracle.ayan));
        }

        const moonGot = session.getPlanets().find((p) => p.name === 'Moon')?.longitude;
        if (moonGot !== undefined && oracle.bodies?.Moon !== undefined) {
            max[mode][er].Moon = Math.max(
                max[mode][er].Moon,
                gapArcsec(moonGot, oracle.bodies.Moon),
            );
        }

        const stGot = (e.getSiderealTime(jdUt) + c.lon / 15) % 24;
        const stOracle =
            oracle.siderealTimeHours ??
            oracle.stHours ??
            (oracle.st !== undefined ? oracle.st / 3600 : undefined);
        if (stOracle !== undefined) {
            let d = Math.abs(stGot - stOracle) * 3600;
            if (d > 12 * 3600) d = 24 * 3600 - d;
            max[mode][er].st = Math.max(max[mode][er].st, d);
        }

        for (const [code, method] of Object.entries(HOUSE_MAP)) {
            const oh = oracle.houses?.[code];
            if (!oh) continue;
            const s = new ChartSession({
                instant: dt,
                julianDayUt: jdUt,
                location: { latitude: c.lat, longitude: c.lon },
                settings,
                ephemeris: e,
                houseSystemOverride: method,
            });
            const h = s.getHouses();
            if (oh.asc !== undefined) {
                max[mode][er].asc = Math.max(max[mode][er].asc, gapArcsec(h.ascendant, oh.asc));
            }
            if (oh.mc !== undefined) {
                max[mode][er].mc = Math.max(max[mode][er].mc, gapArcsec(h.mc, oh.mc));
            }
            if (oh.armc !== undefined) {
                max[mode][er].armc = Math.max(max[mode][er].armc, gapArcsec(h.armc, oh.armc));
            }
            if (oh.vertex !== undefined && h.vertex !== undefined) {
                max[mode][er].vertex = Math.max(
                    max[mode][er].vertex,
                    gapArcsec(h.vertex, oh.vertex),
                );
            }
            if (oh.cusps) {
                for (let i = 0; i < 12; i++) {
                    max[mode][er].cusps = Math.max(
                        max[mode][er].cusps,
                        gapArcsec(h.cusps[i], oh.cusps[i]),
                    );
                }
            }
        }
    }
}

console.log(
    JSON.stringify(
        {
            kit: KIT,
            cases: cases.length,
            path: 'ChartSession (HTTP chart parity)',
            maxArcsecByEra: max,
        },
        null,
        2,
    ),
);
