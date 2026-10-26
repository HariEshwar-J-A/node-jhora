import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

import {
    assertParity,
    formatParityReportTable,
    summarizeParity,
    type EngineParitySummary,
} from './lib/parity-compare.js';
import { decodeLosslessNumbers } from '../src/parity-wire.js';

async function runWorkerSnapshot(
    page: import('@playwright/test').Page,
    request: Record<string, unknown>,
): Promise<unknown> {
    const encoded = await page.evaluate(async (req) => {
        const snapshot = await window.__njhRunHarness(req);
        return window.__njhEncodeLossless(snapshot);
    }, request);
    return decodeLosslessNumbers(encoded);
}

const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../fixtures/node-chart-snapshots.json',
);
const jsonFixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    cases: Record<string, { request: Record<string, unknown>; snapshot: unknown }>;
};

const parityRows: EngineParitySummary[] = [];

test.describe.configure({ timeout: 120_000 });

test.afterAll(() => {
    if (parityRows.length === 0) return;
    console.log('\nBrowser worker vs reference — per-engine max-difference summary:\n');
    console.log(formatParityReportTable(parityRows));
    for (const row of parityRows) {
        if (row.differingFields.length > 0) {
            console.log(
                `\n[${row.engine}] ${row.caseId} differing numerics (${row.differingFields.length}):`,
            );
            for (const d of row.differingFields) {
                console.log(
                    `  ${d.path}: ref=${d.node} worker=${d.worker} |Δ|_report=${d.absDeltaReport} (${d.unit})`,
                );
            }
        }
    }
});

function nonNumericParity(reference: unknown, worker: unknown, path = '$'): void {
    if (reference === null || worker === null) {
        expect(worker).toBe(reference);
        return;
    }
    if (typeof reference === 'number' && typeof worker === 'number') {
        return;
    }
    if (typeof reference !== 'object' || typeof worker !== 'object') {
        expect(worker).toEqual(reference);
        return;
    }
    if (Array.isArray(reference)) {
        expect(Array.isArray(worker)).toBe(true);
        const wArr = worker as unknown[];
        expect(wArr.length).toBe(reference.length);
        reference.forEach((item, i) => nonNumericParity(item, wArr[i], `${path}[${i}]`));
        return;
    }
    const wObj = worker as Record<string, unknown>;
    for (const key of Object.keys(reference as Record<string, unknown>)) {
        nonNumericParity((reference as Record<string, unknown>)[key], wObj[key], `${path}.${key}`);
    }
}

test.describe('browser worker parity', () => {
    for (const [caseId, { request }] of Object.entries(jsonFixture.cases)) {
        test(`matches Node for ${caseId}`, async ({ page }, testInfo) => {
            await page.goto('/');
            const workerSnapshot = await runWorkerSnapshot(page, request);
            const reference = jsonFixture.cases[caseId].snapshot;
            const engine = testInfo.project.name;

            nonNumericParity(reference, workerSnapshot);

            const summary = summarizeParity(engine, caseId, reference, workerSnapshot);
            parityRows.push(summary);
            assertParity(summary, engine === 'chromium');
        });
    }

    test('offline reload uses cached ephemeris', async ({ page, context }, testInfo) => {
        const chennai = jsonFixture.cases['sample-2000'];
        await page.goto('/');
        await page.evaluate(async (req) => {
            await window.__njhRunHarness(req);
        }, chennai.request);

        await context.setOffline(true);
        const offlineReq = { ...chennai.request, offline: true };
        const workerSnapshot = await runWorkerSnapshot(page, offlineReq);
        const reference = chennai.snapshot;
        const engine = testInfo.project.name;

        nonNumericParity(reference, workerSnapshot);

        const summary = summarizeParity(engine, 'sample-2000-offline', reference, workerSnapshot);
        parityRows.push(summary);
        assertParity(summary, engine === 'chromium');
    });
});
