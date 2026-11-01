import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EphemerisEngine } from '@node-jhora/core';
import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register';

import {
    EPHEMERIS_INIT_BUDGET_MS,
    NODE_FULL_CHART_BUDGET_MS,
    REGRESSION_TOLERANCE,
    SAMPLE_COUNT,
    WARMUP_ITERATIONS,
} from './budgets.js';
import {
    runAyanamsa,
    runFullChartWarm,
    runHouses,
    runPlanets,
    runPlanetsDistinctJdSweep,
} from './chart-fixture.js';
import { measureDistinctJdSecondPass, measureTimed } from './measure-latency.js';
import { artifactsDir, resultsArtifactPath } from './paths.js';
import { BENCH_PROFILES, type BenchProfileId, caseId } from './profiles.js';
import { p50, p99 } from './stats.js';
import type { BenchCaseResult, BenchProfileSplit, BenchResultsArtifact } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const measureOpts = {
    sampleCount: SAMPLE_COUNT,
    warmupIterations: WARMUP_ITERATIONS,
};

async function loadEopTable(engine: EphemerisEngine): Promise<void> {
    const eopPath = join(__dirname, '../../eop/eop.bin');
    const mod = await import(pathToFileURL(join(__dirname, '../../eop/index.mjs')).href);
    const table = mod.parseEopBin(readFileSync(eopPath));
    engine.setIersEopTable(table);
}

