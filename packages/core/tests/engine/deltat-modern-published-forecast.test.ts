/**
 * Published post-bridge ΔT forecast (default `deltaTForecast: 'published'`).
 */

import {
    MODERN_BRIDGE_LAST_YEAR,
    MODERN_BRIDGE_SAMPLES,
} from '../../src/engine/deltat-modern-bridge.js';
import {
    deltaTModernForecastPublished,
    FORECAST_SMH2016_BLEND_YEARS,
    FORECAST_UKHO_LAST_YEAR,
    smh2016MillennialParabola,
    UKHO_DELTAT_TABLE,
    ukhoIntegratedForecast,
} from '../../src/engine/deltat-modern-forecast-published.js';
import { deltaT } from '../../src/engine/deltat.js';
import { decimalYearAlmanac } from '../../src/engine/deltat-modern.js';

const BRIDGE_END_YEAR = MODERN_BRIDGE_LAST_YEAR;
const BRIDGE_END_SECONDS = MODERN_BRIDGE_SAMPLES[MODERN_BRIDGE_SAMPLES.length - 1][1];

/** HMNAO LVM table vs lod integral anchored at the USNO bridge (seconds). */
const UKHO_TABLE_TOLERANCE_S = 20;

function jdAlmanacYear(y: number): number {
    return 2451544.5 + (y - 2000) * 365.25;
}

describe('published ΔT forecast', () => {
    test('UKHO table anchors within tolerance (bridge-anchored integral)', () => {
        for (const [year, tabulated] of UKHO_DELTAT_TABLE) {
            const model = ukhoIntegratedForecast(year, BRIDGE_END_YEAR, BRIDGE_END_SECONDS);
            expect(Math.abs(model - tabulated)).toBeLessThanOrEqual(UKHO_TABLE_TOLERANCE_S);
        }
    });

    test('SMH2016 eq. 4.1 beyond the blend window', () => {
        const y = FORECAST_UKHO_LAST_YEAR + FORECAST_SMH2016_BLEND_YEARS + 50;
        const jd = jdAlmanacYear(y);
        const yTab = decimalYearAlmanac(jd);
        expect(deltaT(jd, 'modern', 'published')).toBeCloseTo(smh2016MillennialParabola(yTab), 6);
    });

    test('continuity across the 2500 CE blend (max 0.1 yr step ≤ 1.2 s)', () => {
        let prev = deltaTModernForecastPublished(
            FORECAST_UKHO_LAST_YEAR - 0.5,
            BRIDGE_END_YEAR,
            BRIDGE_END_SECONDS,
        );
        let maxStep = 0;
        for (
            let y = FORECAST_UKHO_LAST_YEAR - 0.5;
            y <= FORECAST_UKHO_LAST_YEAR + FORECAST_SMH2016_BLEND_YEARS;
            y += 0.1
        ) {
            const v = deltaTModernForecastPublished(y, BRIDGE_END_YEAR, BRIDGE_END_SECONDS);
            maxStep = Math.max(maxStep, Math.abs(v - prev));
            prev = v;
        }
        expect(maxStep).toBeLessThanOrEqual(1.2);
    });

    test('oracle-compat differs from published after 2100 CE', () => {
        const jd = jdAlmanacYear(2100);
        const published = deltaT(jd, 'modern', 'published');
        const oracle = deltaT(jd, 'modern', 'oracle-compat');
        expect(Math.abs(published - oracle)).toBeGreaterThan(1);
    });
});
