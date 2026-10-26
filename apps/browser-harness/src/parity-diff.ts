/** Browser + Node shared numeric tree diff (parity tests). */

export interface NumericDiff {
    path: string;
    node: number;
    worker: number;
    absDeltaNative: number;
    absDeltaReport: number;
    unit: 'arcsec' | 'seconds' | 'native';
}

const ARCSEC_KEYS =
    /(^|\.)(longitude|latitude|ascendant|mc|degree|declination|cusps|armc|vertex|speed|rupas|virupas|strength|sav|bav|components|breakdown|ishtaPhala|kashtaPhala|durationYears)(\.|$|\[)/i;

const TIME_DAY_KEYS = /(^|\.)(jd|julian)/i;

function reportUnit(path: string, key: string): NumericDiff['unit'] {
    if (TIME_DAY_KEYS.test(path) || key === 'jd') return 'seconds';
    if (ARCSEC_KEYS.test(path) || key === 'cusps') return 'arcsec';
    return 'native';
}

function toReportDelta(
    absNative: number,
    unit: NumericDiff['unit'],
    path: string,
    key: string,
): number {
    if (unit === 'arcsec') {
        return absNative * 3600;
    }
    if (unit === 'seconds') {
        return absNative * 86400;
    }
    return absNative;
}

export function collectNumericDiffs(node: unknown, worker: unknown, path = '$'): NumericDiff[] {
    const diffs: NumericDiff[] = [];

    if (node === null || worker === null) {
        if (node !== worker) {
            throw new Error(`Type mismatch at ${path}: ${node} vs ${worker}`);
        }
        return diffs;
    }

    const nodeType = typeof node;
    const workerType = typeof worker;

    if (nodeType === 'number' && workerType === 'number') {
        if (node !== worker) {
            const key =
                path
                    .split('.')
                    .pop()
                    ?.replace(/\[\d+\]$/, '') ?? '';
            const unit = reportUnit(path, key);
            const absNative = Math.abs(node - worker);
            diffs.push({
                path,
                node,
                worker,
                absDeltaNative: absNative,
                absDeltaReport: toReportDelta(absNative, unit, path, key),
                unit,
            });
        }
        return diffs;
    }

    if (nodeType !== 'object' || workerType !== 'object') {
        if (node !== worker) {
            throw new Error(`Value mismatch at ${path}: ${String(node)} vs ${String(worker)}`);
        }
        return diffs;
    }

    if (Array.isArray(node)) {
        if (!Array.isArray(worker) || worker.length !== node.length) {
            throw new Error(`Array length mismatch at ${path}`);
        }
        node.forEach((item, i) => {
            diffs.push(...collectNumericDiffs(item, worker[i], `${path}[${i}]`));
        });
        return diffs;
    }

    const wObj = worker as Record<string, unknown>;
    for (const key of Object.keys(node as Record<string, unknown>)) {
        diffs.push(
            ...collectNumericDiffs(
                (node as Record<string, unknown>)[key],
                wObj[key],
                `${path}.${key}`,
            ),
        );
    }
    return diffs;
}
