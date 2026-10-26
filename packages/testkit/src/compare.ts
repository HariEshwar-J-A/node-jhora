/**
 * Tolerance-aware golden comparator (browser-safe: no Node built-ins).
 */

import { matchFeaturePath, type ToleranceType } from './paths.js';
import type { ExpectedEntry, GoldenCase } from './schema.js';

export type GoldenActual = Readonly<Record<string, string | number | boolean | undefined>>;

export interface PathCompareResult {
    path: string;
    featureId: string | undefined;
    pass: boolean;
    toleranceType: ToleranceType;
    expected: string | number | boolean;
    actual: string | number | boolean | undefined;
    /** Signed delta in arcseconds or seconds; `null` for exact comparisons. */
    delta: number | null;
    /** Slack limit in the same units as `delta`; `null` for exact. */
    toleranceLimit: number | null;
    message: string;
}

export interface FeatureWorstOffender {
    featureId: string;
    path: string;
    toleranceType: ToleranceType;
    delta: number;
    toleranceLimit: number;
    ratio: number;
}

export interface GoldenCompareResult {
    id: string;
    pass: boolean;
    paths: PathCompareResult[];
    failures: PathCompareResult[];
    worstByFeature: FeatureWorstOffender[];
}

export interface CompareGoldenOptions {
    /** When set, only these expected paths are compared (must exist on the case). */
    only?: readonly string[];
}

/** Signed shortest-arc difference actual − expected, in degrees (−180, 180]. */
export function signedAngleDeltaDegrees(expected: number, actual: number): number {
    // Reduce any difference (inputs need not lie in [0, 360)) into [0, 360),
    // then map (180, 360) onto (−180, 0).
    const d = (((actual - expected) % 360) + 360) % 360;
    return d > 180 ? d - 360 : d;
}

/** Shortest-arc separation in arcseconds (non-negative). */
export function angleDeltaArcsec(expected: number, actual: number): number {
    return Math.abs(signedAngleDeltaDegrees(expected, actual)) * 3600;
}

function parseUtcDateSeconds(value: string): number {
    const ms = Date.parse(`${value}T00:00:00.000Z`);
    if (Number.isNaN(ms)) throw new Error(`Invalid date string ${JSON.stringify(value)}`);
    return ms / 1000;
}

function secondsDelta(expected: string | number, actual: string | number): number {
    const toSeconds = (v: string | number): number => {
        if (typeof v === 'number') return v;
        return parseUtcDateSeconds(v);
    };
    return toSeconds(actual) - toSeconds(expected);
}

function comparePath(path: string, entry: ExpectedEntry, actual: GoldenActual): PathCompareResult {
    const featureId = matchFeaturePath(path)?.id;
    const raw = actual[path];
    const base = {
        path,
        featureId,
        expected: entry.value,
        actual: raw,
        toleranceType: entry.tolerance.type,
        delta: null as number | null,
        toleranceLimit: null as number | null,
    };

    if (raw === undefined) {
        return {
            ...base,
            pass: false,
            message: 'missing actual value',
        };
    }

    switch (entry.tolerance.type) {
        case 'arcsec': {
            if (typeof entry.value !== 'number' || typeof raw !== 'number') {
                return {
                    ...base,
                    pass: false,
                    message: 'arcsec path requires numeric expected and actual',
                };
            }
            const delta = signedAngleDeltaDegrees(entry.value, raw) * 3600;
            const limit = entry.tolerance.arcsec;
            const pass = Math.abs(delta) <= limit;
            return {
                ...base,
                pass,
                delta,
                toleranceLimit: limit,
                message: pass ? 'ok' : `|Δ|=${Math.abs(delta).toFixed(4)}″ > ${limit}″`,
            };
        }
        case 'seconds': {
            if (
                typeof raw !== typeof entry.value &&
                !(typeof entry.value === 'string' || typeof entry.value === 'number')
            ) {
                return { ...base, pass: false, message: 'seconds path value kind mismatch' };
            }
            if (typeof entry.value === 'number' && typeof raw === 'number') {
                const scale = featureId === 'sidereal-hours' ? 3600 : 1;
                const delta = (raw - entry.value) * scale;
                const limit = entry.tolerance.seconds;
                const pass = Math.abs(delta) <= limit;
                return {
                    ...base,
                    pass,
                    delta,
                    toleranceLimit: limit,
                    message: pass ? 'ok' : `|Δ|=${Math.abs(delta).toFixed(4)} s > ${limit} s`,
                };
            }
            if (typeof entry.value === 'string' && typeof raw === 'string') {
                const delta = secondsDelta(entry.value, raw);
                const limit = entry.tolerance.seconds;
                const pass = Math.abs(delta) <= limit;
                return {
                    ...base,
                    pass,
                    delta,
                    toleranceLimit: limit,
                    message: pass ? 'ok' : `|Δ|=${Math.abs(delta).toFixed(1)} s > ${limit} s`,
                };
            }
            return {
                ...base,
                pass: false,
                message:
                    'seconds path expected and actual must both be numbers or both be date strings',
            };
        }
        case 'exact': {
            const pass = Object.is(entry.value, raw);
            return {
                ...base,
                pass,
                message: pass
                    ? 'ok'
                    : `expected ${JSON.stringify(entry.value)} got ${JSON.stringify(raw)}`,
            };
        }
        default: {
            const unknown = entry.tolerance as { type?: string };
            return {
                ...base,
                pass: false,
                message: `unknown tolerance ${unknown.type ?? '?'}`,
            };
        }
    }
}

export function compareGoldenPaths(
    expected: GoldenCase['expected'],
    actual: GoldenActual,
    options?: CompareGoldenOptions,
): PathCompareResult[] {
    const paths = options?.only ?? Object.keys(expected).sort();
    return paths.map((path) => {
        const entry = expected[path];
        if (!entry)
            throw new Error(`Golden case has no expected entry for ${JSON.stringify(path)}`);
        return comparePath(path, entry, actual);
    });
}

function worstOffenders(failures: PathCompareResult[]): FeatureWorstOffender[] {
    const byFeature = new Map<string, FeatureWorstOffender>();
    for (const row of failures) {
        if (row.toleranceLimit === null || row.delta === null || !row.featureId) continue;
        const ratio = Math.abs(row.delta) / row.toleranceLimit;
        const hit: FeatureWorstOffender = {
            featureId: row.featureId,
            path: row.path,
            toleranceType: row.toleranceType,
            delta: row.delta,
            toleranceLimit: row.toleranceLimit,
            ratio,
        };
        const prev = byFeature.get(row.featureId);
        if (!prev || hit.ratio > prev.ratio) byFeature.set(row.featureId, hit);
    }
    return [...byFeature.values()].sort((a, b) => b.ratio - a.ratio);
}

export function compareGoldenCase(
    goldenCase: GoldenCase,
    actual: GoldenActual,
    options?: CompareGoldenOptions,
): GoldenCompareResult {
    const paths = compareGoldenPaths(goldenCase.expected, actual, options);
    const failures = paths.filter((row) => !row.pass);
    return {
        id: goldenCase.id,
        pass: failures.length === 0,
        paths,
        failures,
        worstByFeature: worstOffenders(failures),
    };
}
