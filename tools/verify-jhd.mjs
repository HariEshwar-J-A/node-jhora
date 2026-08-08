#!/usr/bin/env node
/**
 * verify-jhd.mjs — Cross-check the engine against Jagannatha Hora `.jhd` files.
 *
 *   node tools/verify-jhd.mjs <dir-or-file> [...]
 *   node tools/verify-jhd.mjs charts/ --ayanamsa 27 --node auto
 *
 * Legacy `.jhd` files embed JHora's own computed longitudes, so each one is a
 * complete regression case on its own. Modern files carry birth data only; those
 * are listed as "no positions" and skipped, since there is nothing to compare
 * against.
 *
 * For every chart the script reports, per body, the signed difference in
 * arcseconds between this engine and JHora. It also searches the ayanamsa and
 * node-type settings to report which combination the file was written under —
 * those are per-chart JHora preferences, not engine behaviour, and guessing them
 * wrong produces uniform offsets that look like bugs but are not.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename }             from 'path';
import { DateTime }                            from 'luxon';

import { EphemerisEngine }        from '../packages/core/dist/engine/ephemeris.js';
import { parseJhd, jhdToUtcISO, JHD_BODY_ORDER } from '../packages/core/dist/io/jhd.js';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv    = process.argv.slice(2);
const targets = argv.filter(a => !a.startsWith('--'));
const flag    = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const AYANAMSA_CANDIDATES = [27, 1, 3, 5, 0, 29, 30, 35];
const NODE_CANDIDATES     = ['true', 'mean'];
const POSITION_CANDIDATES = ['geometric', 'apparent'];

if (targets.length === 0) {
    console.error('usage: node tools/verify-jhd.mjs <dir-or-file> [...] [--ayanamsa N] [--node true|mean]');
    process.exit(2);
}

function collect(paths) {
    const out = [];
    for (const p of paths) {
        if (statSync(p).isDirectory()) {
            for (const f of readdirSync(p)) {
                if (extname(f).toLowerCase() === '.jhd') out.push(join(p, f));
            }
        } else {
            out.push(p);
        }
    }
    return out.sort();
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

const sepArcsec = (a, b) => (((a - b + 540) % 360) - 180) * 3600;

function evaluate(engine, chart, utc, jd, opts) {
    const planets = engine.getPlanets(utc, undefined, {
        ayanamsaOrder: opts.ayanamsa,
        nodeType:      opts.node,
        positionMode:  opts.positionMode,
    });
    const asc = engine.getHouses(jd, chart.latitude, chart.longitude, 'W', true, opts.ayanamsa).ascendant;

    const deltas = {};
    let worst = 0;
    for (const body of JHD_BODY_ORDER) {
        const got = body === 'Lagna'
            ? asc
            : planets.find(p => p.name === body).longitude;
        const d = sepArcsec(got, chart.positions[body]);
        deltas[body] = { got, expected: chart.positions[body], delta: d };
        worst = Math.max(worst, Math.abs(d));
    }
    return { deltas, worst, planets };
}

/** Find the JHora settings the file was written under. */
function detectSettings(engine, chart, utc, jd) {
    let best = null;
    for (const ayanamsa of AYANAMSA_CANDIDATES) {
        for (const node of NODE_CANDIDATES) {
            for (const positionMode of POSITION_CANDIDATES) {
                const opts = { ayanamsa, node, positionMode };
                const r = evaluate(engine, chart, utc, jd, opts);
                if (!best || r.worst < best.worst) best = { ...r, opts };
            }
        }
    }
    return best;
}

/**
 * de440s.bsp spans 1849-12-26 to 2150-01-22. Charts outside that window cannot
 * be evaluated at all — worth saying plainly rather than surfacing a raw SPK
 * segment error, since several of JHora's bundled sample charts predate it.
 */
const EPHEMERIS_START_JD = 2396758.5;   // 1849-12-26
const EPHEMERIS_END_JD   = 2506352.5;   // 2150-01-22

