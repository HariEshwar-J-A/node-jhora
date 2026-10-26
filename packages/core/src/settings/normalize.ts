import { type CalculationSettings, CalculationSettingsSchema } from './schema.js';

/**
 * Drop explicit defaults so settings hashes stay stable when callers pass
 * the same value the schema would omit (e.g. `calendar: 'auto'`).
 */
export function normalizeCalculationSettings(settings: CalculationSettings): CalculationSettings {
    const parsed = CalculationSettingsSchema.parse(settings);
    if (parsed.calendar === 'auto') {
        const { calendar: _calendar, ...rest } = parsed;
        return rest;
    }
    return parsed;
}
