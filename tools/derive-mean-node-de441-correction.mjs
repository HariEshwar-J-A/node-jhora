#!/usr/bin/env node
/**
 * Derive mean lunar node long-range corrections from JPL DE441 (public domain).
 *
 * At each Gregorian century (1 Jan, proleptic), subtract the Meeus eq. 47.7 base
 * from the DE441 osculating node (Q1 clean frame: mean ecliptic of date,
 * no spin, SPK analytic velocity). Fit a Hann-weighted local quadratic over a
 * ~100 yr half-window (≤2-day grid); store the centre value. Linear
 * interpolation between centuries.
 *
 * Usage (requires de441_part-1.bsp + de441_part-2.bsp):
 *   pnpm build
 *   node tools/derive-mean-node-de441-correction.mjs [--quick] [--write]
 *
 * `--write` emits packages/core/src/engine/mean-lunar-node-lt-corr.generated.ts
 *
 * @provenance Park et al. AJ 161, 105 (2021); DE441 NAIF kernels
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const PART1 =
    process.env.DE441_PART1_PATH ?? path.join(ROOT, 'packages/ephe441/.cache/de441_part-1.bsp');
const PART2 =
    process.env.DE441_PART2_PATH ?? path.join(ROOT, 'packages/ephe441/.cache/de441_part-2.bsp');
const OUT = path.join(ROOT, 'packages/core/src/engine/mean-lunar-node-lt-corr.generated.ts');

const HALF_WINDOW_DAYS = 100 * 365.25;
const STEP_DAYS = 2;
const MEAN_NODE_LT_CORR_DAYS_PER_CENTURY = 36524.25;
const MEAN_NODE_LT_CORR_FIRST_CENTURY = -130;
const MEAN_NODE_LT_CORR_LAST_CENTURY = 170;

const { SpkFile } = await imp('packages/core/dist/engine/spk.js');
const { trueAscendingNodeLongitude } = await imp('packages/core/dist/engine/lunar-node.js');
const { meanLunarNodeMeeus } = await imp('packages/core/dist/engine/mean-lunar-node.js');
const { deltaT } = await imp('packages/core/dist/engine/deltat.js');
const { mod360, julianCenturies } = await imp('packages/core/dist/engine/coordinates.js');

function md5File(p) {
    return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
}

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

/** JD 0h UT on 1 Jan of Gregorian century `centuryIndex` × 100. */
function jdCenturyAnchor(centuryIndex) {
    return julianDayAstro(centuryIndex * 100, 1, 1);
}

const MEAN_NODE_LT_CORR_EPOCH_JD = jdCenturyAnchor(MEAN_NODE_LT_CORR_FIRST_CENTURY);

function readBsp(p) {
    if (!fs.existsSync(p)) {
        console.error(`Missing ${p}; set DE441_PART1_PATH / DE441_PART2_PATH`);
        process.exit(1);
    }
    return SpkFile.fromBuffer(fs.readFileSync(p));
}

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

function unwrapSeries(lons) {
    const u = [lons[0]];
    for (let i = 1; i < lons.length; i++) {
        let x = lons[i];
        while (x - u[i - 1] > 180) x -= 360;
        while (x - u[i - 1] < -180) x += 360;
        u.push(x);
    }
    return u;
}

/**
 * Hann-weighted quadratic fit; return value at centre (t=0) in degrees.
 */
function hannQuadraticCentre(residualUnwrapped, offsetsDays) {
    let s00 = 0;
    let s01 = 0;
    let s02 = 0;
    let s03 = 0;
    let s04 = 0;
    let s0y = 0;
    let s1y = 0;
    let s2y = 0;
    for (let i = 0; i < offsetsDays.length; i++) {
        const t = offsetsDays[i];
        if (Math.abs(t) > HALF_WINDOW_DAYS) continue;
        const w = 0.5 * (1 + Math.cos((Math.PI * t) / HALF_WINDOW_DAYS));
        const y = residualUnwrapped[i];
        const t2 = t * t;
        s00 += w;
        s01 += w * t;
        s02 += w * t2;
        s03 += w * t * t2;
        s04 += w * t2 * t2;
        s0y += w * y;
        s1y += w * t * y;
        s2y += w * t2 * y;
    }
    const m = [
        [s00, s01, s02, s0y],
        [s01, s02, s03, s1y],
        [s02, s03, s04, s2y],
    ];
    for (let col = 0; col < 3; col++) {
        let pivot = col;
        for (let row = col + 1; row < 3; row++) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        const div = m[col][col] || 1e-30;
        for (let row = col + 1; row < 3; row++) {
            const f = m[row][col] / div;
            for (let k = col; k < 4; k++) m[row][k] -= f * m[col][k];
        }
    }
    const x = [0, 0, 0];
    for (let row = 2; row >= 0; row--) {
        let sum = m[row][3];
        for (let k = row + 1; k < 3; k++) sum -= m[row][k] * x[k];
        x[row] = sum / (m[row][row] || 1e-30);
    }
    return x[0];
}

