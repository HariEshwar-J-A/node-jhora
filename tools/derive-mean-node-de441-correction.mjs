#!/usr/bin/env node
/**
 * Derive mean lunar node long-range corrections from JPL DE441 (public domain).
 *
 * At each Gregorian century anchor, unwrap true-node longitudes over one nodal
 * period (~6798.383 d), linear least-squares fit, and take the mean longitude at
 * the anchor (valid numeric mean when the node regresses ~360° over the window).
 * The correction is that value minus Meeus eq. 47.7. This does **not** match the
 * lunar-node oracle at extreme dates; see ADR 0012.
 *
 * Usage (requires de441_part-1.bsp + de441_part-2.bsp):
 *   node tools/derive-mean-node-de441-correction.mjs [--quick]
 *   node tools/derive-mean-node-de441-correction.mjs --write-tools-artifact
 *
 * `--write-tools-artifact` writes a maintainer-only file under `tools/artifacts/`
 * (not imported by any package). Full-table generation is intentionally not wired
 * into library source under packages/.
 *
 * @provenance Park et al. AJ 161, 105 (2021); DE441 NAIF kernels
 */
import fs from 'node:fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const PART1 =
    process.env.DE441_PART1_PATH ?? path.join(ROOT, 'packages/ephe441/.cache/de441_part-1.bsp');
const PART2 =
    process.env.DE441_PART2_PATH ?? path.join(ROOT, 'packages/ephe441/.cache/de441_part-2.bsp');
const OUT = path.join(ROOT, 'tools/artifacts/mean-lunar-node-lt-corr.generated.ts');

const NODAL_PERIOD_DAYS = 6798.383;
const HALF = NODAL_PERIOD_DAYS / 2;
const STEP_DAYS = 1;
/** Century step for long-term correction interpolation (mean Gregorian century). */
const MEAN_NODE_LT_CORR_DAYS_PER_CENTURY = 36524.25;
/** JD of interpolation epoch: 1 Jan −13100 proleptic Gregorian, 0h UT. */
const MEAN_NODE_LT_CORR_EPOCH_JD = -3063616.5;

const { SpkFile } = await imp('packages/core/dist/engine/spk.js');
const { trueAscendingNodeLongitude } = await imp('packages/core/dist/engine/lunar-node.js');
const { meanLunarNode } = await imp('packages/core/dist/engine/ayanamsa.js');
const { deltaT } = await imp('packages/core/dist/engine/deltat.js');
const { julianCenturies, mod360 } = await imp('packages/core/dist/engine/coordinates.js');

