export {
    BROWSER_WORKER_FULL_CHART_BUDGET_MS,
    EPHEMERIS_INIT_BUDGET_MS,
    NODE_FULL_CHART_BUDGET_MS,
    registerBrowserWorkerBenchHook,
    REGRESSION_TOLERANCE,
    runBrowserWorkerFullChartBench,
} from './budgets.js';
export { isRegression, median } from './stats.js';
export type { BenchBaselineFile, BenchResultsArtifact } from './types.js';
