import { performance } from 'node:perf_hooks';
import { memoryUsage } from 'node:process';

import { p50, p99 } from './stats.js';
import type { BenchTimingResult } from './types.js';

export interface MeasureOptions {
    sampleCount: number;
    warmupIterations: number;
}

export function measureTimed(fn: () => void, options: MeasureOptions): BenchTimingResult {
    for (let w = 0; w < options.warmupIterations; w++) {
        fn();
    }
    const samplesMs: number[] = [];
    const rssBytes: number[] = [];
    for (let i = 0; i < options.sampleCount; i++) {
        const t0 = performance.now();
        fn();
        samplesMs.push(performance.now() - t0);
        rssBytes.push(memoryUsage().rss);
    }
    const p50Ms = p50(samplesMs);
    return {
        p50Ms,
        p99Ms: p99(samplesMs),
        rssMb: p50(rssBytes) / (1024 * 1024),
        samplesMs,
        medianMs: p50Ms,
    };
}

/** Distinct-JD second pass: one warmup sweep, then time the repeat sweep. */
export function measureDistinctJdSecondPass(
    warmupSweep: () => void,
    timedSweep: () => void,
    options: MeasureOptions,
): BenchTimingResult {
    for (let w = 0; w < options.warmupIterations; w++) {
        warmupSweep();
        timedSweep();
    }
    const samplesMs: number[] = [];
    const rssBytes: number[] = [];
    for (let i = 0; i < options.sampleCount; i++) {
        warmupSweep();
        const t0 = performance.now();
        timedSweep();
        samplesMs.push(performance.now() - t0);
        rssBytes.push(memoryUsage().rss);
    }
    const p50Ms = p50(samplesMs);
    return {
        p50Ms,
        p99Ms: p99(samplesMs),
        rssMb: p50(rssBytes) / (1024 * 1024),
        samplesMs,
        medianMs: p50Ms,
    };
}

export function timingFromSamples(samplesMs: number[], rssMb: number): BenchTimingResult {
    const p50Ms = p50(samplesMs);
    return {
        p50Ms,
        p99Ms: p99(samplesMs),
        rssMb,
        samplesMs,
        medianMs: p50Ms,
    };
}
