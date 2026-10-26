/**
 * Engine vs pyswisseph 2.10 across −10000…+10000 CE samples; JHora golden for mode 27.
 * Requires: python3 + pyswisseph, built @node-jhora/core.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AYANAMSA_MODELS, getAyanamsa } from '../packages/core/dist/engine/ayanamsa.js';
import { EphemerisEngine } from '../packages/core/dist/engine/ephemeris.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../packages/ephe/de440s.bsp', import.meta.url))),
);

const MODES = Object.keys(AYANAMSA_MODELS).map(Number);

const sampleYears = [
    -10000, -9000, -8000, -7000, -6000, -5000, -4000, -3000, -2000, -1000, -500, -100, 0, 500, 1000,
    1500, 1800, 1850, 1900, 1956, 2000, 2026, 2100, 2150, 3000, 5000, 8000, 10000,
];

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

function eraForYear(y) {
    if (y < -5000) return 'before_5000_bce';
    if (y < 0) return '5000_bce_to_1_bce';
    if (y < 1800) return '1_ce_to_1799';
    if (y < 1849) return '1800_to_1848';
    if (y <= 2150) return 'de440s_1849_2150';
    return 'after_2150_ce';
}

function seAyanamsa(mode, jd) {
    const py = `
import swisseph as swe
swe.set_ephe_path('/workspace/packages/ephe')
sidm={0:0,1:1,3:3,5:5,18:18,27:27,29:29,35:35,46:46}
swe.set_sid_mode(sidm[${mode}])
print(swe.get_ayanamsa_ut(${jd}))
`;
    const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return Number(r.stdout.trim());
}

function jdFromAstroYear(y) {
    const py = `
import swisseph as swe
cal=swe.GREG_CAL if ${y}>=1582 else swe.JUL_CAL
print(swe.julday(${y},1,1,12,cal))
`;
    const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
    return Number(r.stdout.trim());
}

await EphemerisEngine.getInstance().initialize({ kernel });

const modernMax = {};
const eraMax = {};
for (const m of MODES) {
    modernMax[m] = 0;
    eraMax[m] = {};
}

for (const y of sampleYears) {
    const jd = jdFromAstroYear(y);
    const era = eraForYear(y);
    for (const mode of MODES) {
        const model = AYANAMSA_MODELS[mode];
        const frame = model.kind === 'star' ? 'apparent' : 'apparent';
        let got;
        try {
            got = getAyanamsa(mode, jd, frame);
        } catch (e) {
            if (e instanceof RangeError && model.kind === 'star') continue;
            throw e;
        }
        const exp = seAyanamsa(mode, jd);
        const err = gapArcsec(got, exp);
        modernMax[mode] = Math.max(modernMax[mode], err);
        eraMax[mode][era] = Math.max(eraMax[mode][era] ?? 0, err);
    }
}

const jhoraGolden = JSON.parse(
    readFileSync(
        fileURLToPath(
            new URL('../packages/core/tests/fixtures/jhora_dll_golden.json', import.meta.url),
        ),
        'utf8',
    ),
);
let jhora27Max = 0;
const jhora27Era = {};
for (const c of jhoraGolden.cases) {
    const err = gapArcsec(getAyanamsa(27, c.jdUT, 'geometric'), c.ayanamsa);
    jhora27Max = Math.max(jhora27Max, err);
    const y = Number.parseInt(c.utc.slice(0, 5), 10);
    const e = eraForYear(y);
    jhora27Era[e] = Math.max(jhora27Era[e] ?? 0, err);
}

const lahiriJhoraOracle = 23.255161653736;
const lahiriJhoraJd = 2435805.5852083336;
const jhora1Max = gapArcsec(getAyanamsa(1, lahiriJhoraJd, 'geometric'), lahiriJhoraOracle);

const out = {
    modernMaxArcsec: modernMax,
    modernEraMaxArcsec: eraMax,
    jhoraGeometricMaxArcsec: { 1: jhora1Max, 27: jhora27Max },
    jhora27EraMaxArcsec: jhora27Era,
};

const outPath = fileURLToPath(new URL('ayanamsa-era-max.json', import.meta.url));
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
