/**
 * Merge truth + library samples, compute residuals, write results.json and REPORT.md
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizeResiduals, signedDeltaDeg } from './lib/angles.mjs';
import { buildEraSpecs } from './lib/epochs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCH_ROOT = __dirname;

const COMPETITOR_LIBS = new Set([
    'node-jhora',
    'node-jhora-truth',
    'pyswisseph',
    'astronomy-engine',
    'astronomia',
]);

/** @typedef {{ lon: number; lat: number }} Coord */

/**
 * @param {Coord} truth
 * @param {Coord} lib
 */
function residualArcsec(truth, lib) {
    const dLon = signedDeltaDeg(lib.lon, truth.lon) * 3600;
    const dLat = (lib.lat - truth.lat) * 3600;
    return { dLon, dLat, combined: Math.hypot(dLon, dLat) };
}

function eraForJd(jdUt) {
    for (const era of buildEraSpecs(false)) {
        if (jdUt >= era.jdMin && jdUt <= era.jdMax) return era.id;
    }
    return 'era_deep_sparse';
}

function loadJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function buildNotBest(summary, frame) {
    /** @type {object[]} */
    const notBest = [];
    const byCase = new Map();
    for (const row of summary) {
        if (row.frame !== frame) continue;
        const k = `${row.era}:${row.body}`;
        const list = byCase.get(k) ?? [];
        list.push(row);
        byCase.set(k, list);
    }
    for (const [key, list] of byCase.entries()) {
        const competitors = list.filter(
            (r) => r.library !== 'skyfield' && COMPETITOR_LIBS.has(r.library),
        );
        const sorted = [...competitors].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
        const best = sorted[0];
        const nj = list.find((r) => r.library === 'node-jhora');
        const njTruth = list.find((r) => r.library === 'node-jhora-truth');
        const candidate = njTruth ?? nj;
        if (!candidate || !best || best.library === candidate.library) continue;
        if (best.library === 'node-jhora-truth' && candidate.library === 'node-jhora') continue;
        notBest.push({
            case: key,
            bestLibrary: best.library,
            bestMaxArcsec: best.max,
            nodeJhoraMaxArcsec: candidate.max,
            gapArcsec: (candidate.max ?? 0) - (best.max ?? 0),
        });
    }
    notBest.sort((a, b) => b.gapArcsec - a.gapArcsec);
    return notBest;
}

function analyze(deltaTMode) {
    const truthDoc = loadJson(join(BENCH_ROOT, 'artifacts/truth.json'));
    const pyDoc = loadJson(join(BENCH_ROOT, `artifacts/python_${deltaTMode}.json`));
    const nodeDoc = loadJson(join(BENCH_ROOT, `artifacts/node_${deltaTMode}.json`));

    const truthMap = new Map();
    for (const row of truthDoc.truth) {
        if (row.error || !row.body) continue;
        truthMap.set(`${row.jdUt}:${row.body}`, {
            tropicalTrue: row.tropicalTrue,
            lahiriIae: row.lahiriIae,
        });
    }

    const allSamples = [...(pyDoc.samples ?? []), ...(nodeDoc.samples ?? [])];

    /** @type {Record<string, Record<string, Record<string, number[]>>>} */
    const buckets = {};

    for (const row of allSamples) {
        if (row.error || !row.body || !row.library) continue;
        const key = `${row.jdUt}:${row.body}`;
        const truth = truthMap.get(key);
        if (!truth) continue;
        const era = eraForJd(row.jdUt);
        for (const frame of ['tropicalTrue', 'lahiriIae']) {
            const t = truth[frame];
            const l = row[frame];
            if (!t || !l) continue;
            const { combined } = residualArcsec(t, l);
            buckets[frame] ??= {};
            buckets[frame][era] ??= {};
            buckets[frame][era][row.library] ??= {};
            buckets[frame][era][row.library][row.body] ??= [];
            buckets[frame][era][row.library][row.body].push(combined);
        }
    }

    const summary = [];
    for (const frame of Object.keys(buckets)) {
        for (const era of Object.keys(buckets[frame])) {
            for (const lib of Object.keys(buckets[frame][era])) {
                for (const body of Object.keys(buckets[frame][era][lib])) {
                    const stats = summarizeResiduals(buckets[frame][era][lib][body]);
                    summary.push({ frame, era, library: lib, body, ...stats });
                }
            }
        }
    }

    return {
        deltaTMode,
        summary,
        parityGate: deltaTMode === 'shared' ? buildParityGate({ summary }) : null,
        notBestTropicalTrue: deltaTMode === 'shared' ? buildNotBest(summary, 'tropicalTrue') : [],
        notBestLahiriIae: deltaTMode === 'shared' ? buildNotBest(summary, 'lahiriIae') : [],
        generatedAt: new Date().toISOString(),
    };
}

