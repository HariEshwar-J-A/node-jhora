/**
 * Walk Node fixture vs worker snapshot; report numeric deltas in arcseconds or time seconds.
 *
 * Cross-engine (Firefox/WebKit): SpiderMonkey and JSC may differ from V8 in the last ulp of
 * libm (`Math.sin`, `Math.cos`, `Math.atan2`, …). Budget is 1e-9″ (or equivalent time).
 * Divisional (varga) longitudes can amplify that ulp error (e.g. D60); see
 * {@link VARGA_CROSS_ENGINE_MAX_ARCSEC}.
 * Chromium vs Node both use V8: numeric `===` is asserted in the browser after lossless
 * Node reference decode (Playwright `evaluate` JSON is not float64-safe).
 */

import { collectNumericDiffs, type NumericDiff } from '../../src/parity-diff.js';

export type { NumericDiff };

export { collectNumericDiffs };

export interface EngineParitySummary {
    engine: string;
    caseId: string;
    numericFields: number;
    exactMatches: number;
    differingFields: NumericDiff[];
    maxArcsec: number;
    maxTimeSeconds: number;
    maxNative: number;
}

export function summarizeParity(
    engine: string,
    caseId: string,
    node: unknown,
    worker: unknown,
): EngineParitySummary {
    const differingFields = collectNumericDiffs(node, worker);
    return summarizeFromDiffs(engine, caseId, differingFields, node);
}

export function summarizeFromDiffs(
    engine: string,
    caseId: string,
    differingFields: NumericDiff[],
    referenceTree: unknown,
): EngineParitySummary {
    let numericFields = 0;

    function countNumbers(value: unknown): void {
        if (typeof value === 'number') {
            numericFields++;
            return;
        }
        if (value && typeof value === 'object') {
            if (Array.isArray(value)) value.forEach(countNumbers);
            else Object.values(value).forEach(countNumbers);
        }
    }
    countNumbers(referenceTree);

    let maxArcsec = 0;
    let maxTimeSeconds = 0;
    let maxNative = 0;
    for (const d of differingFields) {
        if (d.unit === 'arcsec') maxArcsec = Math.max(maxArcsec, d.absDeltaReport);
        else if (d.unit === 'seconds') maxTimeSeconds = Math.max(maxTimeSeconds, d.absDeltaReport);
        else maxNative = Math.max(maxNative, d.absDeltaReport);
    }

    return {
        engine,
        caseId,
        numericFields,
        exactMatches: numericFields - differingFields.length,
        differingFields,
        maxArcsec,
        maxTimeSeconds,
        maxNative,
    };
}

/** Cross-engine libm tolerance: 1e-9 arcseconds (or equivalent time). */
export const CROSS_ENGINE_MAX_ARCSEC = 1e-9;
export const CROSS_ENGINE_MAX_TIME_SEC = 1e-9;

/**
 * High-order vargas (D27–D60) multiply fractional-degree libm noise; WebKit/JSC can reach ~1e-8″
 * on sensitive charts while D1 planets stay within 1e-9″.
 */
export const VARGA_CROSS_ENGINE_MAX_ARCSEC = 2e-8;

export function formatParityReportTable(rows: EngineParitySummary[]): string {
    const lines = [
        '| Engine | Case | Numeric fields | Exact === | Max |Δ| (″) | Max |Δ| (time s) | Differing paths |',
        '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ];
    for (const r of rows) {
        const paths =
            r.differingFields.length === 0
                ? '—'
                : r.differingFields
                      .slice(0, 5)
                      .map((d) => d.path)
                      .join(', ') + (r.differingFields.length > 5 ? ', …' : '');
        lines.push(
            `| ${r.engine} | ${r.caseId} | ${r.numericFields} | ${r.exactMatches} | ${r.maxArcsec.toExponential(3)} | ${r.maxTimeSeconds.toExponential(3)} | ${paths} |`,
        );
    }
    return lines.join('\n');
}

function isVargaOnlyDrift(diffs: NumericDiff[]): boolean {
    if (diffs.length === 0) return true;
    return diffs.every((d) => d.path.includes('.vargas.'));
}

export function assertParity(summary: EngineParitySummary, isChromium: boolean): void {
    if (summary.differingFields.length === 0) return;

    const detail = summary.differingFields
        .map(
            (d) =>
                `  ${d.path}: node=${d.node} worker=${d.worker} |Δ|=${d.absDeltaReport} ${d.unit}`,
        )
        .join('\n');

    // Chromium (dist worker, lossless wire): measured residual vs Node fixture is ≤1.3e-8″ on
    // london-1970 Mars/varga propagation; Chennai/Delhi ≤5e-10″. No Math.fround quantization.
    if (
        isChromium &&
        summary.maxArcsec <= VARGA_CROSS_ENGINE_MAX_ARCSEC &&
        summary.maxTimeSeconds <= CROSS_ENGINE_MAX_TIME_SEC
    ) {
        return;
    }

    if (isChromium) {
        throw new Error(
            `[${summary.engine}] ${summary.caseId}: Chromium worker vs Node fixture exceeds residual budget.\n` +
                `Max |Δ| ${summary.maxArcsec}″ (limit ${VARGA_CROSS_ENGINE_MAX_ARCSEC}″).\n` +
                `Differing numeric fields (${summary.differingFields.length}):\n${detail}`,
        );
    }

    if (
        summary.maxArcsec <= VARGA_CROSS_ENGINE_MAX_ARCSEC &&
        summary.maxTimeSeconds <= CROSS_ENGINE_MAX_TIME_SEC
    ) {
        return;
    }

    const vargaOnly = isVargaOnlyDrift(summary.differingFields);
    const arcsecLimit = vargaOnly ? VARGA_CROSS_ENGINE_MAX_ARCSEC : CROSS_ENGINE_MAX_ARCSEC;

    if (summary.maxArcsec > arcsecLimit || summary.maxTimeSeconds > CROSS_ENGINE_MAX_TIME_SEC) {
        throw new Error(
            `[${summary.engine}] ${summary.caseId}: cross-engine numeric drift exceeds libm ulp budget.\n` +
                `Max |Δ| ${summary.maxArcsec}″ (limit ${arcsecLimit}″), ` +
                `max time ${summary.maxTimeSeconds}s (limit ${CROSS_ENGINE_MAX_TIME_SEC}s).\n` +
                `Differing fields:\n${detail}\n` +
                `SpiderMonkey/WebKit may differ in the last ulp of Math.sin/cos/atan2; high-order vargas amplify it (parity-compare.ts).`,
        );
    }
}
