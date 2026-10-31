#!/usr/bin/env node
/**
 * Measure |ΔT_modern − pyswisseph| on a year grid (test oracle only).
 * Requires: pnpm --filter @node-jhora/core build
 *
 * Usage: node tools/measure-deltat-modern-residuals.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const pyYears = `
import json, swisseph as swe
out = []
def jd_mean(y):
    return 2451545.0 + (y - 2000) * 365.2425
def jd_almanac(y):
    return 2451544.5 + (y - 2000) * 365.25

for y in range(-10000, 10001):
    jd = jd_mean(y) if y < 2027 else jd_almanac(y)
    out.append((y, jd, swe.deltat(jd) * 86400))
# dense near joins (almanac year scale)
for y in [2026, 2026.5, 2027, 2027.5, 2028, 2028.5, 2029, 2127, 2128, 2129, 2499, 2500, 2501]:
    jd = jd_almanac(y) if y >= 2026 else jd_mean(y)
    out.append((y, jd, swe.deltat(jd) * 86400))
print(json.dumps(out))
`;

const r = spawnSync('python3', ['-c', pyYears], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
}
const oracle = JSON.parse(r.stdout.trim());

const { deltaT } = await import(join(ROOT, 'packages/core/dist/engine/deltat.js'));

let max = 0;
let maxAt = null;
const buckets = { ancient: 0, observed: 0, bridge: 0, forecast: 0 };

for (const [y, jd, expected] of oracle) {
    const got = deltaT(jd, 'modern', 'oracle-compat');
    const err = Math.abs(got - expected);
    if (err > max) {
        max = err;
        maxAt = { y, jd, err, expected, got };
    }
    if (y < 1955) buckets.ancient = Math.max(buckets.ancient, err);
    else if (y <= 2026) buckets.observed = Math.max(buckets.observed, err);
    else if (y <= 2028) buckets.bridge = Math.max(buckets.bridge, err);
    else buckets.forecast = Math.max(buckets.forecast, err);
}

console.log(JSON.stringify({ maxAbsSeconds: max, maxAt, buckets }, null, 2));
