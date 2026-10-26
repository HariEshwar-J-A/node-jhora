#!/usr/bin/env node
/**
 * Regenerate packages/core/tests/fixtures/deltat-pyswisseph-se210.json from
 * pyswisseph 2.10 swe_deltat(). Test oracle only — not shipped in the engine.
 *
 * Usage: node tools/generate-deltat-modern-test-fixture.mjs
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packages/core/tests/fixtures/deltat-pyswisseph-se210.json');

const years = [
    -10000, -5000, -3000, -1000, -720, -719, -500, 0, 500, 1000, 1600, 1620, 1633, 1800, 1900, 1948,
    1954, 1955, 1955.5, 1972, 1973, 2000, 2016, 2019, 2020, 2026, 2027, 2030, 2050, 2100, 2150,
    2200, 3000, 5000, 10000,
];

const py = `
import json, swisseph as swe
years = ${JSON.stringify(years)}

def yjd(y):
    return 2451545.0 + (y - 2000) * 365.2425

extra = [{"tag": "oracle-kit-bound-720", "y": -719.6883128953646, "jdUT": 1458199.2413773148}]
samples = []
for row in extra:
    row["deltaTSeconds"] = swe.deltat(row["jdUT"]) * 86400
    samples.append(row)
for y in years:
    jd = yjd(y)
    samples.append({
        "y": y,
        "jdUT": jd,
        "deltaTSeconds": swe.deltat(jd) * 86400,
    })
doc = {
    "provenance": f"pyswisseph {swe.version} swe.deltat(UT)×86400; test fixture only",
    "samples": samples,
}
with open("${OUT.replace(/\\/g, '/')}", "w") as f:
    json.dump(doc, f, indent=2)
print(len(samples), "samples")
`;

const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
}
console.log(r.stdout.trim());
