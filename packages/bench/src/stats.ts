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

/** True when `measured` is more than `tolerance` above `baseline`. */
export function isRegression(
    baseline: number,
    measured: number,
    tolerance: number,
): boolean {
    if (baseline <= 0) {
        return measured > baseline;
    }
    return measured > baseline * (1 + tolerance);
}
