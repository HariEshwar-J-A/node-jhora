import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.url));

/** Package root (…/packages/bench). */
export function benchPackageRoot(): string {
    return join(packageRoot, '..');
}

export function baselinePath(): string {
    return join(benchPackageRoot(), 'baseline.json');
}

export function artifactsDir(): string {
    return join(benchPackageRoot(), 'artifacts');
}

export function resultsArtifactPath(): string {
    return join(artifactsDir(), 'bench-results.json');
}