function coverageError(jd) {
    if (jd < EPHEMERIS_START_JD) return 'before de440s coverage (starts 1849-12-26)';
    if (jd > EPHEMERIS_END_JD)   return 'after de440s coverage (ends 2150-01-22)';
    return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const files = collect(targets);
const forcedAyanamsa = flag('ayanamsa') ? Number(flag('ayanamsa')) : null;
const forcedNode     = flag('node') && flag('node') !== 'auto' ? flag('node') : null;

let compared = 0, skipped = 0;
const summary = [];

for (const file of files) {
    const name = basename(file, '.jhd');
    let chart;
    try {
        chart = parseJhd(readFileSync(file, 'utf8'));
    } catch (e) {
        console.log(`\n${name}\n  PARSE ERROR: ${e.message}`);
        continue;
    }

    const utcISO = jhdToUtcISO(chart);
    const utc    = DateTime.fromISO(utcISO, { zone: 'utc' });
    const jd     = engine.julday(utc);

    const place = [chart.placeName, chart.country].filter(Boolean).join(', ');
    const coords = `${chart.latitude.toFixed(4)}N ${chart.longitude.toFixed(4)}E tz${chart.tzHours >= 0 ? '+' : ''}${chart.tzHours.toFixed(4)}`;

    if (!chart.positions) {
        skipped++;
        console.log(`\n${name}\n  ${chart.year}-${String(chart.month).padStart(2,'0')}-${String(chart.day).padStart(2,'0')} ` +
                    `${utcISO}  ${coords}${place ? '  ' + place : ''}\n  no positions stored — birth data only, nothing to compare`);
        continue;
    }

    const outOfRange = coverageError(jd);
    if (outOfRange) {
        skipped++;
        console.log(`\n${name}\n  ${chart.year}-${String(chart.month).padStart(2,'0')}-${String(chart.day).padStart(2,'0')} ` +
                    `${utcISO}  ${coords}\n  ${outOfRange} — cannot evaluate`);
        continue;
    }

    let result;
    try {
        result = (forcedAyanamsa !== null || forcedNode)
            ? (() => {
                const opts = {
                    ayanamsa:     forcedAyanamsa ?? 27,
                    node:         forcedNode ?? 'true',
                    positionMode: 'geometric',
                };
                return { ...evaluate(engine, chart, utc, jd, opts), opts };
            })()
            : detectSettings(engine, chart, utc, jd);
    } catch (e) {
        skipped++;
        console.log(`\n${name}\n  ${utcISO}  ${coords}\n  ERROR: ${e.message}`);
        continue;
    }

    compared++;
    console.log(`\n${name}`);
    console.log(`  ${chart.year}-${String(chart.month).padStart(2,'0')}-${String(chart.day).padStart(2,'0')} ` +
                `${utcISO}  ${coords}`);
    console.log(`  settings: ayanamsa ${result.opts.ayanamsa} (${engine.getAyanamsaName(result.opts.ayanamsa)}), ` +
                `${result.opts.node} node, ${result.opts.positionMode}`);
    console.log('  body      engine        JHora         delta');

    for (const body of JHD_BODY_ORDER) {
        const d = result.deltas[body];
        const mark = Math.abs(d.delta) > 60 ? '  <-- ' + (Math.abs(d.delta) / 3600).toFixed(3) + ' deg' : '';
        console.log(`   ${body.padEnd(8)} ${d.got.toFixed(6).padStart(11)}  ${d.expected.toFixed(6).padStart(11)}  ` +
                    `${d.delta.toFixed(1).padStart(9)}"${mark}`);
    }
    console.log(`  worst: ${result.worst.toFixed(1)}"`);
    summary.push({ name, worst: result.worst, opts: result.opts });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(72)}`);
console.log(`compared ${compared}, skipped ${skipped} (birth data only), of ${files.length} files\n`);

if (summary.length) {
    summary.sort((a, b) => a.worst - b.worst);
    for (const s of summary) {
        console.log(`  ${s.worst.toFixed(1).padStart(9)}"  ayan ${String(s.opts.ayanamsa).padStart(2)} ` +
                    `${s.opts.node.padEnd(5)} ${s.opts.positionMode.padEnd(9)}  ${s.name}`);
    }
    const worst = summary[summary.length - 1];
    console.log(`\n  median ${summary[Math.floor(summary.length / 2)].worst.toFixed(1)}"   worst ${worst.worst.toFixed(1)}" (${worst.name})`);
}
