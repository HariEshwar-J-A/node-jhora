import { CalculationSettingsSchema, canonicalJson } from '@node-jhora/core';

import { migrateNjh } from './migrate.js';
import { NjhChartV2, NjhChartV2Schema } from './schema.js';

function validateInlineSettings(chart: NjhChartV2): void {
    const override = chart.settingsOverride;
    if (override?.kind === 'inline') {
        CalculationSettingsSchema.parse(override.settings);
    }
}

/**
 * Parse JSON text or a parsed value into a validated v2 chart.
 * Applies migrations when `schemaVersion` is below the current version.
 */
export function parseNjh(input: string | unknown): NjhChartV2 {
    const value = typeof input === 'string' ? JSON.parse(input) as unknown : input;
    const chart = migrateNjh(value);
    validateInlineSettings(chart);
    return chart;
}

/** Canonical JSON text for a v2 chart (stable key order, no extra whitespace). */
export function serializeNjh(chart: NjhChartV2): string {
    const normalized = NjhChartV2Schema.parse(chart);
    validateInlineSettings(normalized);
    return canonicalJson(normalized);
}

/**
 * Lossless round-trip: parse → serialize → parse yields the same canonical document.
 */
export function roundTripNjh(input: string | unknown): NjhChartV2 {
    const first = parseNjh(input);
    const text = serializeNjh(first);
    const second = parseNjh(text);
    if (serializeNjh(second) !== text) {
        throw new Error('njh: round-trip canonical JSON mismatch');
    }
    return second;
}
