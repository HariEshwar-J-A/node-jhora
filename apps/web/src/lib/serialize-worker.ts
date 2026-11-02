import { DateTime } from 'luxon';

/** Deep-clone engine output into postMessage-safe plain data (no Luxon/Decimal/class instances). */
export function toWorkerPlain<T>(value: T): T {
    return walk(value) as T;
}

function walk(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'bigint') return value.toString();
    if (DateTime.isDateTime(value)) {
        return value.isValid ? value.toISO() : null;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (
        typeof value === 'object' &&
        value !== null &&
        'toJSON' in value &&
        typeof value.toJSON === 'function'
    ) {
        return walk(value.toJSON(), seen);
    }
    if (Array.isArray(value)) {
        return value.map((item) => walk(item, seen));
    }
    if (typeof value === 'object') {
        if (seen.has(value)) return seen.get(value);
        const out: Record<string, unknown> = {};
        seen.set(value, out);
        for (const [key, child] of Object.entries(value)) {
            out[key] = walk(child, seen);
        }
        return out;
    }
    return String(value);
}
