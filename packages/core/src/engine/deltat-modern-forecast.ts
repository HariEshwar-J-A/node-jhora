/**
 * Post-tabulation ΔT forecast from published SMH2016 / UKHO forms, with a gradual
 * hand-off from the last bridge sample (programmer-manual ch. 7, ΔT section:
 * long-term polynomial plus a correction that fades linearly over one century
 * so the tabulated end and the model meet without a step).
 *
 * @provenance Stephenson, Morrison & Hohenkerk (2016), UKHO supplement
 * (https://astro.ukho.gov.uk/nao/lvm/); millennial branch coefficients as in
 * the same manual's 2016-model description.
 */

/** Years after the bridge end before the hand-off correction reaches zero. */
export const FORECAST_HANDOFF_SPAN_YEARS = 100;

/** Year where the near-term cubic yields to the millennial parabola. */
export const FORECAST_MILLENNIAL_ONSET_YEAR = 2500;

/**
 * Near-term cubic in ΔT (seconds), UKHO / SMH2016 supplement near 2000 CE.
 * Independent variable: Gregorian year Y.
 */
export function nearTermForecastCubic(y: number): number {
    const offsetFrom2000 = y - 2000;
    return (
        (offsetFrom2000 ** 3 * 121) / 30_000_000 +
        offsetFrom2000 ** 2 / 1250 +
        (offsetFrom2000 * 521) / 3000 +
        64
    );
}

/** Millennial parabola (seconds), manual 2016-model long branch. */
export function millennialForecastParabola(y: number): number {
    const centuriesFrom2000 = 0.01 * (y - 2000);
    return centuriesFrom2000 * centuriesFrom2000 * 32.5 + 42.5;
}

function baselineForecast(y: number): number {
    if (y < FORECAST_MILLENNIAL_ONSET_YEAR) return nearTermForecastCubic(y);
    return millennialForecastParabola(y);
}

/**
 * Forecast ΔT after the oracle bridge, fading a constant offset so the cubic
 * matches the last bridge second at {@link bridgeEndYear} and the offset is
 * gone {@link FORECAST_HANDOFF_SPAN_YEARS} years later.
 */
export function deltaTModernForecast(
    y: number,
    bridgeEndYear: number,
    bridgeEndSeconds: number,
): number {
    const natural = baselineForecast(y);
    const handoffCompleteYear = bridgeEndYear + FORECAST_HANDOFF_SPAN_YEARS;
    if (y > handoffCompleteYear) return natural;
    const naturalAtBridgeEnd = nearTermForecastCubic(bridgeEndYear);
    const offsetAtBridgeEnd = naturalAtBridgeEnd - bridgeEndSeconds;
    const yearsBeforeHandoffEnds = handoffCompleteYear - y;
    const handoffFraction = yearsBeforeHandoffEnds / FORECAST_HANDOFF_SPAN_YEARS;
    return natural - offsetAtBridgeEnd * handoffFraction;
}
