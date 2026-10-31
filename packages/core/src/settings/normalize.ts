import { type CalculationSettings, CalculationSettingsSchema } from './schema.js';

/**
 * Drop explicit defaults so settings hashes stay stable when callers pass
 * the same value the schema would omit (e.g. `calendar: 'auto'`).
 */
export function normalizeCalculationSettings(settings: CalculationSettings): CalculationSettings {
    const parsed = CalculationSettingsSchema.parse(settings);
    let out: CalculationSettings = parsed;
    if (parsed.calendar === 'auto') {
        const { calendar: _calendar, ...rest } = parsed;
        out = rest;
    }
    if (out.houseAnchor === 'ascendant') {
        const { houseAnchor: _houseAnchor, ...rest } = out;
        out = rest;
    }
    if (out.deltaTForecast === 'published' || out.deltaTForecast === undefined) {
        const { deltaTForecast: _deltaTForecast, ...rest } = out;
        out = rest;
    }
    if (out.starParallax === 'oracle-compat' || out.starParallax === undefined) {
        const { starParallax: _starParallax, ...rest } = out;
        out = rest;
    }
    return out;
}
