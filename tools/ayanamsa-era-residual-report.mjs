/**
 * Per-era max |Δ| for True Citra (27) and Lahiri (1) vs pyswisseph 2.10 (modern)
 * and JHora DLL (jhora geometric). Run after `pnpm build`.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getAyanamsa } from '../packages/core/dist/engine/ayanamsa.js';
import { EphemerisEngine } from '../packages/core/dist/engine/ephemeris.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../packages/ephe/de440s.bsp', import.meta.url))),
);

const DE440S_FIRST = 2396758.5 + 1;
const DE440S_LAST = 2506331.5 - 1;

function modernFrameForJd(jd) {
    return jd > DE440S_FIRST && jd < DE440S_LAST ? 'apparent' : 'geometric';
}

const ERAS = [
    { name: '−10000..−5000', years: [-10000, -7500] },
    { name: '−5000..−3000', years: [-5000, -4000] },
    { name: '−3000..−1000', years: [-3000, -2000] },
    { name: '−1000..0', years: [-1000, -500] },
    { name: '0..1000', years: [0, 500] },
    { name: '1000..2150', years: [1000, 2000] },
    { name: '2150..3000', years: [2500, 2800] },
    { name: '3000..5000', years: [3500, 4500] },
    { name: '5000..10000', years: [6000, 9000] },
];

function gapArcsec(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

function jdFromYear(y) {
    const py = `
import swisseph as swe
cal=swe.GREG_CAL if ${y}>=1582 else swe.JUL_CAL
print(swe.julday(${y},6,15,12,cal))
`;
    const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
    return Number(r.stdout.trim());
}

function seAyan(mode, jd) {
    const py = `
import swisseph as swe
swe.set_ephe_path('/workspace/packages/ephe')
swe.set_sid_mode(${mode})
print(swe.get_ayanamsa_ut(${jd}))
`;
    const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
    return Number(r.stdout.trim());
}

await EphemerisEngine.getInstance().initialize({ kernel });

const rows = [];
for (const era of ERAS) {
    let maxAyanJ = 0;
    let maxAyanM = 0;
    let maxLahJ = 0;
    let maxLahM = 0;
    for (const y of era.years) {
        const jd = jdFromYear(y);
        maxAyanJ = Math.max(
            maxAyanJ,
            gapArcsec(getAyanamsa(27, jd, 'geometric', 'jhora'), seAyan(27, jd)),
        );
        const modernFrame = modernFrameForJd(jd);
        maxAyanM = Math.max(
            maxAyanM,
            gapArcsec(getAyanamsa(27, jd, modernFrame, 'modern'), seAyan(27, jd)),
        );
        maxLahJ = Math.max(
            maxLahJ,
            gapArcsec(getAyanamsa(1, jd, 'geometric', 'jhora'), seAyan(1, jd)),
        );
        maxLahM = Math.max(
            maxLahM,
            gapArcsec(getAyanamsa(1, jd, modernFrame, 'modern'), seAyan(1, jd)),
        );
    }
    rows.push({
        era: era.name,
        ayanJhora: maxAyanJ.toFixed(3),
        ayanModern: maxAyanM.toFixed(3),
        lahiriJhora: maxLahJ.toFixed(3),
        lahiriModern: maxLahM.toFixed(3),
    });
}

console.log(JSON.stringify(rows, null, 2));
