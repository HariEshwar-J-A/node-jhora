/**
 * Canonical JSON and the settings hash.
 *
 * Objects are sorted by key at every level so `{b,a}` and `{a,b}` hash alike.
 * Arrays keep their order. `undefined` values are dropped.
 */

import {
    type CalculationSettings,
    CalculationSettingsSchema,
    SETTINGS_HASH_HEX_LENGTH,
} from './schema.js';
import { sha256Utf8 } from './sha256.js';

export function canonicalJson(value: unknown): string {
    return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value !== null && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(source).sort()) {
            if (source[key] !== undefined) sorted[key] = sortValue(source[key]);
        }
        return sorted;
    }
    return value;
}

/** SHA-256 of the canonical settings JSON, truncated to {@link SETTINGS_HASH_HEX_LENGTH}. */
export function hashSettings(input: CalculationSettings | unknown): string {
    const settings = CalculationSettingsSchema.parse(input);
    return sha256Utf8(canonicalJson(settings)).slice(0, SETTINGS_HASH_HEX_LENGTH);
}
