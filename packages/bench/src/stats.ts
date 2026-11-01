export function median(values: readonly number[]): number {
    if (values.length === 0) {
        throw new Error('median: empty input');
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[mid]!;
    }
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Nearest-rank percentile (p ∈ [0, 100]). */
export function percentile(values: readonly number[], p: number): number {
    if (values.length === 0) {
        throw new Error('percentile: empty input');
    }
    const sorted = [...values].sort((a, b) => a - b);
    const rank = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    if (lo === hi) {
        return sorted[lo]!;
    }
    const w = rank - lo;
    return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function p50(values: readonly number[]): number {
    return percentile(values, 50);
}

export function p99(values: readonly number[]): number {
    return percentile(values, 99);
}

/** True when `measured` is more than `tolerance` above `baseline`. */
export function isRegression(baseline: number, measured: number, tolerance: number): boolean {
    if (baseline <= 0) {
        return measured > baseline;
    }
    return measured > baseline * (1 + tolerance);
}
