#!/usr/bin/env node
/**
 * Regenerate packages/core/src/engine/deltat-modern-bridge.ts from USNO
 * deltat.preds (TT−UT at Year 2027.00 and 2028.00).
 *
 * Usage: node tools/generate-deltat-modern-bridge.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packages/core/src/engine/deltat-modern-bridge.ts');
const PREDS_URL = 'https://maia.usno.navy.mil/ser7/deltat.preds';
const BRIDGE_YEARS = [2027, 2028];

const text = await fetch(PREDS_URL).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} ${PREDS_URL}`);
    return r.text();
});

const rows = [];
for (const y of BRIDGE_YEARS) {
    const re = new RegExp(`^\\d+\\.\\d+\\s+${y}\\.00\\s+([\\d.]+)`, 'm');
    const m = text.match(re);
    if (!m) throw new Error(`Year ${y}.00 not found in deltat.preds`);
    rows.push([y, Number(m[1])]);
}

const retrieved = new Date().toISOString().slice(0, 10);
const lines = rows.map(([y, dt]) => `    [${y}, ${dt}],`).join('\n');

const src = `/**
 * Bridge ΔT between the last USNO/IERS observation and the published forecast
 * polynomials (Swiss Ephemeris manual ch. 7 layout).
 *
 * @provenance U.S. Naval Observatory, Earth Orientation Department,
 * "deltat.preds" quarterly TT−UT predictions,
 * https://maia.usno.navy.mil/ser7/deltat.preds — Year column at 2027.00 and
 * 2028.00. Retrieved: ${retrieved}.
 *
 * Regenerate: node tools/generate-deltat-modern-bridge.mjs
 */

export const MODERN_BRIDGE_FIRST_YEAR = ${rows[0][0]};

export const MODERN_BRIDGE_LAST_YEAR = ${rows[rows.length - 1][0]};

/** [Gregorian year, ΔT seconds] from USNO deltat.preds (see file header). */
export const MODERN_BRIDGE_SAMPLES: readonly (readonly [number, number])[] = [
${lines}
];
`;

writeFileSync(OUT, src);
console.log(`Wrote ${OUT} (${rows.length} rows from USNO deltat.preds)`);
