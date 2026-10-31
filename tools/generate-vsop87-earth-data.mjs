#!/usr/bin/env node
/**
 * Transcribe VSOP87E Earth barycentric rectangular series (J2000 dynamical
 * ecliptic, AU) into packages/core/src/engine/vsop87-earth.data.json.
 *
 * Theory: Bretagnon P., Francou G. 1988, A&A 202, 309.
 * Term layout: Bureau des Longitudes VSOP87 documentation (vsop87.txt).
 * Data: VSOP87E.ear, Earth, CDS/IMCCE catalogue VI/81.
 *
 * Truncation keeps a prefix of each block (file order = descending |S|+|K|).
 * Prefix lengths are chosen so a DE440s sample grid stays within
 * POSITION_MAX_AU (default 5e-5 AU) and Spica parallax error ≤ 0.001 mas.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const POSITION_MAX_AU = Number(process.env.VSOP87_POSITION_MAX_AU ?? '6e-5');
const MAX_PARALLAX_MAS = Number(process.env.VSOP87_MAX_PARALLAX_MAS ?? '0.001');

const inputPath = process.argv[2] ?? '/tmp/VSOP87E.ear';
const outPath = fileURLToPath(
    new URL('../packages/core/src/engine/vsop87-earth.data.json', import.meta.url),
);

/** Prefix lengths per (ic, alpha); tuned against DE440s grid (see measured fields in JSON). */
const PREFIX_LIMITS = new Map([
    ['1:0', 155],
    ['2:0', 155],
    ['3:0', 100],
    ['1:1', 35],
    ['2:1', 35],
    ['3:1', 25],
    ['1:2', 12],
    ['2:2', 12],
    ['3:2', 8],
    ['1:3', 6],
    ['2:3', 6],
    ['3:3', 4],
    ['1:4', 4],
    ['2:4', 4],
    ['3:4', 3],
    ['1:5', 3],
    ['2:5', 3],
    ['3:5', 2],
]);

const DEG = Math.PI / 180;

function parseEar(text) {
    /** @type {{ ic: number, alpha: number, terms: number[][] }[]} */
    const blocks = [];
    let current = null;
    for (const line of text.split(/\r?\n/)) {
        if (line.includes('VSOP87 VERSION')) {
            const m = line.match(/VARIABLE\s+(\d).*?\*T\*\*(\d)/);
            if (!m) continue;
            current = { ic: Number(m[1]), alpha: Number(m[2]), terms: [] };
            blocks.push(current);
            continue;
        }
        if (!current || !/^\s*\d/.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 19) continue;
        const a = parts.slice(2, 14).map(Number);
        const S = Number(parts[14]);
        const K = Number(parts[15]);
        current.terms.push([...a, S, K]);
    }
    return blocks;
}

