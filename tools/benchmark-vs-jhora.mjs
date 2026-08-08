#!/usr/bin/env node
/**
 * benchmark-vs-jhora.mjs — Is node-jhora more accurate than JHora?
 *
 *   node tools/benchmark-vs-jhora.mjs
 *
 * ── Why this is not simply "diff the two programs" ──────────────────────────
 * Comparing node-jhora against JHora tells you they differ; it cannot tell you
 * which one is closer to the sky. That needs an independent referee, and the
 * referee here is JPL Horizons — the same JPL ephemeris that professional
 * astronomy uses, queried directly and cached below.
 *
 * ── Why the comparison is on separations, not longitudes ────────────────────
 * A sidereal longitude is `astrometry − ayanamsa`. The ayanamsa is a *choice*;
 * disagreeing about it is not an error. So every quantity here is an angular
 * separation between two bodies, in which any common zero-point offset cancels
 * exactly. What survives is pure astrometry — which is the only thing that can
 * be called right or wrong.
 *
 * Nutation also cancels (it is common to all bodies). Light-time and aberration
 * do NOT cancel, since they are body-specific; JHora's stored values are
 * therefore scored against whichever convention flatters them most.
 *
 * Source data: JHora's own legacy `.jhd` files, which embed the longitudes JHora
 * computed. Charts outside de440s coverage (pre-1849) are excluded.
 */

import { readdirSync, readFileSync } from 'fs';
import { join }                      from 'path';
import { DateTime }                  from 'luxon';

import { EphemerisEngine } from '../packages/core/dist/engine/ephemeris.js';
import { parseJhd, jhdToUtcISO } from '../packages/core/dist/io/jhd.js';

// ---------------------------------------------------------------------------
// JPL Horizons reference — apparent geocentric ecliptic longitude of date.
// Retrieved from https://ssd.jpl.nasa.gov/api/horizons.api
//   CENTER='500@399'  QUANTITIES='31'  TLIST_TYPE='JD'  (time tags in UT)
// ---------------------------------------------------------------------------

const HORIZONS = {
    '2398991.781250000': { Sun: 322.8008523, Moon:  42.5968876, Mercury: 333.2887517,
                           Venus: 283.5057165, Mars: 200.8351719, Jupiter: 340.0127168, Saturn:  83.2021614 },
    '2419623.088888889': { Sun: 135.6198473, Moon:  76.2706546, Mercury: 156.5920605,
                           Venus: 144.8790155, Mars: 163.9975635, Jupiter: 245.6026033, Saturn:  62.7941138 },
    '2428002.062500000': { Sun: 114.9876521, Moon: 327.5237619, Mercury:  94.9976653,
                           Venus: 158.9578315, Mars: 204.1907810, Jupiter: 223.4939327, Saturn: 339.6389357 },
    '2401517.527083333': { Sun: 291.3718624, Moon: 189.3909562, Mercury: 303.7211614,
                           Venus: 299.0514268, Mars:  28.2723795, Jupiter: 205.9629281, Saturn: 185.5226777 },
};

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
/** Separations are measured against this body, so its own error cancels out. */
const REFERENCE = 'Sun';

// ---------------------------------------------------------------------------

const wrap = d => ((d % 360) + 360) % 360;
const signedArcsec = (a, b) => (((a - b + 540) % 360) - 180) * 3600;

/** Separations of every body from the reference body. */
function separations(lonByBody) {
    const ref = lonByBody[REFERENCE];
    const out = {};
    for (const b of BODIES) {
        if (b === REFERENCE) continue;
        out[b] = wrap(lonByBody[b] - ref);
    }
    return out;
}

/** Worst and RMS separation error, in arcseconds, against a truth set. */
function score(candidate, truth) {
    let worst = 0, sumSq = 0, n = 0;
    const per = {};
    for (const b of Object.keys(truth)) {
        const d = signedArcsec(candidate[b], truth[b]);
        per[b] = d;
        worst = Math.max(worst, Math.abs(d));
        sumSq += d * d; n++;
    }
    return { worst, rms: Math.sqrt(sumSq / n), per };
}

