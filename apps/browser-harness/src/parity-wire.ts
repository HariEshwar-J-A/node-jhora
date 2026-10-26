/** Lossless float64 tree encoding for Playwright evaluate (JSON drops IEEE bits). */
const F64 = '__f64__';

export function encodeLosslessNumbers(value: unknown): unknown {
    if (typeof value === 'number') {
        const buf = new ArrayBuffer(8);
        const dv = new DataView(buf);
        dv.setFloat64(0, value);
        return { [F64]: dv.getBigUint64(0).toString(16) };
    }
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(encodeLosslessNumbers);
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        out[key] = encodeLosslessNumbers(child);
    }
    return out;
}

export function decodeLosslessNumbers(value: unknown): unknown {
    if (value && typeof value === 'object' && F64 in (value as Record<string, unknown>)) {
        const hex = (value as Record<string, string>)[F64];
        const buf = new ArrayBuffer(8);
        const dv = new DataView(buf);
        dv.setBigUint64(0, BigInt(`0x${hex}`));
        return dv.getFloat64(0);
    }
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(decodeLosslessNumbers);
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        out[key] = decodeLosslessNumbers(child);
    }
    return out;
}
