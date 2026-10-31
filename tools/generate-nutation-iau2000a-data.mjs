/**
 * Transcribe IAU 2000A (MHB2000) nutation series from ERFA nut00a (BSD-3) into a
 * compact JSON fixture for @node-jhora/core.
 *
 * Source: https://github.com/liberfa/erfa — see THIRD_PARTY_NOTICES.md for the
 * full ERFA licence text (redistribution of transcribed tables requires it).
 */
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const url = 'https://raw.githubusercontent.com/liberfa/erfa/master/src/nut00a.c';
const src = execSync(`curl -fsSL '${url}'`, { encoding: 'utf8' });

const lsBlocks = [...src.matchAll(/\{\s*\/\*\s*1-\s*10\s*\*\/([\s\S]*?)\}\s*;/g)];
if (lsBlocks.length < 1) throw new Error('failed to parse luni-solar block');

function parseEntries(blockText) {
    const entries = [];
    const re = /\{\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*([^}]+)\}/g;
    let m;
    while ((m = re.exec(blockText)) !== null) {
        const nums = m[6]
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n));
        if (nums.length !== 6) continue;
        entries.push({
            m: [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])],
            sp: nums[0],
            spt: nums[1],
            cp: nums[2],
            ce: nums[3],
            cet: nums[4],
            se: nums[5],
        });
    }
    return entries;
}

// Luni-solar: between first xls[] = { and closing }; before planetary section
const lsStart = src.indexOf('xls[] = {');
const plStart = src.indexOf('xpl[] = {');
if (lsStart < 0 || plStart < 0) throw new Error('nut00a structure changed');
const lsText = src.slice(lsStart, plStart);
const plEnd = src.indexOf('};', plStart + 10);
const plText = src.slice(plStart, plEnd);

function parsePlanetary(blockText) {
    const entries = [];
    const re =
        /\{\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\s*\}/g;
    let m;
    while ((m = re.exec(blockText)) !== null) {
        entries.push({
            m: [
                Number(m[1]),
                Number(m[2]),
                Number(m[3]),
                Number(m[4]),
                Number(m[5]),
                Number(m[6]),
                Number(m[7]),
                Number(m[8]),
                Number(m[9]),
                Number(m[10]),
                Number(m[11]),
                Number(m[12]),
                Number(m[13]),
            ],
            sp: Number(m[14]),
            cp: Number(m[15]),
            se: Number(m[16]),
            ce: Number(m[17]),
        });
    }
    return entries;
}

const luniSolar = parseEntries(lsText);
const planetary = parsePlanetary(plText);

const out = {
    provenance:
        'IAU 2000A (MHB2000); coefficients transcribed from ERFA nut00a (BSD-3, NumFOCUS/IAU SOFA). See repo THIRD_PARTY_NOTICES.md. Units: 0.1 μas; rates per Julian century.',
    luniSolar,
    planetary,
};

const dest = new URL('../packages/core/src/engine/nutation-iau2000a.data.json', import.meta.url);
writeFileSync(dest, JSON.stringify(out));
console.log(
    `wrote ${luniSolar.length} luni-solar + ${planetary.length} planetary terms → ${dest.pathname}`,
);
