import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REGRESSION_TOLERANCE } from './budgets.js';
import { baselinePath, resultsArtifactPath } from './paths.js';
import { isRegression } from './stats.js';
import type { BenchBaselineFile, BenchResultsArtifact } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
        const base = baseline.cases[measured.id];
        if (!base) {
            failures.push(`missing baseline entry for ${measured.id}`);
            continue;
        }
        if (isRegression(base.medianMs, measured.medianMs, tolerance)) {
            const pct =
                ((measured.medianMs - base.medianMs) / base.medianMs) * 100;
            failures.push(
                `${measured.id}: median ${measured.medianMs.toFixed(3)} ms regressed ${pct.toFixed(1)}% vs baseline ${base.medianMs.toFixed(3)} ms (limit ${tolerance * 100}%)`,
            );
        }
        if (measured.withinBudget === false && measured.budgetMs != null) {
            budgetMisses.push(
                `${measured.id}: median ${measured.medianMs.toFixed(3)} ms exceeds budget ${measured.budgetMs} ms`,
            );
        }
    }

    if (budgetMisses.length > 0) {
        console.warn('\nPerformance budget misses (baseline not weakened):');
        for (const line of budgetMisses) {
            console.warn(`  - ${line}`);
        }
        console.warn(
            '\nHotspots to profile: vargas loop (16 divisions × planets), shadbala, yogas, ashtakavarga, dasha tree generation.',
        );
    }

    if (failures.length > 0) {
        console.error('\nBench regression check failed:');
        for (const line of failures) {
            console.error(`  - ${line}`);
        }
        process.exit(1);
    }

    console.log('\nBench regression check passed.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
