import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { EphemerisEngine } from '@node-jhora/core';
import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register';
import { Bench } from 'tinybench';

import {
    BROWSER_WORKER_FULL_CHART_BUDGET_MS,
    EPHEMERIS_INIT_BUDGET_MS,
    NODE_FULL_CHART_BUDGET_MS,
    REGRESSION_TOLERANCE,
    SAMPLE_COUNT,
    WARMUP_ITERATIONS,
} from './budgets.js';
import { runFullChartWarm } from './chart-fixture.js';
import { artifactsDir, resultsArtifactPath } from './paths.js';
import { median } from './stats.js';
import type { BenchCaseResult, BenchResultsArtifact } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function measureEphemerisInitMedian(): Promise<{ medianMs: number; samplesMs: number[] }> {
    const childEntry = join(__dirname, 'measure-ephemeris-init.js');
    const samples: number[] = [];

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
        samples.push(ms);
    }

    return { medianMs: median(samples), samplesMs: samples };
}

async function measureFullChartWarmMedian(
    engine: EphemerisEngine,
): Promise<{ medianMs: number; samplesMs: number[] }> {
    const bench = new Bench({
        iterations: SAMPLE_COUNT,
        warmup: true,
        warmupIterations: WARMUP_ITERATIONS,
    });
    bench.add('full-chart-warm-node', () => {
        runFullChartWarm(engine);
    });
    await bench.run();

    const task = bench.getTask('full-chart-warm-node');
    const samplesMs =
        task?.result?.latency.samples ?? task?.result?.samples ?? [];
    const medianMs =
        task?.result?.latency.p50 ??
        (samplesMs.length > 0 ? median(samplesMs) : Number.NaN);

    if (!Number.isFinite(medianMs) || samplesMs.length === 0) {
        const fallbackSamples: number[] = [];
        for (let i = 0; i < SAMPLE_COUNT; i++) {
            const t0 = performance.now();
            runFullChartWarm(engine);
            fallbackSamples.push(performance.now() - t0);
        }
        return { medianMs: median(fallbackSamples), samplesMs: fallbackSamples };
    }

    return { medianMs, samplesMs: [...samplesMs] };
}

function caseResult(
    id: string,
    label: string,
    medianMs: number,
    samplesMs: number[],
    budgetMs: number | null,
): BenchCaseResult {
    return {
        id,
        label,
        medianMs,
        samplesMs,
        budgetMs,
        withinBudget: budgetMs == null ? null : medianMs <= budgetMs,
    };
}

async function main(): Promise<void> {
    await registerNodeBspLoaderFromCore();
    const engine = EphemerisEngine.getInstance();
    await engine.initialize();

    const { medianMs: fullChartMedian, samplesMs: fullChartSamples } =
        await measureFullChartWarmMedian(engine);
    const { medianMs: ephemerisInitMedian, samplesMs: ephemerisSamples } =
        await measureEphemerisInitMedian();

    const notes = [
        `Browser worker full-chart budget is ${BROWSER_WORKER_FULL_CHART_BUDGET_MS} ms; hook via registerBrowserWorkerBenchHook() when the worker host lands.`,
    ];

    const artifact: BenchResultsArtifact = {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        regressionTolerance: REGRESSION_TOLERANCE,
        sampleCount: SAMPLE_COUNT,
        notes,
        cases: [
            caseResult(
                'full-chart-warm-node',
                'ChartSession full chart (D1–D60, dasha L3, strengths)',
                fullChartMedian,
                fullChartSamples,
                NODE_FULL_CHART_BUDGET_MS,
            ),
            caseResult(
                'ephemeris-init-cold',
                'EphemerisEngine.initialize() cold (fresh process)',
                ephemerisInitMedian,
                ephemerisSamples,
                EPHEMERIS_INIT_BUDGET_MS,
            ),
        ],
    };

    await mkdir(artifactsDir(), { recursive: true });
    await writeFile(resultsArtifactPath(), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

    for (const c of artifact.cases) {
        const budget =
            c.withinBudget === null
                ? ''
                : c.withinBudget
                  ? ' (within budget)'
                  : ` (OVER budget ${c.budgetMs} ms)`;
        console.log(`${c.id}: median ${c.medianMs.toFixed(3)} ms${budget}`);
    }
    console.log(`Wrote ${resultsArtifactPath()}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
