import type { BenchProfileId } from './profiles.js';

export interface BenchTimingResult {
    p50Ms: number;
    p99Ms: number;
    rssMb: number;
    samplesMs: number[];
    /** Same as p50Ms; kept for regression scripts that still read medianMs. */
    medianMs: number;
}

export interface BenchCaseResult extends BenchTimingResult {
    id: string;
    label: string;
    profile?: BenchProfileId | 'none';
    workload?:
        | 'full-chart'
        | 'planets'
        | 'houses'
        | 'ayanamsa'
        | 'ephemeris-init'
        | 'distinct-jd-planets'
        | 'deep-era-mean-node';
    budgetMs: number | null;
    withinBudget: boolean | null;
    skipped?: boolean;
    skipReason?: string;
}

export interface BenchProfileSplit {
    fullChart: BenchTimingResult;
    planets: BenchTimingResult;
    houses: BenchTimingResult;
    ayanamsa: BenchTimingResult;
}

export interface BenchResultsArtifact {
    schemaVersion: 2;
    recordedAt: string;
    nodeVersion: string;
    platform: string;
    regressionTolerance: number;
    sampleCount: number;
    cases: BenchCaseResult[];
    /** Per-profile engine/chart timings (excludes truth+EOP duplicate of truth in labels). */
    profileSplit: Partial<Record<BenchProfileId, BenchProfileSplit>>;
    notes?: string[];
}

export interface BenchBaselineEntry {
    p50Ms: number;
    /** @deprecated use p50Ms */
    medianMs?: number;
    budgetMs: number | null;
}

export interface BenchBaselineFile {
    schemaVersion: 2;
    regressionTolerance: number;
    cases: Record<string, BenchBaselineEntry>;
}
