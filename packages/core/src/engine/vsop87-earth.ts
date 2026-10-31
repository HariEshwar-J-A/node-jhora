/**
 * VSOP87 version E — Earth geocentre barycentric rectangular coordinates in the
 * J2000 dynamical ecliptic and equinox (AU).
 *
 * @provenance Bretagnon P., Francou G. 1988, A&A 202, 309 (VSOP87 theory);
 *   VSOP87 documentation (Bureau des Longitudes / IMCCE, vsop87.txt): term
 *   layout T**α (S sin φ + K cos φ), φ = Σ a(i)·λ(i)(T).
 *   VSOP87E.ear Earth series, CDS/IMCCE catalogue VI/81, transcribed and
 *   truncated by `tools/generate-vsop87-earth-data.mjs` (see JSON header).
 */

import { deltaT } from './deltat.js';
import { meanObliquity, type Vec } from './precession.js';
import data from './vsop87-earth.data.json' with { type: 'json' };

type VsopBlock = { ic: number; alpha: number; terms: number[][] };

function loadBlocks(raw: unknown): VsopBlock[] {
    const arr = raw as VsopBlock[] | [number, number, number[][]][];
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const first = arr[0];
    if (Array.isArray(first)) {
        return (arr as [number, number, number[][]][]).map(([ic, alpha, terms]) => ({
            ic,
            alpha,
            terms,
        }));
    }
    return arr as VsopBlock[];
}

const blocks: VsopBlock[] = loadBlocks(data.blocks);

/** Julian millennia from J2000 (VSOP87 time argument). */
function vsop87T(jdUT: number): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    return (jdTT - 2451545.0) / 365250.0;
}

/** VSOP87 mean longitudes λ₁…λ₁₂ (rad); VSOP87 documentation table. */
function vsop87Lambdas(t: number): number[] {
    return [
        4.4026088424 + 26087.9031415742 * t,
        3.17614669689 + 10213.285546211 * t,
        1.75347045953 + 6283.0758499914 * t,
        6.20347611291 + 3340.6124266998 * t,
        0.59954649739 + 529.6909650946 * t,
        0.8740167565 + 213.299095438 * t,
        5.48129387159 + 74.7815985673 * t,
        5.31188628676 + 38.1330356378 * t,
        5.19846674103 + 77713.7714681205 * t,
        1.62790523337 + 84334.6615813083 * t,
        2.35555589827 + 83286.9142695536 * t,
        3.81034454697 + 83997.0911355954 * t,
    ];
}

function termPhi(a: number[], lambdas: number[]): number {
    let phi = 0;
    for (let i = 0; i < 12; i++) phi += a[i]! * lambdas[i]!;
    return phi;
}

function evalBlock(terms: number[][], t: number, alpha: number, lambdas: number[]): number {
    const tPow = alpha === 0 ? 1 : t ** alpha;
    let sum = 0;
    for (const row of terms) {
        const a = row.slice(0, 12);
        const S = row[12]!;
        const K = row[13]!;
        const phi = termPhi(a, lambdas);
        sum += tPow * (S * Math.sin(phi) + K * Math.cos(phi));
    }
    return sum;
}

/**
 * Earth geocentre barycentric position (AU) in ICRF mean equator of J2000,
 * from the truncated VSOP87E rectangular series.
 */
export function earthGeocenterBarycentricAuVsop87(jdUT: number): Vec {
    const t = vsop87T(jdUT);
    const lambdas = vsop87Lambdas(t);
    let x = 0;
    let y = 0;
    let z = 0;
    for (const block of blocks) {
        const v = evalBlock(block.terms, t, block.alpha, lambdas);
        if (block.ic === 1) x += v;
        else if (block.ic === 2) y += v;
        else if (block.ic === 3) z += v;
    }

    const obl = meanObliquity(0, 2451545.0) * (Math.PI / 180);
    const cosO = Math.cos(obl);
    const sinO = Math.sin(obl);
    return [x, y * cosO - z * sinO, y * sinO + z * cosO];
}