async function measureEphemerisInitMedian(): Promise<{
    p50Ms: number;
    p99Ms: number;
    rssMb: number;
    samplesMs: number[];
}> {
    const childEntry = join(__dirname, 'measure-ephemeris-init.js');
    const samplesMs: number[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
        const ms = await new Promise<number>((resolve, reject) => {
            const child = spawn(process.execPath, [childEntry], {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: process.env,
            });
            let out = '';
            child.stdout.on('data', (chunk) => {
                out += String(chunk);
            });
            child.on('error', reject);
            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`ephemeris init child exited ${code}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(out.trim()) as { ms: number };
                    resolve(parsed.ms);
                } catch (err) {
                    reject(err);
                }
            });
        });
        samplesMs.push(ms);
    }
    const rssMb = process.memoryUsage().rss / (1024 * 1024);
    const p50Ms = p50(samplesMs);
    return { p50Ms, p99Ms: p99(samplesMs), rssMb, samplesMs };
}

function caseResult(
    id: string,
    label: string,
    timing: {
        p50Ms: number;
        p99Ms: number;
        rssMb: number;
        samplesMs: number[];
        medianMs: number;
    },
    options: {
        profile?: BenchProfileId | 'none';
        workload?: BenchCaseResult['workload'];
        budgetMs: number | null;
        skipped?: boolean;
        skipReason?: string;
    },
): BenchCaseResult {
    return {
        id,
        label,
        profile: options.profile,
        workload: options.workload,
        p50Ms: timing.p50Ms,
        p99Ms: timing.p99Ms,
        rssMb: timing.rssMb,
        medianMs: timing.medianMs,
        samplesMs: timing.samplesMs,
        budgetMs: options.budgetMs,
        withinBudget: options.budgetMs == null ? null : timing.p50Ms <= options.budgetMs,
        skipped: options.skipped,
        skipReason: options.skipReason,
    };
}

async function measureDeepEraMeanNode(): Promise<{
    cold?: BenchCaseResult;
    warm?: BenchCaseResult;
}> {
    const childEntry = join(__dirname, 'measure-deep-era-mean-node.js');
    const out = await new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [childEntry], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
        });
        let text = '';
        child.stdout.on('data', (c) => {
            text += String(c);
        });
        child.stderr.on('data', (c) => {
            text += String(c);
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`deep-era child exited ${code}: ${text}`));
                return;
            }
            resolve(text.trim());
        });
    });
    const parsed = JSON.parse(out) as
        | { ok: false; reason: string }
        | {
              ok: true;
              cold: { p50Ms: number; p99Ms: number; samplesMs: number[]; rssMb: number };
              warm: { p50Ms: number; p99Ms: number; samplesMs: number[]; rssMb: number };
          };
    if (!parsed.ok) {
        const skip = {
            skipped: true as const,
            skipReason: parsed.reason,
            budgetMs: null as number | null,
        };
        return {
            cold: caseResult(
                'deep-era-truth-mean-node-cold',
                'Truth mean node y-10000 (DE441 secular, cold caches)',
                { p50Ms: 0, p99Ms: 0, rssMb: 0, samplesMs: [], medianMs: 0 },
                { ...skip, profile: 'truth', workload: 'deep-era-mean-node' },
            ),
            warm: caseResult(
                'deep-era-truth-mean-node-warm',
                'Truth mean node y-10000 (DE441 secular, warm caches)',
                { p50Ms: 0, p99Ms: 0, rssMb: 0, samplesMs: [], medianMs: 0 },
                { ...skip, profile: 'truth', workload: 'deep-era-mean-node' },
            ),
        };
    }
    const coldTiming = {
        ...parsed.cold,
        medianMs: parsed.cold.p50Ms,
    };
    const warmTiming = {
        ...parsed.warm,
        medianMs: parsed.warm.p50Ms,
    };
    return {
        cold: caseResult(
            'deep-era-truth-mean-node-cold',
            'Truth mean node y-10000 (DE441 secular, cold caches)',
            coldTiming,
            { profile: 'truth', workload: 'deep-era-mean-node', budgetMs: null },
        ),
        warm: caseResult(
            'deep-era-truth-mean-node-warm',
            'Truth mean node y-10000 (DE441 secular, warm caches)',
            warmTiming,
            { profile: 'truth', workload: 'deep-era-mean-node', budgetMs: null },
        ),
    };
}

async function main(): Promise<void> {
    await registerNodeBspLoaderFromCore();
    const engine = EphemerisEngine.getInstance();
    await engine.initialize();

    const cases: BenchCaseResult[] = [];
    const profileSplit: Partial<Record<BenchProfileId, BenchProfileSplit>> = {};

    for (const profile of BENCH_PROFILES) {
        if (profile === 'truth+eop') {
            await loadEopTable(engine);
        }

        const full = measureTimed(() => runFullChartWarm(engine, profile), measureOpts);
        const planets = measureTimed(() => runPlanets(engine, profile), measureOpts);
        const houses = measureTimed(() => runHouses(engine, profile), measureOpts);
        const ayanamsa = measureTimed(() => runAyanamsa(engine, profile), measureOpts);

        profileSplit[profile] = { fullChart: full, planets, houses, ayanamsa };

        const budget = profile === 'jhora' ? NODE_FULL_CHART_BUDGET_MS : null;

        cases.push(
            caseResult(caseId('full-chart', profile), `Full chart (${profile})`, full, {
                profile,
                workload: 'full-chart',
                budgetMs: budget,
            }),
            caseResult(caseId('planets', profile), `Engine getPlanets (${profile})`, planets, {
                profile,
                workload: 'planets',
                budgetMs: null,
            }),
            caseResult(caseId('houses', profile), `House cusps (${profile})`, houses, {
                profile,
                workload: 'houses',
                budgetMs: null,
            }),
            caseResult(caseId('ayanamsa', profile), `Ayanamsa (${profile})`, ayanamsa, {
                profile,
                workload: 'ayanamsa',
                budgetMs: null,
            }),
        );
    }

    const distinctFirst = measureTimed(() => runPlanetsDistinctJdSweep(engine), measureOpts);
    cases.push(
        caseResult(
            'planets-truth-distinct-jd-first',
            'Truth getPlanets ×40 distinct JDs (first pass)',
            distinctFirst,
            { profile: 'truth', workload: 'distinct-jd-planets', budgetMs: null },
        ),
    );

    const distinctSecond = measureDistinctJdSecondPass(
        () => runPlanetsDistinctJdSweep(engine),
        () => runPlanetsDistinctJdSweep(engine),
        measureOpts,
    );
    cases.push(
        caseResult(
            'planets-truth-distinct-jd-second',
            'Truth getPlanets ×40 distinct JDs (second pass)',
            distinctSecond,
            { profile: 'truth', workload: 'distinct-jd-planets', budgetMs: null },
        ),
    );

    const init = await measureEphemerisInitMedian();
    cases.push(
        caseResult(
            'ephemeris-init-cold',
            'EphemerisEngine.initialize() cold (fresh process)',
            { ...init, medianMs: init.p50Ms },
            { profile: 'none', workload: 'ephemeris-init', budgetMs: EPHEMERIS_INIT_BUDGET_MS },
        ),
    );

    const deepEra = await measureDeepEraMeanNode();
    if (deepEra.cold) cases.push(deepEra.cold);
    if (deepEra.warm) cases.push(deepEra.warm);

    cases.push({
        id: 'full-chart-warm-node',
        label: 'Legacy alias: full chart jhora (same as full-chart-jhora)',
        profile: 'jhora',
        workload: 'full-chart',
        ...profileSplit.jhora!.fullChart,
        budgetMs: NODE_FULL_CHART_BUDGET_MS,
        withinBudget: profileSplit.jhora!.fullChart.p50Ms <= NODE_FULL_CHART_BUDGET_MS,
    });

    const notes = [
        `NODE_FULL_CHART_BUDGET_MS=${NODE_FULL_CHART_BUDGET_MS} is a warning only; warm full-chart p50 is dominated by Vimshottari dasha (see profileSplit), not vargas/shadbala alone.`,
        'Regression gate compares p50 to baseline.json (15% tolerance).',
    ];

    const artifact: BenchResultsArtifact = {
        schemaVersion: 2,
        recordedAt: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        regressionTolerance: REGRESSION_TOLERANCE,
        sampleCount: SAMPLE_COUNT,
        notes,
        profileSplit,
        cases,
    };

    await mkdir(artifactsDir(), { recursive: true });
    await writeFile(resultsArtifactPath(), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

    for (const c of cases) {
        if (c.skipped) {
            console.log(`${c.id}: skipped (${c.skipReason})`);
            continue;
        }
        const budget =
            c.withinBudget === null
                ? ''
                : c.withinBudget
                  ? ' (within budget)'
                  : ` (OVER budget ${c.budgetMs} ms)`;
        console.log(
            `${c.id}: p50 ${c.p50Ms.toFixed(3)} ms p99 ${c.p99Ms.toFixed(3)} ms rss ${c.rssMb.toFixed(1)} MB${budget}`,
        );
    }
    console.log(`Wrote ${resultsArtifactPath()}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
