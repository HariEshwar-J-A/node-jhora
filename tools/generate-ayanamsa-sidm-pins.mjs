/**
 * Regenerate ayanamsa_sidm_parity_pins.json from pyswisseph 2.10 black-box oracles.
 * Test fixtures only — not used to derive library constants.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const kernelJds = [2396760.0, 2415020.0, 2435553.5, 2451545.0, 2460972.643310185, 2490000.0];

const CANONICAL_JHORA_PINS = {
    1: { 2435805.5852083336: 23.255161653736 },
    27: { 2451545.0: 23.853055555555557 },
};

const py = `
import json, swisseph as swe
swe.set_ephe_path('/workspace/packages/ephe')
modes = sorted(v for k, v in swe.__dict__.items() if k.startswith('SIDM_') and isinstance(v, int))
jds = ${JSON.stringify(kernelJds)}
out = {"kernelJds": jds, "modern": {}, "provenance": {"oracle": "pyswisseph 2.10.03 black-box ayanamsa output per mode number", "use": "test fixture only"}}
for mode in modes:
    if mode == 255:
        continue
    swe.set_sid_mode(mode)
    out["modern"][str(mode)] = {str(jd): swe.get_ayanamsa_ut(jd) for jd in jds}
print(json.dumps(out))
`;

const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
if (r.status !== 0) throw new Error(r.stderr || r.stdout);
const data = JSON.parse(r.stdout.trim());

const outPath = fileURLToPath(
    new URL('../packages/core/tests/fixtures/ayanamsa_sidm_parity_pins.json', import.meta.url),
);

data.jhora = CANONICAL_JHORA_PINS;
data.provenance = {
    modern: 'pyswisseph 2.10.03 black-box ayanamsa output per mode number (apparent / modern profile)',
    jhora: 'JHora DLL sweep oracles (geometric); only modes JHora exposes',
    use: 'test fixture only — never embedded in engine code',
};

writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
console.log('Wrote', outPath, 'modes', Object.keys(data.modern).length);
