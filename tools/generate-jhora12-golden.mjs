#!/usr/bin/env node
/**
 * Regenerate packages/core/tests/fixtures/jhora_golden.ts from the 12-chart bundle.
 *
 * Sources (committed under packages/core/tests/fixtures/jhora12/):
 *   MANIFEST.json, reports committed as jhora12-comparison.json
 *
 *   pnpm exec node tools/generate-jhora12-golden.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = join(root, 'packages/core/tests/fixtures/jhora12');
const comparison = JSON.parse(readFileSync(join(bundleDir, 'jhora12-comparison.json'), 'utf8'));
const reports = JSON.parse(readFileSync(join(bundleDir, 'jhora_reports.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(bundleDir, 'MANIFEST.json'), 'utf8'));

const SIGN_BASE = {
    Ar: 0,
    Ta: 30,
    Ge: 60,
    Cn: 90,
    Le: 120,
    Vi: 150,
    Li: 180,
    Sc: 210,
    Sg: 240,
    Cp: 270,
    Aq: 300,
    Pi: 330,
};

const SIGN_NUM = {
    Ar: 1,
    Ta: 2,
    Ge: 3,
    Cn: 4,
    Le: 5,
    Vi: 6,
    Li: 7,
    Sc: 8,
    Sg: 9,
    Cp: 10,
    Aq: 11,
    Pi: 12,
};

const MOON_DT_CHARTS = new Set(['2020-12-21_1820_Varanasi', '2024-04-08_1318_Dallas']);
const DE441_CHARTS = new Set(['1600-05-01_1200_Rome', '1800-08-15_1500_Cape-Town']);

function parseUt(ut) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UT$/.exec(ut);
    if (!m) throw new Error(`bad ut ${ut}`);
    return {
        year: +m[1],
        month: +m[2],
        day: +m[3],
        hour: +m[4],
        minute: +m[5],
        second: +m[6],
    };
}

function parseLocal(local) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(local);
    if (!m) throw new Error(`bad local ${local}`);
    return {
        year: +m[1],
        month: +m[2],
        day: +m[3],
        hour: +m[4],
        minute: +m[5],
        second: +m[6],
    };
}

function bodyTol(chartName, body, cls, diffArcsec) {
    if (body === 'Moon' && MOON_DT_CHARTS.has(chartName)) return 0.2;
    const margin = 0.015;
    const base = Math.abs(diffArcsec) + margin;
    if (body === 'Lagna') return Math.max(0.02, Math.min(base, 2.0));
    if (body === 'Ayanamsa') return Math.max(0.02, Math.min(base, 0.5));
    if (cls === 'Nodes') return Math.max(0.02, Math.min(base, 2.0));
    return Math.max(0.02, Math.min(base, 1.0));
}

function chartEntry(name) {
    const man = manifest.charts.find((c) => c.name === name);
    const cmp = comparison.charts[name];
    if (!man || !cmp) throw new Error(`missing ${name}`);
    const utc = parseUt(man.ut_datetime);
    const local = parseLocal(man.local_datetime);
    const ayan = cmp.ayanamsa;
    const bodies = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    const d1 = bodies.map((bodyName) => {
        const row = cmp.bodies[bodyName];
        const rep = reports[name]?.bodies?.[bodyName];
        const sign = SIGN_NUM[row.jhora_printed.trim().split(/\s+/)[1]] ?? 0;
        return {
            name: bodyName,
            printed: row.jhora_printed,
            sign,
            longitude: row.jhora_deg,
            ...(rep?.retro ? { retrograde: true } : {}),
            toleranceArcsec: bodyTol(name, bodyName, row.cls, row.diff_arcsec),
        };
    });
    const lagna = cmp.bodies.Lagna;
    return {
        id: name,
        place: man.place,
        timezone: man.tz_offset_hours === 0 ? 'UTC' : undefined,
        utcOffsetHours: man.tz_offset_hours,
        utc,
        local,
        lat: man.lat,
        lon: man.lon,
        jd: cmp.jd_ut,
        needsDe441: DE441_CHARTS.has(name),
        ayanamsa: {
            printed: ayan.jhora_printed,
            value: ayan.jhora_deg,
            toleranceArcsec: bodyTol(name, 'Ayanamsa', 'Ayanamsa', ayan.diff_arcsec),
        },
        ascendant: {
            printed: lagna.jhora_printed,
            sign: SIGN_NUM[lagna.jhora_printed.trim().split(/\s+/)[1]] ?? 0,
            longitude: lagna.jhora_deg,
            toleranceArcsec: bodyTol(name, 'Lagna', lagna.cls, lagna.diff_arcsec),
        },
        d1,
    };
}

const chartNames = manifest.charts.map((c) => c.name).sort();
const charts = chartNames.map(chartEntry);

const header = `/**
 * JHora parity fixture — twelve fictional reference charts.
 *
 * Provenance: Jagannatha Hora 8.0 GUI, screen-transcribed at 0.01″ display
 * precision. Settings: UserSelectedAyanamsa=17 (True Chitra), true nodes,
 * topocentric off, altitude 0 m. Preset \`jhora-true-citra-geometric-true-node\`.
 *
 * Per-body arcsecond tolerances are set from measured engine residuals at
 * commit ${comparison.engine.commit.slice(0, 7)} (see
 * packages/core/tests/fixtures/jhora12/jhora12-comparison.json). Moon on
 * Varanasi 2020 and Dallas 2024 uses a wider per-chart budget (ΔT ≈ 0.27 s).
 *
 * Regenerate: pnpm exec node tools/generate-jhora12-golden.mjs
 */

