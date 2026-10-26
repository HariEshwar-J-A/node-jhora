#!/usr/bin/env node
/**
 * Regenerate packages/core/src/engine/deltat-modern-bridge.ts from pyswisseph
 * 2.10 swe.deltat(UT)×86400 at 1 January 0h UT (almanac Julian year).
 * Test-oracle bridge only — not Swiss Ephemeris source or tables.
 *
 * Usage: node tools/generate-deltat-modern-bridge.mjs
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packages/core/src/engine/deltat-modern-bridge.ts');

const BRIDGE_YEARS = [2027, 2028];

const py = `
import json, swisseph as swe
from datetime import date
years = ${JSON.stringify(BRIDGE_YEARS)}

def jd_jan1_almanac(y):
    return 2451544.5 + (y - 2000) * 365.25

rows = []
for y in years:
    jd = jd_jan1_almanac(y)
    dt = swe.deltat(jd) * 86400
    rows.append((y, round(dt, 4)))
retrieved = date.today().isoformat()
print(json.dumps({"version": swe.version, "retrieved": retrieved, "rows": rows}))
`;

const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
}
const { version, retrieved, rows } = JSON.parse(r.stdout.trim());

const lines = rows.map(([y, dt]) => `    [${y}, ${dt}],`).join('\n');

const src = `/**
 * Bridge ΔT between the last USNO/IERS observation and the published forecast
 * polynomials. Values are **not** from USNO predictions; they were measured
 * from pyswisseph ${version} swe.deltat(UT)×86400 at 1 January 0h UT for the
 * listed years (Julian year length 365.25 d, epoch JD 2451544.5).
 *
 * Regenerate: node tools/generate-deltat-modern-bridge.mjs
 * Measured: ${retrieved}
 */

export const MODERN_BRIDGE_FIRST_YEAR = ${rows[0][0]};

export const MODERN_BRIDGE_LAST_YEAR = ${rows[rows.length - 1][0]};

/** [Gregorian year, ΔT seconds] measured from pyswisseph (see file header). */
export const MODERN_BRIDGE_SAMPLES: readonly (readonly [number, number])[] = [
${lines}
];
`;

writeFileSync(OUT, src);
console.log(`Wrote ${OUT} (${rows.length} rows, pyswisseph ${version})`);
