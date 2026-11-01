/**
 * Throughput bench: full ChartSession charts/s with node:worker_threads.
 * Not a CI gate on absolute numbers — use bench-workers-smoke.test.ts for smoke.
 */
import { availableParallelism } from 'node:os';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

import { median, p50, p99 } from './stats.js';

export interface WorkerBenchRow {
    workers: number;
    chartsPerWorker: number;
    wallMs: number;
    chartsPerSecond: number;
    latencyP50Ms: number;
    latencyP99Ms: number;
    rssAfterInitMb: { min: number; max: number; mean: number };
    rssAfterWorkMb: { min: number; max: number; mean: number };
}

export interface WorkerBenchReport {
    host: { node: string; platform: string; cpus: number };
    smoke: boolean;
    iterationsPerWorker: number;
    rows: WorkerBenchRow[];
}

function workerScriptPath(): string {
    return fileURLToPath(new URL('../workers/chart-throughput.worker.mjs', import.meta.url));
}

function runPool(workers: number, iterationsPerWorker: number): Promise<WorkerBenchRow> {
    const workerUrl = workerScriptPath();
    const wallStart = performance.now();
    const jobs: Promise<{
        latenciesMs: number[];
        rssAfterInitMb: number;
        rssAfterWorkMb: number;
    }>[] = [];

    for (let w = 0; w < workers; w++) {
        jobs.push(
            new Promise((resolve, reject) => {
                const worker = new Worker(workerUrl, {
                    workerData: { iterations: iterationsPerWorker, profile: 'jhora' },
                });
                worker.on('message', (msg) => {
                    worker.terminate().catch(() => {});
                    resolve(msg);
                });
                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`worker exited ${code}`));
                    }
                });
            }),
        );
    }

    return Promise.all(jobs).then((results) => {
        const wallMs = performance.now() - wallStart;
        const allLatencies = results.flatMap((r) => r.latenciesMs);
        const totalCharts = workers * iterationsPerWorker;
        const initRss = results.map((r) => r.rssAfterInitMb);
        const workRss = results.map((r) => r.rssAfterWorkMb);
        const stat = (vals: number[]) => ({
            min: Math.min(...vals),
            max: Math.max(...vals),
            mean: vals.reduce((a, b) => a + b, 0) / vals.length,
        });
        return {
            workers,
            chartsPerWorker: iterationsPerWorker,
            wallMs,
            chartsPerSecond: (totalCharts / wallMs) * 1000,
            latencyP50Ms: p50(allLatencies),
            latencyP99Ms: p99(allLatencies),
            rssAfterInitMb: stat(initRss),
            rssAfterWorkMb: stat(workRss),
        };
    });
}

export async function runWorkerThroughputBench(options?: {
    smoke?: boolean;
}): Promise<WorkerBenchReport> {
    const smoke = options?.smoke ?? process.env.NODE_JHORA_BENCH_WORKERS_SMOKE === '1';
    const cpus = availableParallelism();
    const workerCounts = smoke ? [1] : [1, 2, 4, cpus].filter((v, i, a) => a.indexOf(v) === i);
    const iterationsPerWorker = smoke ? 3 : 30;

    const rows: WorkerBenchRow[] = [];
    for (const n of workerCounts) {
        rows.push(await runPool(n, iterationsPerWorker));
    }

    return {
        host: {
            node: process.version,
            platform: process.platform,
            cpus,
        },
        smoke,
        iterationsPerWorker,
        rows,
    };
}

export function formatWorkerBenchReport(report: WorkerBenchReport): string {
    const lines: string[] = [
        `node-jhora worker throughput bench (smoke=${report.smoke})`,
        `host: Node ${report.host.node} ${report.host.platform}, cpus=${report.host.cpus}`,
        `iterations per worker: ${report.iterationsPerWorker}`,
        '',
        'workers | wall_ms | charts/s | p50_ms | p99_ms | RSS init MB (mean) | RSS after MB (mean)',
        '--------|---------|----------|--------|--------|--------------------|------------------',
    ];
    for (const r of report.rows) {
        lines.push(
            `${String(r.workers).padStart(7)} | ${r.wallMs.toFixed(0).padStart(7)} | ${r.chartsPerSecond.toFixed(1).padStart(8)} | ${r.latencyP50Ms.toFixed(2).padStart(6)} | ${r.latencyP99Ms.toFixed(2).padStart(6)} | ${r.rssAfterInitMb.mean.toFixed(0).padStart(18)} | ${r.rssAfterWorkMb.mean.toFixed(0).padStart(16)}`,
        );
    }
    lines.push('');
    lines.push(
        `latency median (all samples): ${median(report.rows.flatMap((r) => [r.latencyP50Ms])).toFixed(2)} ms (per-row p50 shown above)`,
    );
    return lines.join('\n');
}

async function main(): Promise<void> {
    const report = await runWorkerThroughputBench();
    const text = formatWorkerBenchReport(report);
    console.log(text);
}

const isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
