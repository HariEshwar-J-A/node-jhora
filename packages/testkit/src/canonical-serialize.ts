/**
 * Byte-stable JSON for hashing chart output.
 *
 * Objects are key-sorted at every level; `undefined` is omitted. Numbers use a
 * fixed decimal/scientific form (not locale-dependent `JSON.stringify` floats).
 */

import { sha256Utf8 } from './sha256.js';

/** Serialize a finite IEEE-754 double for canonical JSON (RFC 8785–style). */
export function formatCanonicalNumber(value: number): string {
    if (!Number.isFinite(value)) {
        throw new TypeError('canonicalSerialize: non-finite number');
    }
    if (Object.is(value, -0)) {
        return '-0';
    }
    if (Number.isInteger(value) && Math.abs(value) <= 9_007_199_254_740_991) {
        return String(value);
    }

    let text = value.toString();
    if (!text.includes('e') && !text.includes('E')) {
        if (text.includes('.')) {
            text = text.replace(/0+$/, '').replace(/\.$/, '');
        }
        return text;
    }

    const intSci = /^(-?)(\d+)e([+-])(\d+)$/i.exec(text);
    if (intSci) {
        const sign = intSci[1];
        const digits = intSci[2];
        const expSign = intSci[3];
        const expMag = Number(intSci[4]);
        if (expSign === '+') {
            return `${sign}${digits}${'0'.repeat(expMag)}`;
        }
        const zeros = expMag - 1;
        if (zeros >= 0) {
            return `${sign}0.${'0'.repeat(zeros)}${digits}`;
        }
        return `${sign}0.${'0'.repeat(-zeros)}${digits}`;
    }

    const match = /^(-?)(\d)\.(\d+)e([+-])(\d+)$/i.exec(text);
    if (!match) {
        return text;
    }

    const sign = match[1];
    const digit = match[3];
    const expSign = match[4];
    const expMag = Number(match[5]);
    const digits = match[2] + digit;

    if (expSign === '+') {
        const zeros = expMag - digit.length;
        if (zeros >= 0) {
            return `${sign}${digits}${'0'.repeat(zeros)}`;
        }
        const point = 1 + expMag;
        return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
    }

    const zeros = expMag - 1;
    if (zeros >= 0) {
        return `${sign}0.${'0'.repeat(zeros)}${digits}`;
    }
    return `${sign}0.${'0'.repeat(-zeros)}${digits}`;
}

function serializeValue(value: unknown): string {
    if (value === undefined) {
        throw new TypeError('canonicalSerialize: undefined is not JSON');
    }
    if (value === null) {
        return 'null';
    }
    const kind = typeof value;
    if (kind === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (kind === 'string') {
        return JSON.stringify(value);
    }
    if (kind === 'number') {
        return formatCanonicalNumber(value as number);
    }
    if (kind === 'bigint') {
        throw new TypeError('canonicalSerialize: bigint is not supported');
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => serializeValue(item)).join(',')}]`;
    }
    if (kind === 'object') {
        const record = value as Record<string, unknown>;
        const body = Object.keys(record)
            .filter((key) => record[key] !== undefined)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${serializeValue(record[key])}`)
            .join(',');
        return `{${body}}`;
    }
    throw new TypeError(`canonicalSerialize: unsupported type ${kind}`);
}

/** Canonical JSON text suitable for cross-platform hashing. */
export function canonicalSerialize(value: unknown): string {
    return serializeValue(value);
}

/** Lower-case SHA-256 hex of {@link canonicalSerialize}. */
export function hashCanonicalSerialize(value: unknown): string {
    return sha256Utf8(canonicalSerialize(value));
}