/** Degrees from a JHora "DD-MM-SS.ss" ayanamsa string. */
export function dms(deg: number, min: number, sec: number): number {
    return deg + min / 60 + sec / 3600;
}

/** Sign abbreviations as JHora prints them, in zodiacal order. */
const SIGN_BASE: Record<string, number> = ${JSON.stringify(SIGN_BASE, null, 4).replace(/"([^"]+)":/g, '$1:')};

/** Absolute longitude from a JHora body line. */
export function lon(
    deg: number,
    sign: keyof typeof SIGN_BASE | string,
    min: number,
    sec: number,
): number {
    return SIGN_BASE[sign] + deg + min / 60 + sec / 3600;
}

export const JHORA_CONVENTIONS = {
    ayanamsaMode: 27,
    positionMode: 'geometric' as const,
    nodeType: 'true' as const,
} as const;

export const JHORA_REFERENCE_CHART_ID = '2000-01-01_1200_Greenwich' as const;

export interface JhoraChartBody {
    name: string;
    printed: string;
    sign: number;
    longitude: number;
    retrograde?: boolean;
    toleranceArcsec: number;
}

export interface JhoraChartCase {
    id: string;
    place: string;
    utcOffsetHours: number;
    utc: { year: number; month: number; day: number; hour: number; minute: number; second: number };
    local: { year: number; month: number; day: number; hour: number; minute: number; second: number };
    lat: number;
    lon: number;
    jd: number;
    /** Outside DE440s — requires NJCE441 chunks in CI. */
    needsDe441: boolean;
    ayanamsa: { printed: string; value: number; toleranceArcsec: number };
    ascendant: { printed: string; sign: number; longitude: number; toleranceArcsec: number };
    d1: JhoraChartBody[];
}

export const JHORA_CHARTS: readonly JhoraChartCase[] = ${JSON.stringify(charts, null, 4)} as const;

/** Primary chart for convention / varga / panchanga regression tests. */
export const JHORA_BIRTH = (() => {
    const c = JHORA_CHARTS.find((x) => x.id === JHORA_REFERENCE_CHART_ID)!;
    return {
        local: { ...c.local, utcOffset: c.utcOffsetHours },
        utc: c.utc,
        lat: c.lat,
        lon: c.lon,
        jd: c.jd,
    };
})();

export const JHORA_AYANAMSA = (() => {
    const c = JHORA_CHARTS.find((x) => x.id === JHORA_REFERENCE_CHART_ID)!;
    return { ...c.ayanamsa, mode: 27 as const };
})();

export const JHORA_D1 = JHORA_CHARTS.find((x) => x.id === JHORA_REFERENCE_CHART_ID)!.d1;
export const JHORA_ASCENDANT = JHORA_CHARTS.find((x) => x.id === JHORA_REFERENCE_CHART_ID)!.ascendant;

`;

writeFileSync(join(root, 'packages/core/tests/fixtures/jhora_golden.ts'), header, 'utf8');
console.log(`Wrote jhora_golden.ts (${charts.length} charts)`);
