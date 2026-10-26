#!/usr/bin/env node
/**
 * Speed-only sweep vs nj-fullrange-oracle-kit (Jo/Mo = oracle ΔT injected).
 *
 * Usage: node tools/speed-sweep.mjs [kitDir] [repoRoot]
 *
 * Requires NJCE_DIR (default /workspace/ephe-data/njce) with DE431 .njce chunks.
 * Exits non-zero if any case throws or if enforced modes exceed NJ_SPEED_LIMIT_ARCSEC_PER_DAY (default 1).
 * Mode M (native modern ΔT) is enforced only when |ΔT_engine − ΔT_oracle| ≤ 1 s; otherwise speeds are not
 * comparable to oracle_modern (Mo covers oracle-ΔT modern). J/Jo/Mo are enforced on every case.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const KIT = path.resolve(process.argv[2] || '/tmp/oracle-kit');
const ROOT = path.resolve(process.argv[3] || process.cwd());
const CHUNKS = process.env.NJCE_DIR || '/workspace/ephe-data/njce';
const LIMIT_ARCSEC_DAY = Number(process.env.NJ_SPEED_LIMIT_ARCSEC_PER_DAY ?? '1');
const ENFORCE_MODES = (process.env.NJ_SPEED_MODES ?? 'J,Jo,M,Mo').split(',').map((s) => s.trim());
/** Native modern ΔT must agree with oracle_modern before M speeds are enforced. */
const M_DELTA_T_MATCH_SEC = Number(process.env.NJ_SPEED_M_DELTA_T_MATCH_SEC ?? '1');

if (!fs.existsSync(CHUNKS)) {
    console.error(`speed-sweep: NJCE_DIR missing or not found: ${CHUNKS}`);
    process.exit(2);
}

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { DateTime } = await imp('packages/core/node_modules/luxon/src/luxon.js');
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const { withDeltaTContext, deltaT } = await imp('packages/core/dist/engine/deltat.js');
const prov = await imp('packages/core/dist/engine/provider/index.js');

const cases = JSON.parse(fs.readFileSync(path.join(KIT, 'cases.json'), 'utf8'));
const OJ = JSON.parse(fs.readFileSync(path.join(KIT, 'oracle_jhora.json'), 'utf8'));
const OM = JSON.parse(fs.readFileSync(path.join(KIT, 'oracle_modern.json'), 'utf8'));

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
    [5000, 10000],
];
const eraLabel = (y) => {
    for (const [a, b] of ERAS) {
        if (a <= y && y < b) return `${a > -10001 ? a : -10000}..${b}`;
    }
    return '?';
};

const store = new prov.De431ChunkStore(prov.nodeFsChunkLoader(CHUNKS));
const need = new Set();
for (const c of cases) {
    for (const o of [-2, 0, 2]) {
        need.add(c.jd + OJ[c.id].deltaT / 86400 + o);
        need.add(c.jd + OM[c.id].deltaT / 86400 + o);
    }
}
console.error(
    `speed-sweep: preloading ${need.size} Julian epochs into DE431 chunks from ${CHUNKS}…`,
);
for (const jd of need) {
    await store.ensureForJd(jd);
}

const e = new EphemerisEngine();
e.setChunkStore(store);
await e.initialize({
    kernel: new Uint8Array(fs.readFileSync(path.join(ROOT, 'packages/ephe/de440s.bsp'))),
});

const MODES = {
    J: (c) => ({ precisionProfile: 'jhora' }),
    Jo: (c) => ({ precisionProfile: 'jhora', deltaTOverrideSeconds: OJ[c.id].deltaT }),
    M: (c) => ({ precisionProfile: 'modern' }),
    Mo: (c) => ({ precisionProfile: 'modern', deltaTOverrideSeconds: OM[c.id].deltaT }),
};

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'TrueNode'];

