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
        notBestTropicalTrue: deltaTMode === 'shared' ? buildNotBest(summary, 'tropicalTrue') : [],
        notBestLahiriIae: deltaTMode === 'shared' ? buildNotBest(summary, 'lahiriIae') : [],
        generatedAt: new Date().toISOString(),
    };
}

function renderSummaryTable(doc) {
    const lines = [
        '| Frame | Era | Library | Body | n | max″ | RMS″ | p99″ |',
        '| --- | --- | --- | --- | ---: | ---: | ---: | ---: |',
    ];
    for (const row of doc.summary.sort((a, b) =>
        `${a.frame}${a.era}${a.library}${a.body}`.localeCompare(
            `${b.frame}${a.era}${b.library}${b.body}`,
        ),
    )) {
        if (row.n === 0) continue;
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
        'Tooling under `bench/accuracy/` (not shipped). Planet truth: apparent **true ecliptic of date** from JPL DE440/DE441 via Skyfield; ERFA gate < 1 mas in DE440 era (`artifacts/validation.json`). True node truth: **TN-MED-LT1** (`truth/true_node_truth.py` — Skyfield DE state + ERFA mean ecliptic + nut06a Δψ; not the engine CLI).',
        '',
        'See [ADR 0024](../../docs/decisions/0024-cross-library-accuracy-benchmark.md) for every convention.',
        '',
        ...renderSanity(),
        '## ΔT modes',
        '',
        '- **shared (headline accuracy)**: identical Espenak–Meeus ΔT table (`lib/deltat.json`) passed into every adapter that supports override. Truth uses this same table.',
        '- **native**: each library’s built-in ΔT. Residuals vs truth measure **ΔT-model differences relative to the Espenak–Meeus reference**, not ephemeris kernel error alone.',
        '',
        '## Hosted APIs',
        '',
        'No payment-free, signup-free hosted astrology API was wired in this revision (most public chart APIs require keys or billing).',
        '',
        '## Headline accuracy — shared Espenak–Meeus ΔT',
        '',
        '### Residual summary (combined lon/lat, arcsec)',
        '',
        ...renderSummaryTable(shared),
        '',
        ...renderNotBest(
            'node-jhora not ranked #1 — tropical apparent (tropicalTrue, max residual)',
            shared.notBestTropicalTrue,
            'tropicalTrue',
        ),
        ...renderNotBest(
            'node-jhora not ranked #1 — Lahiri IAE sidereal (lahiriIae, max residual)',
            shared.notBestLahiriIae,
            'lahiriIae (shared Lahiri definition)',
        ),
        '## Native ΔT — ΔT-model differences vs Espenak–Meeus reference',
        '',
        '_Truth still uses the shared ΔT table; library outputs use native ΔT. Large residuals here usually mean ΔT disagreement, not necessarily wrong ephemeris._',
        '',
        '### Residual summary (combined lon/lat, arcsec)',
        '',
        ...renderSummaryTable(native),
        '',
    ];
    return lines.join('\n');
}

function main() {
    const shared = analyze('shared');
    const native = analyze('native');
    mkdirSync(join(BENCH_ROOT, 'artifacts'), { recursive: true });
    writeFileSync(
        join(BENCH_ROOT, 'artifacts/results.json'),
        JSON.stringify({ shared, native }, null, 2),
    );
    writeFileSync(join(BENCH_ROOT, 'REPORT.md'), renderReport(shared, native));
    console.log('Wrote artifacts/results.json and REPORT.md');
}

main();