const DE441_JD_LO = -3_100_015.5;
const DE441_JD_HI = 7_930_191.5;

function smoothedCorrectionDeg(jdCenter, source) {
    const jdSampleMin = DE441_JD_LO + STEP_DAYS;
    const jdSampleMax = DE441_JD_HI - STEP_DAYS;
    const offsets = [];
    const residuals = [];
    for (let d = -HALF_WINDOW_DAYS; d <= HALF_WINDOW_DAYS; d += STEP_DAYS) {
        const jd = jdCenter + d;
        if (jd < jdSampleMin || jd > jdSampleMax) continue;
        offsets.push(d);
        const jdTT = jd + deltaT(jd) / 86400;
        const trueLon = trueAscendingNodeLongitude(jd, source, {
            precisionProfile: 'modern',
            deltaTForecast: 'oracle-compat',
            truePosition: true,
        });
        const base = meanLunarNodeMeeus(julianCenturies(jdTT));
        residuals.push(angleDiffDeg(trueLon, base));
    }
    if (offsets.length < 10) return 0;
    const unwrapped = unwrapSeries(residuals);
    return hannQuadraticCentre(unwrapped, offsets);
}

const spk1 = readBsp(PART1);
const spk2 = readBsp(PART2);
const source = makeSource(spk1, spk2);
const md5part1 = md5File(PART1);
const md5part2 = md5File(PART2);

const write = process.argv.includes('--write');
const quick = process.argv.includes('--quick');

if (quick) {
    for (const c of [-130, -100, -50, 0, 50, 100, 170]) {
        const jd = jdCenturyAnchor(c);
        const corr = smoothedCorrectionDeg(jd, source);
        console.log(`century=${c} corr_arcsec=${(corr * 3600).toFixed(3)}`);
    }
    process.exit(0);
}

const corrections = [];
for (let c = MEAN_NODE_LT_CORR_FIRST_CENTURY; c <= MEAN_NODE_LT_CORR_LAST_CENTURY; c++) {
    const jd = jdCenturyAnchor(c);
    try {
        corrections.push(Number(smoothedCorrectionDeg(jd, source).toFixed(9)));
    } catch (e) {
        console.error(`Failed at century ${c}:`, e);
        process.exit(1);
    }
    if ((c - MEAN_NODE_LT_CORR_FIRST_CENTURY) % 10 === 9) {
        console.error(`… century ${c} done`);
    }
}

const cmd = 'pnpm build && node tools/derive-mean-node-de441-correction.mjs --write';

const body = `/**
 * Long-term mean lunar node correction (degrees), linearly interpolated between
 * Gregorian century anchors (1 Jan). Derived from JPL DE441 osculating node minus
 * ELP/MPP02 W3 + p_A base by tools/derive-mean-node-de441-correction.mjs.
 *
 * Regenerate:
 *   ${cmd}
 *
 * Inputs (MD5):
 *   de441_part-1.bsp  ${md5part1}
 *   de441_part-2.bsp  ${md5part2}
 *
 * @provenance Park et al. AJ 161, 105 (2021); DE441 NAIF kernels
 */
export const MEAN_NODE_LT_CORR_EPOCH_JD = ${MEAN_NODE_LT_CORR_EPOCH_JD};
export const MEAN_NODE_LT_CORR_DAYS_PER_CENTURY = ${MEAN_NODE_LT_CORR_DAYS_PER_CENTURY};
/** Century index for MEAN_NODE_LT_CORR_DEG[0] (year = index × 100). */
export const MEAN_NODE_LT_CORR_FIRST_CENTURY = ${MEAN_NODE_LT_CORR_FIRST_CENTURY};
/** Signed correction in degrees; linear interp between consecutive centuries. */
export const MEAN_NODE_LT_CORR_DEG: readonly number[] = [
${corrections.map((v) => `    ${v},`).join('\n')}
];
`;

console.log(
    JSON.stringify({
        min: Math.min(...corrections),
        max: Math.max(...corrections),
        count: corrections.length,
    }),
);

if (write) {
    fs.writeFileSync(OUT, body);
    console.error(`Wrote ${OUT}`);
} else {
    console.error('Dry run; pass --write to emit generated table');
}