function renderSummaryTable(doc, { frame = null } = {}) {
    const lines = [
        '| Frame | Era | Library | Body | n | max″ | RMS″ | p99″ |',
        '| --- | --- | --- | --- | ---: | ---: | ---: | ---: |',
    ];
    const rows = doc.summary
        .filter((row) => row.n > 0 && (frame == null || row.frame === frame))
        .sort((a, b) =>
            `${a.frame}${a.era}${a.library}${a.body}`.localeCompare(
                `${b.frame}${b.era}${b.library}${b.body}`,
            ),
        );
    for (const row of rows) {
        lines.push(
            `| ${row.frame} | ${row.era} | ${row.library} | ${row.body} | ${row.n} | ${row.max?.toFixed(3)} | ${row.rms?.toFixed(3)} | ${row.p99?.toFixed(3)} |`,
        );
    }
    return lines;
}

function renderNotBest(title, notBest, frameLabel) {
    const lines = [`## ${title}`, ''];
    if (notBest.length === 0) {
        lines.push(
            `_No cases — node-jhora had the smallest max residual everywhere sampled (${frameLabel})._`,
            '',
        );
        return lines;
    }
    lines.push('| Case (era:body) | Best library | Best max″ | node-jhora max″ | Gap″ |');
    lines.push('| --- | --- | ---: | ---: | ---: |');
    for (const row of notBest) {
        lines.push(
            `| ${row.case} | ${row.bestLibrary} | ${row.bestMaxArcsec?.toFixed(3)} | ${row.nodeJhoraMaxArcsec?.toFixed(3)} | ${row.gapArcsec?.toFixed(3)} |`,
        );
    }
    lines.push('');
    return lines;
}

function renderSanity() {
    const path = join(BENCH_ROOT, 'artifacts/competitor_sanity.json');
    if (!existsSync(path)) {
        return [
            '## J2000 TT competitor sanity',
            '',
            '_Not run (missing artifacts/competitor_sanity.json)._',
            '',
        ];
    }
    const sanity = JSON.parse(readFileSync(path, 'utf8'));
    const lines = [
        '## J2000 TT competitor sanity',
        '',
        'Post-run gate (`truth/validate_competitors.py`): DE440/ERFA truth Sun at J2000 TT noon vs adapter smoke tests (Espenak–Meeus ΔT).',
        '',
        '| Field | Value |',
        '| --- | --- |',
        `| jdUt | ${sanity.jdUt} |`,
        `| deltaTSeconds | ${sanity.deltaTSeconds} |`,
        `| truthSunLonDeg | ${sanity.truthSunLonDeg} |`,
    ];
    if (sanity.pyswissephSunLonDeg != null) {
        lines.push(`| pyswissephSunLonDeg | ${sanity.pyswissephSunLonDeg} |`);
        lines.push(
            `| pyswissephSunResidualArcsec | ${sanity.pyswissephSunResidualArcsec?.toFixed(4)} |`,
        );
    }
    if (sanity.astronomyEngineSunLonDeg != null) {
        lines.push(`| astronomyEngineSunLonDeg | ${sanity.astronomyEngineSunLonDeg} |`);
        lines.push(
            `| astronomyEngineSunResidualArcsec | ${sanity.astronomyEngineSunResidualArcsec?.toFixed(4)} |`,
        );
    }
    lines.push('');
    return lines;
}

