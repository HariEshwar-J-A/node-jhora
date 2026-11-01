/** Node warm full-chart budget (ms). */
export const NODE_FULL_CHART_BUDGET_MS = 20;

/**
 * Browser worker full-chart budget (ms).
 * Measured in a dedicated worker host (separate PR); not run in this package yet.
 */
export const BROWSER_WORKER_FULL_CHART_BUDGET_MS = 40;

/** Cold ephemeris kernel load + SPK parse in a fresh Node process (ms). */
export const EPHEMERIS_INIT_BUDGET_MS = 150;

/** CI fails when median exceeds baseline by more than this fraction. */
export const REGRESSION_TOLERANCE = 0.15;

/** Independent samples per benchmark; median dampens timer noise. */
export const SAMPLE_COUNT = 9;

/** Warm-up iterations before sampling (stabilises JIT for short engine calls). */
export const WARMUP_ITERATIONS = 25;

/**
 * Hook for a future browser-worker bench (E2 worker host).
 * Import and call from the worker integration package when it exists.
 */
export type BrowserWorkerBenchHook = () => Promise<{ medianMs: number }>;

let browserWorkerBenchHook: BrowserWorkerBenchHook | undefined;

export function registerBrowserWorkerBenchHook(hook: BrowserWorkerBenchHook): void {
    browserWorkerBenchHook = hook;
}

export async function runBrowserWorkerFullChartBench(): Promise<{ medianMs: number } | null> {
    if (!browserWorkerBenchHook) {
        return null;
    }
    return browserWorkerBenchHook();
}