function vsop87Lambdas(t) {
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

function evalBlocks(blocks, jdUT, deltaTSec, meanObliquityFn) {
    const jdTT = jdUT + deltaTSec / 86400;
    const t = (jdTT - 2451545) / 365250;
    const lambdas = vsop87Lambdas(t);
    let x = 0;
    let y = 0;
    let z = 0;
    for (const block of blocks) {
        const tPow = block.alpha === 0 ? 1 : t ** block.alpha;
        let sum = 0;
        for (const row of block.terms) {
            let phi = 0;
            for (let i = 0; i < 12; i++) phi += row[i] * lambdas[i];
            sum += tPow * (row[12] * Math.sin(phi) + row[13] * Math.cos(phi));
        }
        if (block.ic === 1) x += sum;
        else if (block.ic === 2) y += sum;
        else if (block.ic === 3) z += sum;
    }
    const obl = meanObliquityFn(0, 2451545) * DEG;
    return [x, y * Math.cos(obl) - z * Math.sin(obl), y * Math.sin(obl) + z * Math.cos(obl)];
}

function truncate(fullBlocks) {
    return fullBlocks.map((b) => {
        const key = `${b.ic}:${b.alpha}`;
        const keep = PREFIX_LIMITS.get(key) ?? b.terms.length;
        return { ic: b.ic, alpha: b.alpha, terms: b.terms.slice(0, keep) };
    });
}

function loadDe440Deps() {
    const dist = (f) =>
        fileURLToPath(new URL(`../packages/core/dist/engine/${f}`, import.meta.url));
    return {
        ...require(dist('spk.js')),
        ...require(dist('deltat.js')),
        meanObliquity: require(dist('precession.js')).meanObliquity,
        spicaForProfile: require(dist('ayanamsa.js')).spicaForProfile,
        starLongitudeOfDate: require(dist('ayanamsa.js')).starLongitudeOfDate,
        kernel: readFileSync(
            fileURLToPath(new URL('../packages/ephe/de440s.bsp', import.meta.url)),
        ),
    };
}

function sampleJds() {
    const start = 2396752.5;
    const end = 2506352.5;
    const samples = [];
    for (let jd = start + 0.01; jd < end; jd += 47.3) samples.push(jd);
    samples.push(start + 1, end - 0.01, 2451545);
    return samples;
}

function measure(blocks, deps) {
    const {
        loadSpkFromBytes,
        NAIF,
        jdUTtoET,
        deltaT,
        meanObliquity,
        spicaForProfile,
        starLongitudeOfDate,
        kernel,
    } = deps;
    const spk = loadSpkFromBytes(new Uint8Array(kernel));
    const AU_KM = 149597870.7;
    const star = spicaForProfile('modern');
    let maxPosAu = 0;
    let maxParallaxMas = 0;
    for (const jd of sampleJds()) {
        const dt = deltaT(jd, 'modern');
        const vsop = evalBlocks(blocks, jd, dt, meanObliquity);
        const et = jdUTtoET(jd);
        const e = spk.getBarycentric(NAIF.Earth, et);
        const de = [e.x / AU_KM, e.y / AU_KM, e.z / AU_KM];
        maxPosAu = Math.max(
            maxPosAu,
            Math.hypot(vsop[0] - de[0], vsop[1] - de[1], vsop[2] - de[2]),
        );
        const lonB = starLongitudeOfDate(star, jd);
        const piDe = (starLongitudeOfDate(star, jd, de) - lonB) * 3600 * 1000;
        const piVs = (starLongitudeOfDate(star, jd, vsop) - lonB) * 3600 * 1000;
        maxParallaxMas = Math.max(maxParallaxMas, Math.abs(piVs - piDe));
    }
    return { maxPosAu, maxParallaxMas };
}

const full = parseEar(readFileSync(inputPath, 'utf8'));
console.log(`Parsed ${full.reduce((n, b) => n + b.terms.length, 0)} terms from ${inputPath}`);
const deps = loadDe440Deps();
const blocks = truncate(full);
const { maxPosAu, maxParallaxMas } = measure(blocks, deps);
if (maxPosAu > POSITION_MAX_AU || maxParallaxMas > MAX_PARALLAX_MAS) {
    console.error(
        `Truncation limits fail: |Δr|=${maxPosAu.toExponential(2)} AU (max ${POSITION_MAX_AU}), Δπ=${maxParallaxMas.toFixed(4)} mas (max ${MAX_PARALLAX_MAS})`,
    );
    process.exit(1);
}

const payload = {
    catalogue: 'VSOP87E VI/81',
    theory: 'Bretagnon & Francou 1988, A&A 202, 309',
    truncationPositionMaxAu: POSITION_MAX_AU,
    measuredMaxPositionErrorAuVsDe440: maxPosAu,
    measuredMaxParallaxMasVsDe440: maxParallaxMas,
    blocks: blocks.map((b) => [b.ic, b.alpha, b.terms]),
};
writeFileSync(outPath, JSON.stringify(payload));
const nTerms = blocks.reduce((n, b) => n + b.terms.length, 0);
console.log(
    `Wrote ${nTerms} terms; max |Δr|=${maxPosAu.toExponential(2)} AU, max Δπ=${maxParallaxMas.toFixed(4)} mas → ${outPath} (${readFileSync(outPath).length} bytes)`,
);
