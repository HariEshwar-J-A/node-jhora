import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REGRESSION_TOLERANCE } from './budgets.js';
import { baselinePath, resultsArtifactPath } from './paths.js';
import { isRegression } from './stats.js';
import type { BenchBaselineFile, BenchResultsArtifact } from './types.js';

/** PR1 baseline p50 on the reference host (schemaVersion 2). PR2 must beat this ratio. */
const SERVER_GRADE_PR1_FULL_CHART_JHORA_P50 = 25.901004;
const SERVER_GRADE_PR2_FULL_CHART_MAX_P50 = SERVER_GRADE_PR1_FULL_CHART_JHORA_P50 * 0.7;
const SERVER_GRADE_PR1_PLANETS_JHORA_P50 = 0.5597119999999904;
const SERVER_GRADE_PR2_PLANETS_MAX_DELTA = 0.15;

/** Post-PR2 baseline (main @ de758a3) p50 before PR4 memo — PR4 improvement gates. */
const SERVER_GRADE_PR4_TRUTH_PLANETS_BASE_P50 = 1.9086559999999508;
const SERVER_GRADE_PR4_TRUTH_PLANETS_MAX_P50 = SERVER_GRADE_PR4_TRUTH_PLANETS_BASE_P50 * 0.5;
const SERVER_GRADE_PR4_TRUTH_DISTINCT_JD_FIRST_BASE_P50 = 72.05270599999994;
const SERVER_GRADE_PR4_TRUTH_DISTINCT_JD_FIRST_MAX_P50 =
    SERVER_GRADE_PR4_TRUTH_DISTINCT_JD_FIRST_BASE_P50 * 0.6;
const SERVER_GRADE_PR4_HOUSES_JHORA_BASE_P50 = 0.3208649999999693;
const SERVER_GRADE_PR4_PLANETS_JHORA_BASE_P50 = 0.5398720000000026;
/** Aspirational cold path (golden subprocess); bench p50 includes full Ω prefill. */
const SERVER_GRADE_PR4_DEEP_ERA_COLD_MAX_P50 = 250;

const __dirname = dirname(fileURLToPath(import.meta.url));

function baselineP50(entry: { p50Ms?: number; medianMs?: number }): number {
    return entry.p50Ms ?? entry.medianMs ?? Number.NaN;
}

async function runBench(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [join(__dirname, 'run-bench.js')], {
            stdio: 'inherit',
            env: process.env,
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`bench run exited ${code}`));
        });
    });
}