/** @type {Record<string, Record<string, Record<string, number>>>} */
const max = {};
let evaluated = 0;
let mEnforcedCases = 0;
let mSkippedDeltaT = 0;
let maxMEnforcedArcsec = 0;
/** @type {{ mode: string; caseId: number; body: string; err: number; message?: string }[]} */
const violations = [];

for (const c of cases) {
    const dt = DateTime.fromObject(
        { year: c.y, month: c.m, day: c.d, hour: c.H, minute: c.M, second: c.S },
        { zone: 'utc' },
    );
    const er = eraLabel(c.y);
    const jdUt = e.julday(dt);
    const modernDeltaTNative = withDeltaTContext({ profile: 'modern' }, () => deltaT(jdUt));
    const modernDeltaTOracle = OM[c.id].deltaT;
    const modernDeltaTComparable =
        Math.abs(modernDeltaTNative - modernDeltaTOracle) <= M_DELTA_T_MATCH_SEC;
    for (const [mode, mk] of Object.entries(MODES)) {
        const oracle = mode.startsWith('J') ? OJ : OM;
        const P = mk(c);
        if (mode === 'M') {
            if (modernDeltaTComparable) mEnforcedCases++;
            else mSkippedDeltaT++;
        }
        let ps;
        try {
            ps = withDeltaTContext(
                { profile: P.precisionProfile, overrideSeconds: P.deltaTOverrideSeconds },
                () =>
                    e.getPlanets(
                        dt,
                        { latitude: c.lat, longitude: c.lon },
                        { ayanamsaOrder: 27, nodeType: 'true', ...P },
                    ),
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`speed-sweep: FAILED case id=${c.id} mode=${mode} y=${c.y}: ${message}`);
            process.exit(1);
        }
        evaluated++;
        for (const p of ps) {
            if (p.name === 'Ketu') continue;
            const key = p.name === 'Rahu' ? 'TrueNode' : p.name;
            if (!BODIES.includes(key)) continue;
            const err = Math.abs(p.speed - oracle[c.id].bodies[key].speed) * 3600;
            max[mode] = max[mode] || {};
            max[mode][er] = max[mode][er] || {};
            max[mode][er][key] = Math.max(max[mode][er][key] ?? 0, err);
            max[mode][er].all = Math.max(max[mode][er].all ?? 0, err);
            if (mode === 'M' && modernDeltaTComparable) {
                maxMEnforcedArcsec = Math.max(maxMEnforcedArcsec, err);
            }
            const enforce =
                ENFORCE_MODES.includes(mode) && (mode !== 'M' || modernDeltaTComparable);
            if (enforce && err > LIMIT_ARCSEC_DAY) {
                violations.push({ mode, caseId: c.id, body: key, err });
            }
        }
    }
}

/** @type {Record<string, number>} */
const globalMaxArcsecPerDay = {};
for (const [mode, eras] of Object.entries(max)) {
    let g = 0;
    for (const era of Object.values(eras)) {
        g = Math.max(g, era.all ?? 0);
    }
    globalMaxArcsecPerDay[mode] = g;
}

const summary = {
    evaluated,
    cases: cases.length,
    modes: Object.keys(MODES).length,
    limitArcsecPerDay: LIMIT_ARCSEC_DAY,
    enforceModes: ENFORCE_MODES,
    mEnforcedCases,
    mSkippedDeltaT,
    mDeltaTMatchSec: M_DELTA_T_MATCH_SEC,
    globalMaxArcsecPerDay,
    globalMaxEnforcedArcsecPerDay: { M: maxMEnforcedArcsec },
    max,
    violationCount: violations.length,
};
console.log(JSON.stringify(summary, null, 2));

if (violations.length > 0) {
    console.error(
        `speed-sweep: ${violations.length} speed violation(s) > ${LIMIT_ARCSEC_DAY}″/day (showing up to 20):`,
    );
    for (const v of violations.slice(0, 20)) {
        console.error(
            `  mode=${v.mode} case=${v.caseId} body=${v.body} err=${v.err.toFixed(4)}″/day`,
        );
    }
    process.exit(1);
}
