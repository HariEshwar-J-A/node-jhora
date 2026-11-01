// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * In-house ΔT forecast after the USNO preds bridge (2028 CE).
 *
 * This curve is **not** from UKHO, SMH2016, or any other published forecast. It was
 * chosen so the modern profile's post-bridge ΔT matches pyswisseph 2.10 extrapolation
 * in test oracles (near-term cubic plus a millennial parabola with a continuity offset
 * at 2500 CE). Select it with `deltaTForecast: 'oracle-compat'`; the default
 * `'published'` forecast uses {@link deltaTModernForecastPublished} instead.
 */

/** Years after the bridge end before the hand-off correction reaches zero. */
export const ORACLE_FORECAST_HANDOFF_SPAN_YEARS = 100;

/** Year where the near-term cubic yields to the millennial parabola. */
export const ORACLE_FORECAST_MILLENNIAL_ONSET_YEAR = 2500;

/** Near-term cubic (seconds), Gregorian year Y. In-house; matches legacy engine. */
export function oracleCompatNearTermForecastCubic(y: number): number {
    const offsetFrom2000 = y - 2000;
    return (
        (offsetFrom2000 ** 3 * 121) / 30_000_000 +
        offsetFrom2000 ** 2 / 1250 +
        (offsetFrom2000 * 521) / 3000 +
        64
    );
}

/** Millennial parabola (seconds). In-house; 42.5 enforces continuity with the cubic at 2500. */
export function oracleCompatMillennialForecastParabola(y: number): number {
    const centuriesFrom2000 = 0.01 * (y - 2000);
    return centuriesFrom2000 * centuriesFrom2000 * 32.5 + 42.5;
}

function oracleCompatBaselineForecast(y: number): number {
    if (y < ORACLE_FORECAST_MILLENNIAL_ONSET_YEAR) return oracleCompatNearTermForecastCubic(y);
    return oracleCompatMillennialForecastParabola(y);
}

/** Oracle-compat forecast with bridge hand-off (legacy behaviour). */
export function deltaTModernForecastOracleCompat(
    y: number,
    bridgeEndYear: number,
    bridgeEndSeconds: number,
): number {
    const natural = oracleCompatBaselineForecast(y);
    const handoffCompleteYear = bridgeEndYear + ORACLE_FORECAST_HANDOFF_SPAN_YEARS;
    if (y > handoffCompleteYear) return natural;
    const naturalAtBridgeEnd = oracleCompatNearTermForecastCubic(bridgeEndYear);
    const offsetAtBridgeEnd = naturalAtBridgeEnd - bridgeEndSeconds;
    const yearsBeforeHandoffEnds = handoffCompleteYear - y;
    const handoffFraction = yearsBeforeHandoffEnds / ORACLE_FORECAST_HANDOFF_SPAN_YEARS;
    return natural - offsetAtBridgeEnd * handoffFraction;
}