function julianDayAstro(year, month, day) {
    let y = year;
    let m = month;
    if (m <= 2) {
        y -= 1;
        m += 12;
    }
    const greg = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
    const A = greg ? Math.floor(y / 100) : 0;
    const B = greg ? 2 - A + Math.floor(A / 4) : 0;
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

function readBsp(p) {
    if (!fs.existsSync(p)) {
        console.error(`Missing ${p}; set DE441_PART1_PATH / DE441_PART2_PATH`);
        process.exit(1);
    }
    return SpkFile.fromBuffer(fs.readFileSync(p));
}

/** ET split: part-1 ends ~2440432.5 JD, part-2 starts ~2440400.5 JD. */
const JD_SPLIT = 2440416.5;

function makeSource(spk1, spk2) {
    return {
        getBarycentric(naifBody, et) {
            const jd = et / 86400 + 2451545.0;
            const spk = jd < JD_SPLIT ? spk1 : spk2;
            return spk.getBarycentric(naifBody, et);
        },
    };
}

function angleDiffDeg(a, b) {
    return mod360(a - b + 180) - 180;
}

function linearMeanNode(jdCenter, source) {
    const lons = [];
    for (let d = -HALF; d <= HALF; d += STEP_DAYS) {
        lons.push(
            trueAscendingNodeLongitude(jdCenter + d, source, {
                eclipticFrame: 'mean_ecliptic_of_date',
                velocityMode: 'spk_analytic',
                precessionSpin: false,
                precisionProfile: 'modern',
                truePosition: true,
            }),
        );
    }
    const u = [lons[0]];
    for (let i = 1; i < lons.length; i++) {
        let x = lons[i];
        while (x - u[i - 1] > 180) x -= 360;
        while (x - u[i - 1] < -180) x += 360;
        u.push(x);
    }
    const n = u.length;
    const mid = (n - 1) / 2;
    let sumT = 0;
    let sumL = 0;
    let sumTL = 0;
    let sumT2 = 0;
    for (let i = 0; i < n; i++) {
        const t = i - mid;
        sumT += t;
        sumL += u[i];
        sumTL += t * u[i];
        sumT2 += t * t;
    }
    const b = (n * sumTL - sumT * sumL) / (n * sumT2 - sumT * sumT);
    const a = (sumL - b * sumT) / n;
    return mod360(a);
}

function jdForYear(y) {
    return julianDayAstro(y, 6, 15) + 0.5; // 12:00 UT ≈ 0.5 day
}

const spk1 = readBsp(PART1);
const spk2 = readBsp(PART2);
const source = makeSource(spk1, spk2);

/** Century indices −100 … +100 (years −10000 … +10000). */
const indices = [];
for (let i = -100; i <= 100; i++) indices.push(i);

const writeArtifact = process.argv.includes('--write-tools-artifact');
const quick = process.argv.includes('--quick');

if (quick) {
    for (const y of [-10000, -5000, 0, 2000, 9999]) {
        const jd = jdForYear(y);
        const mean = linearMeanNode(jd, source);
        const T = julianCenturies(jd + deltaT(jd) / 86400);
        const base = meanLunarNode(T);
        console.log(
            `y=${y} corr_arcsec=${(angleDiffDeg(mean, base) * 3600).toFixed(3)} mean=${mean.toFixed(6)} base=${base.toFixed(6)}`,
        );
    }
    process.exit(0);
}

const corrections = [];
for (const i of indices) {
    const y = i * 100;
    const jd = jdForYear(y);
    try {
        const mean = linearMeanNode(jd, source);
        const T = julianCenturies(jd + deltaT(jd) / 86400);
        const base = meanLunarNode(T);
        corrections.push(Number(angleDiffDeg(mean, base).toFixed(9)));
    } catch (e) {
        console.error(`Failed at century ${i} (y=${y}):`, e);
        process.exit(1);
    }
    if ((i + 101) % 10 === 0) console.error(`… century ${i} done`);
}

const body = `/**
 * Experimental DE441-derived long-term mean-node corrections (degrees).
 * Maintainer artifact only — NOT imported by @node-jhora/core.
 * Regenerate: node tools/derive-mean-node-de441-correction.mjs --write-tools-artifact
 *
 * At each Gregorian century from MEAN_NODE_LT_CORR_EPOCH_JD, correction = linear-fit
 * mean of DE441 osculating node over one nodal cycle minus Meeus eq. 47.7.
 * @provenance Park et al. 2021 (DE441); tools/derive-mean-node-de441-correction.mjs
 */
export const MEAN_NODE_LT_CORR_EPOCH_JD = ${MEAN_NODE_LT_CORR_EPOCH_JD};
export const MEAN_NODE_LT_CORR_DAYS_PER_CENTURY = ${MEAN_NODE_LT_CORR_DAYS_PER_CENTURY};
/** Signed correction in degrees; index 0 = century −100 (year −10000). */
export const MEAN_NODE_LT_CORR_DEG: readonly number[] = [
${corrections.map((c) => `    ${c},`).join('\n')}
];
`;

console.log(JSON.stringify({ min: Math.min(...corrections), max: Math.max(...corrections) }));

if (writeArtifact) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, body);
    console.error(`Wrote ${OUT} (tools only; not used by packages)`);
} else {
    console.error('Dry run; pass --write-tools-artifact to emit tools/artifacts/ file');
}