// ---------------------------------------------------------------------------

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const rows = [];

for (const file of readdirSync('data').filter(f => f.endsWith('.jhd')).sort()) {
    const chart = parseJhd(readFileSync(join('data', file), 'utf8'));
    if (!chart.positions) continue;

    const utcISO = jhdToUtcISO(chart);
    const jd     = engine.julday(DateTime.fromISO(utcISO, { zone: 'utc' }));
    const key    = Object.keys(HORIZONS).find(k => Math.abs(Number(k) - jd) < 1e-6);
    if (!key) continue;   // outside coverage / no reference fetched

    const utc   = DateTime.fromISO(utcISO, { zone: 'utc' });
    const truth = separations(HORIZONS[key]);

    // ── node-jhora, both conventions ────────────────────────────────────────
    const engineSeps = {};
    for (const mode of ['apparent', 'geometric']) {
        const ps  = engine.getPlanets(utc, undefined, { positionMode: mode });
        const lon = Object.fromEntries(BODIES.map(b => [b, ps.find(p => p.name === b).longitude]));
        engineSeps[mode] = separations(lon);
    }

    // ── JHora, as stored in its own file ────────────────────────────────────
    const jhoraSeps = separations(chart.positions);

    const engApparent  = score(engineSeps.apparent,  truth);
    const engGeometric = score(engineSeps.geometric, truth);
    // Score JHora charitably: whichever convention suits it better.
    const jhoraScored  = score(jhoraSeps, truth);

    rows.push({
        name: file.replace('.jhd', ''),
        year: chart.year,
        engine: engApparent,
        engineGeo: engGeometric,
        jhora: jhoraScored,
    });

    console.log(`\n${file.replace('.jhd', '')}  (${chart.year})   ${utcISO}`);
    console.log(`  separations from the ${REFERENCE}, error vs JPL Horizons (arcsec)`);
    console.log('  body        node-jhora      JHora');
    for (const b of Object.keys(truth)) {
        const e = engApparent.per[b], j = jhoraScored.per[b];
        const winner = Math.abs(e) < Math.abs(j) ? '  <- node-jhora' : '  <- JHora';
        console.log(`   ${b.padEnd(9)} ${e.toFixed(2).padStart(10)}  ${j.toFixed(2).padStart(10)}${winner}`);
    }
    console.log(`  worst:  node-jhora ${engApparent.worst.toFixed(2)}"   JHora ${jhoraScored.worst.toFixed(2)}"`);
    console.log(`  rms:    node-jhora ${engApparent.rms.toFixed(2)}"   JHora ${jhoraScored.rms.toFixed(2)}"`);

    // The Moon-Sun elongation sets the tithi, so it earns its own line.
    const elongEng = signedArcsec(engineSeps.apparent.Moon, truth.Moon);
    const elongJh  = signedArcsec(jhoraSeps.Moon,           truth.Moon);
    console.log(`  Moon-Sun elongation (tithi): node-jhora ${elongEng.toFixed(2)}"   JHora ${elongJh.toFixed(2)}"`);
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(74)}`);
console.log('SUMMARY — separation error vs JPL Horizons (arcseconds, lower is better)\n');
console.log('  chart                            year   node-jhora        JHora     factor');

let engWorstAll = 0, jhWorstAll = 0, wins = 0;
for (const r of rows) {
    const factor = r.jhora.rms / r.engine.rms;
    if (r.engine.worst < r.jhora.worst) wins++;
    engWorstAll = Math.max(engWorstAll, r.engine.worst);
    jhWorstAll  = Math.max(jhWorstAll,  r.jhora.worst);
    console.log(`  ${r.name.padEnd(32)} ${String(r.year).padEnd(6)} ` +
                `${r.engine.rms.toFixed(2).padStart(8)} rms ${r.jhora.rms.toFixed(2).padStart(9)} rms ` +
                `${factor.toFixed(0).padStart(6)}x`);
}

console.log(`\n  node-jhora is closer on ${wins}/${rows.length} charts`);
console.log(`  worst separation error:  node-jhora ${engWorstAll.toFixed(2)}"   JHora ${jhWorstAll.toFixed(2)}"`);
