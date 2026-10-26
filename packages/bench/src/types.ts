export interface BenchCaseResult {
    id: string;
    label: string;
    medianMs: number;
    samplesMs: number[];
    budgetMs: number | null;
    withinBudget: boolean | null;
}

export interface BenchResultsArtifact {
    schemaVersion: 1;
    recordedAt: string;
    nodeVersion: string;
    platform: string;
    regressionTolerance: number;
    sampleCount: number;
    cases: BenchCaseResult[];
    notes?: string[];
}

export interface BenchBaselineFile {
    schemaVersion: 1;
    regressionTolerance: number;
    cases: Record<
        string,
        {
            medianMs: number;
            budgetMs: number | null;
        }
    >;
}
