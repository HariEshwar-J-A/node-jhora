/**
 * Published ΔT forecast after the USNO preds bridge (2028 CE).
 *
 * UKHO HMNAO lod integration (Wayback 2023-01-03 snapshot of
 * https://astro.ukho.gov.uk/nao/lvm/) through 2500 CE, then SMH2016 eq. 4.1
 * (Stephenson, Morrison & Hohenkerk 2016, CC-BY-4.0) with a linear blend at 2500.
 */

import { FORECAST_HANDOFF_SPAN_YEARS } from './deltat-modern-forecast-shared.js';

/** Last year of the UKHO lod integration before SMH2016 eq. 4.1 dominates. */
export const FORECAST_UKHO_LAST_YEAR = 2500;

/** Years over which UKHO and SMH2016 eq. 4.1 are linearly blended at the join. */
export const FORECAST_SMH2016_BLEND_YEARS = 100;

/** UKHO lod in milliseconds; t = centuries from 1825.0. */
export function ukhoLodMilliseconds(tCenturies: number): number {
    return 1.72 * tCenturies - 3.5 * Math.sin((2 * Math.PI * (tCenturies + 0.75)) / 14);
}

/** SMH2016 eq. 4.1 (seconds). */
export function smh2016MillennialParabola(y: number): number {
    const c = (y - 1825) / 100;
    return -320 + 32.5 * c * c;
}

/** HMNAO LVM tabulated ΔT (seconds) at century anchors, for regression tests. */
export const UKHO_DELTAT_TABLE: readonly (readonly [year: number, deltaTSeconds: number])[] = [
    [2030, 67],
    [2040, 68],
    [2050, 70],
    [2100, 80],
    [2200, 160],
    [2300, 330],
    [2400, 610],
    [2500, 1000],
];

const LOD_INTEGRAL_SEC_PER_MS_CENTURY = (365.25 * 100) / 1000;

function tCenturiesFromYear(y: number): number {
    return (y - 1825) / 100;
}

function integrateUkhoLod(y0: number, y1: number): number {
    if (y1 <= y0) return 0;
    const steps = Math.max(8, Math.ceil((y1 - y0) * 4));
    const h = (y1 - y0) / steps;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
        const ya = y0 + i * h;
        const yb = ya + h;
        const ta = tCenturiesFromYear(ya);
        const tb = tCenturiesFromYear(yb);
        sum += 0.5 * (ukhoLodMilliseconds(ta) + ukhoLodMilliseconds(tb)) * (tb - ta);
    }
    return sum * LOD_INTEGRAL_SEC_PER_MS_CENTURY;
}

export function ukhoIntegratedForecast(
    y: number,
    bridgeEndYear: number,
    bridgeEndSeconds: number,
): number {
    return bridgeEndSeconds + integrateUkhoLod(bridgeEndYear, y);
}

function baselineForecast(y: number, bridgeEndYear: number, bridgeEndSeconds: number): number {
    if (y <= FORECAST_UKHO_LAST_YEAR) {
        return ukhoIntegratedForecast(y, bridgeEndYear, bridgeEndSeconds);
    }
    const smh = smh2016MillennialParabola(y);
    if (y >= FORECAST_UKHO_LAST_YEAR + FORECAST_SMH2016_BLEND_YEARS) return smh;
    const ukhoAt2500 = ukhoIntegratedForecast(
        FORECAST_UKHO_LAST_YEAR,
        bridgeEndYear,
        bridgeEndSeconds,
    );
    const w = (y - FORECAST_UKHO_LAST_YEAR) / FORECAST_SMH2016_BLEND_YEARS;
    return (1 - w) * ukhoAt2500 + w * smh;
}

/** Published forecast with bridge hand-off. */
export function deltaTModernForecastPublished(
    y: number,
    bridgeEndYear: number,
    bridgeEndSeconds: number,
): number {
    const natural = baselineForecast(y, bridgeEndYear, bridgeEndSeconds);
    const handoffCompleteYear = bridgeEndYear + FORECAST_HANDOFF_SPAN_YEARS;
    if (y > handoffCompleteYear) return natural;
    const naturalAtBridgeEnd = ukhoIntegratedForecast(
        bridgeEndYear,
        bridgeEndYear,
        bridgeEndSeconds,
    );
    const offsetAtBridgeEnd = naturalAtBridgeEnd - bridgeEndSeconds;
    const yearsBeforeHandoffEnds = handoffCompleteYear - y;
    const handoffFraction = yearsBeforeHandoffEnds / FORECAST_HANDOFF_SPAN_YEARS;
    return natural - offsetAtBridgeEnd * handoffFraction;
}