function renderReport(shared, native) {
    const lines = [
        '# Cross-library ephemeris accuracy',
        '',
        'Tooling under `bench/accuracy/` (not shipped). **Benchmark truth** (`artifacts/truth.json`) uses the same published definition as `truth_profile_erfa.json` / ADR 0027: DE440/DE441 geocentric apparent, TDB (ERFA dtdb) with two-part dates, mean ecliptic (ecm06) with nut06a Δψ on longitude only. Pre-run gate: `artifacts/validation.json` (repeatability + logged bias vs Skyfield true ecliptic of date).',
        '',
        "The **`skyfield` competitor column** is separate: Skyfield apparent **true** equator/ecliptic of date (`epoch='date'`). Residuals vs benchmark truth are ~0.02″ (IAU 2000 frame-bias / obliquity route), not ephemeris kernel error.",
        '',
        'See [ADR 0024](../../docs/decisions/0024-cross-library-accuracy-benchmark.md) for scoring policy.',
        '',
        ...renderSanity(),
        '## ΔT modes',
        '',
        '- **shared TT + ΔT (headline table below)**: identical Espenak–Meeus ΔT (`lib/deltat.json`) for benchmark truth and every adapter that supports override. This is the only table used for cross-library ephemeris ranking on `tropicalTrue`.',
        '- **native ΔT (appendix table)**: each library’s built-in ΔT while truth still uses the shared table. Residuals measure **ΔT-model disagreement**, not ephemeris error alone. Example: `node-jhora-truth` Moon at ~124″ in 1850–2150 is almost entirely Espenak–Meeus vs the engine’s native ΔT (~2.1 min at recent epochs), not a DE440 defect.',
        '',
        '## Hosted APIs',
        '',
        'No payment-free, signup-free hosted astrology API was wired in this revision (most public chart APIs require keys or billing).',
        '',
        '## Headline accuracy — shared Espenak–Meeus ΔT (`tropicalTrue` only)',
        '',
        '### Residual summary vs benchmark truth (combined lon/lat, arcsec)',
        '',
        ...renderSummaryTable(shared, { frame: 'tropicalTrue' }),
        '',
        ...renderNotBest(
            'node-jhora not ranked #1 — tropical apparent (tropicalTrue, max residual)',
            shared.notBestTropicalTrue,
            'tropicalTrue',
        ),
        ...renderParityGate(shared.parityGate),
        '## Sidereal Lahiri IAE — shared ΔT (`lahiriIae`)',
        '',
        ...renderSummaryTable(shared, { frame: 'lahiriIae' }),
        '',
        ...renderNotBest(
            'node-jhora not ranked #1 — Lahiri IAE sidereal (lahiriIae, max residual)',
            shared.notBestLahiriIae,
            'lahiriIae (shared Lahiri definition)',
        ),
        '## Native ΔT appendix — ΔT-model differences vs shared-truth reference',
        '',
        '_Truth still uses the shared Espenak–Meeus ΔT table; library outputs use native ΔT. Large Moon/Sun residuals here usually mean ΔT disagreement (often 100″+ on the Moon), not necessarily wrong JPL state._',
        '',
        '### Residual summary (`tropicalTrue` only, arcsec)',
        '',
        ...renderSummaryTable(native, { frame: 'tropicalTrue' }),
        '',
    ];
    return lines.join('\n');
}

function buildParityGate(shared) {
    const ERA = 'era_1850_2150';
    const LIB = 'node-jhora-truth';
    const bodies = [
        'Sun',
        'Moon',
        'Mercury',
        'Venus',
        'Mars',
        'Jupiter',
        'Saturn',
        'Uranus',
        'Neptune',
        'Pluto',
        'MeanNode',
        'TrueNode',
    ];
    const TOL = 0.0001;
    const rows = [];
    for (const body of bodies) {
        const row = shared.summary.find(
            (r) =>
                r.frame === 'tropicalTrue' && r.era === ERA && r.library === LIB && r.body === body,
        );
        const max = row?.max ?? null;
        rows.push({ body, maxArcsec: max, pass: max != null && max <= TOL });
    }
    return { toleranceArcsec: TOL, era: ERA, library: LIB, rows };
}

function renderParityGate(gate) {
    const lines = [
        '## node-jhora-truth vs benchmark truth (shared ΔT, era_1850_2150)',
        '',
        'Independent ERFA+Skyfield benchmark truth vs `@node-jhora/core` `precisionProfile: truth` on the same Espenak–Meeus ΔT. Target ≤ 0.0001″ per body (golden fixture parity on Sun/Moon/Pluto; full grid adds outers).',
        '',
        '| Body | max″ | Pass |',
        '| --- | ---: | :---: |',
    ];
    for (const row of gate.rows) {
        const max =
            row.maxArcsec == null ? '—' : row.maxArcsec < 1e-6 ? '~0' : row.maxArcsec.toFixed(6);
        lines.push(`| ${row.body} | ${max} | ${row.pass ? 'yes' : '**no**'} |`);
    }
    const failed = gate.rows.filter((r) => !r.pass);
    if (failed.length > 0) {
        lines.push('');
        lines.push(
            `**Parity gate:** ${failed.length} body/bodies above ${gate.toleranceArcsec}″. Example: Neptune max is mostly mean-ecliptic latitude (β) at a grid epoch — Skyfield \`.apparent()\` + ERFA \`ecm06\` chart vs the engine truth pipeline on that outer planet; not the former ~0.022″ frame-bias artefact. Do not relax tolerances; fix the pipeline or oracle in a follow-up.`,
        );
    }
    lines.push('');
    return lines;
}

function main() {
    const shared = analyze('shared');
    const native = analyze('native');

    for (const row of shared.parityGate.rows) {
        if (!row.pass) {
            throw new Error(
                `node-jhora-truth ${row.body} era_1850_2150 max ${row.maxArcsec}″ exceeds ${shared.parityGate.toleranceArcsec}″ gate`,
            );
        }
    }

    mkdirSync(join(BENCH_ROOT, 'artifacts'), { recursive: true });
    writeFileSync(
        join(BENCH_ROOT, 'artifacts/results.json'),
        JSON.stringify({ shared, native }, null, 2),
    );
    writeFileSync(join(BENCH_ROOT, 'REPORT.md'), renderReport(shared, native));
    console.log('Wrote artifacts/results.json and REPORT.md');
}

main();
