/**
 * Post-tabulation ΔT forecast dispatch for precision profile `modern`.
 *
 * @see deltat-modern-forecast-published.ts (default `deltaTForecast: 'published'`)
 * @see deltat-modern-forecast-oracle-compat.ts (`deltaTForecast: 'oracle-compat'`)
 */

import type { DeltaTForecastId } from '../settings/schema.js';
import { deltaTModernForecastOracleCompat } from './deltat-modern-forecast-oracle-compat.js';
import { deltaTModernForecastPublished } from './deltat-modern-forecast-published.js';
import { FORECAST_HANDOFF_SPAN_YEARS } from './deltat-modern-forecast-shared.js';

export type { DeltaTForecastId };

export { FORECAST_HANDOFF_SPAN_YEARS };
export {
    deltaTModernForecastOracleCompat,
    oracleCompatMillennialForecastParabola,
    oracleCompatNearTermForecastCubic,
} from './deltat-modern-forecast-oracle-compat.js';
export {
    FORECAST_SMH2016_BLEND_YEARS,
    FORECAST_UKHO_LAST_YEAR,
    smh2016MillennialParabola,
    UKHO_DELTAT_TABLE,
    ukhoIntegratedForecast,
    ukhoLodMilliseconds,
} from './deltat-modern-forecast-published.js';

export function deltaTModernForecast(
    y: number,
    bridgeEndYear: number,
    bridgeEndSeconds: number,
    forecast: DeltaTForecastId = 'published',
): number {
    if (forecast === 'oracle-compat') {
        return deltaTModernForecastOracleCompat(y, bridgeEndYear, bridgeEndSeconds);
    }
    return deltaTModernForecastPublished(y, bridgeEndYear, bridgeEndSeconds);
}