async function main(): Promise<void> {
    await runBench();

    const baselineRaw = await readFile(baselinePath(), 'utf8');
    const baseline = JSON.parse(baselineRaw) as BenchBaselineFile;
    const resultsRaw = await readFile(resultsArtifactPath(), 'utf8');
    const results = JSON.parse(resultsRaw) as BenchResultsArtifact;

    const tolerance = baseline.regressionTolerance ?? REGRESSION_TOLERANCE;
    const failures: string[] = [];
    const budgetMisses: string[] = [];

    for (const measured of results.cases) {
        if (measured.skipped) {
            continue;
        }
        const base = baseline.cases[measured.id];
        if (!base) {
            failures.push(`missing baseline entry for ${measured.id}`);
            continue;
        }
        const baseP50 = baselineP50(base);
        if (isRegression(baseP50, measured.p50Ms, tolerance)) {
            const pct = ((measured.p50Ms - baseP50) / baseP50) * 100;
            failures.push(
                `${measured.id}: p50 ${measured.p50Ms.toFixed(3)} ms regressed ${pct.toFixed(1)}% vs baseline ${baseP50.toFixed(3)} ms (limit ${tolerance * 100}%)`,
            );
        }
        if (measured.withinBudget === false && measured.budgetMs != null) {
            budgetMisses.push(
                `${measured.id}: p50 ${measured.p50Ms.toFixed(3)} ms exceeds budget ${measured.budgetMs} ms`,
            );
        }
    }

    const fullChartJhora = results.cases.find((c) => c.id === 'full-chart-jhora' && !c.skipped);
    if (fullChartJhora && fullChartJhora.p50Ms > SERVER_GRADE_PR2_FULL_CHART_MAX_P50) {
        failures.push(
            `full-chart-jhora: p50 ${fullChartJhora.p50Ms.toFixed(3)} ms exceeds PR2 gate ${SERVER_GRADE_PR2_FULL_CHART_MAX_P50.toFixed(3)} ms (0.70× PR1 ${SERVER_GRADE_PR1_FULL_CHART_JHORA_P50.toFixed(3)} ms)`,
        );
    }
    const planetsJhora = results.cases.find((c) => c.id === 'planets-jhora' && !c.skipped);
    if (planetsJhora) {
        const base = SERVER_GRADE_PR1_PLANETS_JHORA_P50;
        if (planetsJhora.p50Ms > base * (1 + SERVER_GRADE_PR2_PLANETS_MAX_DELTA)) {
            failures.push(
                `planets-jhora: p50 ${planetsJhora.p50Ms.toFixed(3)} ms regressed >${(SERVER_GRADE_PR2_PLANETS_MAX_DELTA * 100).toFixed(0)}% vs PR1 ${base.toFixed(3)} ms`,
            );
        }
    }

    const planetsTruth = results.cases.find((c) => c.id === 'planets-truth' && !c.skipped);
    if (planetsTruth && planetsTruth.p50Ms > SERVER_GRADE_PR4_TRUTH_PLANETS_MAX_P50) {
        failures.push(
            `planets-truth: p50 ${planetsTruth.p50Ms.toFixed(3)} ms exceeds PR4 gate ${SERVER_GRADE_PR4_TRUTH_PLANETS_MAX_P50.toFixed(3)} ms (0.50× post-PR2 ${SERVER_GRADE_PR4_TRUTH_PLANETS_BASE_P50.toFixed(3)} ms)`,
        );
    }
    const distinctFirst = results.cases.find(
        (c) => c.id === 'planets-truth-distinct-jd-first' && !c.skipped,
    );
    if (distinctFirst && distinctFirst.p50Ms > SERVER_GRADE_PR4_TRUTH_DISTINCT_JD_FIRST_MAX_P50) {
        failures.push(
            `planets-truth-distinct-jd-first: p50 ${distinctFirst.p50Ms.toFixed(3)} ms exceeds PR4 gate ${SERVER_GRADE_PR4_TRUTH_DISTINCT_JD_FIRST_MAX_P50.toFixed(3)} ms (0.60× post-PR2 ${SERVER_GRADE_PR4_TRUTH_DISTINCT_JD_FIRST_BASE_P50.toFixed(3)} ms)`,
        );
    }
    const housesJhora = results.cases.find((c) => c.id === 'houses-jhora' && !c.skipped);
    if (housesJhora && housesJhora.p50Ms >= SERVER_GRADE_PR4_HOUSES_JHORA_BASE_P50) {
        failures.push(
            `houses-jhora: p50 ${housesJhora.p50Ms.toFixed(3)} ms did not improve vs post-PR2 ${SERVER_GRADE_PR4_HOUSES_JHORA_BASE_P50.toFixed(3)} ms`,
        );
    }
    if (
        planetsJhora &&
        planetsJhora.p50Ms > SERVER_GRADE_PR4_PLANETS_JHORA_BASE_P50 * (1 + REGRESSION_TOLERANCE)
    ) {
        failures.push(
            `planets-jhora: p50 ${planetsJhora.p50Ms.toFixed(3)} ms regressed vs post-PR2 ${SERVER_GRADE_PR4_PLANETS_JHORA_BASE_P50.toFixed(3)} ms`,
        );
    }

    const deepCold = results.cases.find(
        (c) => c.id === 'deep-era-truth-mean-node-cold' && !c.skipped,
    );
    if (deepCold && deepCold.p50Ms > SERVER_GRADE_PR4_DEEP_ERA_COLD_MAX_P50) {
        failures.push(
            `deep-era-truth-mean-node-cold: p50 ${deepCold.p50Ms.toFixed(3)} ms exceeds PR4 gate ${SERVER_GRADE_PR4_DEEP_ERA_COLD_MAX_P50} ms`,
        );
    }

    if (budgetMisses.length > 0) {
        console.warn('\nPerformance budget misses (warning only — does not fail CI):');
        for (const line of budgetMisses) {
            console.warn(`  - ${line}`);
        }
        console.warn(
            '\nWarm full-chart time is dominated by Vimshottari dasha tree generation (Decimal.js + Luxon), not ephemeris or vargas alone. See packages/bench/artifacts/bench-results.json profileSplit.',
        );
    }

    if (failures.length > 0) {
        console.error('\nBench regression check failed:');
        for (const line of failures) {
            console.error(`  - ${line}`);
        }
        process.exit(1);
    }

    const jhoraPlanets = results.cases.find((c) => c.id === 'planets-jhora' && !c.skipped);
    const jhoraPlanetsBase = baseline.cases['planets-jhora'];
    if (jhoraPlanets && jhoraPlanetsBase) {
        const target = baselineP50(jhoraPlanetsBase) * 0.7;
        if (jhoraPlanets.p50Ms > target) {
            console.error(
                `\nBench PR3 gate failed: planets-jhora p50 ${jhoraPlanets.p50Ms.toFixed(3)} ms ` +
                    `must be ≤ 0.70× baseline (${target.toFixed(3)} ms)`,
            );
            process.exit(1);
        }
        console.log(
            `\nPR3 planets-jhora speedup gate: p50 ${jhoraPlanets.p50Ms.toFixed(3)} ms ` +
                `(≤ 0.70× ${baselineP50(jhoraPlanetsBase).toFixed(3)} ms)`,
        );
    }

    console.log('\nBench regression check passed.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
