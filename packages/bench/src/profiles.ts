import type { PrecisionProfile, SettingsInput } from '@node-jhora/core';

/** Bench profile axis (truth+EOP is truth with IERS EOP table attached). */
export type BenchProfileId = 'jhora' | 'modern' | 'truth' | 'truth+eop';

export const BENCH_PROFILES: readonly BenchProfileId[] = [
    'jhora',
    'modern',
    'truth',
    'truth+eop',
] as const;

export function precisionProfileForBench(id: BenchProfileId): PrecisionProfile {
    return id === 'truth+eop' ? 'truth' : id;
}

export function settingsForBenchProfile(id: BenchProfileId): SettingsInput {
    if (id === 'jhora') {
        return 'node-jhora-default';
    }
    return {
        preset: 'node-jhora-default',
        precisionProfile: precisionProfileForBench(id),
    };
}

export function caseId(prefix: string, profile: BenchProfileId): string {
    const slug = profile.replace('+', '-plus-');
    return `${prefix}-${slug}`;
}
