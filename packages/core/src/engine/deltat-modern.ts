/**
 * ΔT for precision profile 'modern' — layout described in Swiss Ephemeris
 * programmer manual ch. 7 (ΔT), built from peer-reviewed SMH2016, USNO/IERS
 * observations, and pyswisseph-measured bridge samples (see DATA-SOURCES.md).
 *
 * @see deltat.ts module header, ADR 0007
 */

import {
    MODERN_BRIDGE_FIRST_YEAR,
    MODERN_BRIDGE_LAST_YEAR,
    MODERN_BRIDGE_SAMPLES,
} from './deltat-modern-bridge.js';
import { deltaTModernForecast } from './deltat-modern-forecast.js';
import { DELTAT_MONTHLY, DELTAT_MONTHLY_FIRST, DELTAT_MONTHLY_LAST } from './deltat-monthly.js';
import {
    OBSERVED_DELTAT_JAN1,
    OBSERVED_DELTAT_JAN1_MODERN_EXT,
    OBSERVED_DELTAT_YEAR0,
} from './deltat-observed.js';
import { deltaTSmh2016Spline } from './deltat-smh2016.js';
import { tidalSmh2016ToEphemeris } from './deltat-tidal.js';

/** Almanac-style Julian year (365.25 d, epoch JD 2451544.5) for tabulated ΔT. */
const ALMANAC_EPOCH_JD = 2451544.5;
const ALMANAC_DAYS_PER_YEAR = 365.25;

/** Mean Gregorian year for SMH2016 Table S15 (365.2425 d, epoch JD 2451545). */
const SMH2016_EPOCH_JD = 2451545.0;
const MEAN_GREGORIAN_DAYS_PER_YEAR = 365.2425;

/** Decimal year on the almanac Julian-year scale (tabulated / bridge / forecast). */
export function decimalYearAlmanac(jdUT: number): number {
    return 2000.0 + (jdUT - ALMANAC_EPOCH_JD) / ALMANAC_DAYS_PER_YEAR;
}

function decimalYearSmh2016(jdUT: number): number {
    return 2000.0 + (jdUT - SMH2016_EPOCH_JD) / MEAN_GREGORIAN_DAYS_PER_YEAR;
}

/** First calendar year taken from the AA/USNO observed record (not the spline). */
export const MODERN_OBSERVED_RECORD_START = 1955;

/** Linear blend from SMH2016 spline to the observed record (manual ch. 7). */
const SPLINE_TO_OBS_BLEND_START = 1954;

const RECORD_FIRST = OBSERVED_DELTAT_YEAR0;
const RECORD_START = 1633;

const MODERN_RECORD: readonly number[] = [
    ...OBSERVED_DELTAT_JAN1,
    ...OBSERVED_DELTAT_JAN1_MODERN_EXT,
];

export const LAST_OBSERVED_YEAR_MODERN = RECORD_FIRST + MODERN_RECORD.length - 1;

const RECORD_LAST = RECORD_FIRST + MODERN_RECORD.length - 1;

const BRIDGE_END_SECONDS = MODERN_BRIDGE_SAMPLES[MODERN_BRIDGE_SAMPLES.length - 1][1];

function recordAt(year: number): number {
    const y = Math.min(Math.max(year, RECORD_FIRST), RECORD_LAST);
    return MODERN_RECORD[y - RECORD_FIRST];
}

function bridgeAt(year: number): number {
    if (year <= MODERN_BRIDGE_SAMPLES[0][0]) return MODERN_BRIDGE_SAMPLES[0][1];
    if (year >= MODERN_BRIDGE_LAST_YEAR) return BRIDGE_END_SECONDS;
    let lo = 0;
    let hi = MODERN_BRIDGE_SAMPLES.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (MODERN_BRIDGE_SAMPLES[mid][0] <= year) lo = mid;
        else hi = mid;
    }
    const [y0, v0] = MODERN_BRIDGE_SAMPLES[lo];
    const [y1, v1] = MODERN_BRIDGE_SAMPLES[hi];
    const w = (year - y0) / (y1 - y0);
    return v0 + w * (v1 - v0);
}

/** Bessel interpolation through fourth differences (Abramowitz & Stegun §25.2). */
function interpolateAnnualRecord(
    year: number,
    sampleAt: (y: number) => number,
    lastYear: number,
): number {
    let i = Math.floor(year);
    if (i < RECORD_START) i = RECORD_START;
    if (i > lastYear - 1) i = lastYear - 1;
    const p = year - i;
    const fm2 = sampleAt(i - 2);
    const fm1 = sampleAt(i - 1);
    const f0 = sampleAt(i);
    const f1 = sampleAt(i + 1);
    const f2 = sampleAt(i + 2);
    const f3 = sampleAt(i + 3);
    const d1 = f1 - f0;
    const d2sum = f2 - f1 - (f0 - fm1);
    const d3 = f2 - 3 * f1 + 3 * f0 - fm1;
    const d4sum = fm2 - 4 * fm1 + 6 * f0 - 4 * f1 + f2 + (fm1 - 4 * f0 + 6 * f1 - 4 * f2 + f3);
    return (
        f0 +
        p * d1 +
        ((p * (p - 1)) / 4) * d2sum +
        ((p * (p - 1) * (p - 0.5)) / 6) * d3 +
        (((p + 1) * p * (p - 1) * (p - 2)) / 48) * d4sum
    );
}

/** Linear interpolation on USNO monthly ΔT (manual ch. 7, 1974+ series). */
function interpolateMonthly(y: number): number {
    if (y <= DELTAT_MONTHLY_FIRST) return DELTAT_MONTHLY[0][1];
    if (y >= DELTAT_MONTHLY_LAST) return DELTAT_MONTHLY[DELTAT_MONTHLY.length - 1][1];
    let lo = 0;
    let hi = DELTAT_MONTHLY.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (DELTAT_MONTHLY[mid][0] <= y) lo = mid;
        else hi = mid;
    }
    const [y0, v0] = DELTAT_MONTHLY[lo];
    const [y1, v1] = DELTAT_MONTHLY[hi];
    const w = (y - y0) / (y1 - y0);
    return v0 + w * (v1 - v0);
}

function tabulatedDeltaT(y: number): number {
    if (y > MODERN_BRIDGE_LAST_YEAR) {
        return deltaTModernForecast(y, MODERN_BRIDGE_LAST_YEAR, BRIDGE_END_SECONDS);
    }
    if (y >= MODERN_BRIDGE_FIRST_YEAR) {
        return interpolateAnnualRecord(y, bridgeAt, MODERN_BRIDGE_LAST_YEAR);
    }
    if (y >= DELTAT_MONTHLY_FIRST) return interpolateMonthly(y);
    return interpolateAnnualRecord(y, recordAt, RECORD_LAST);
}

function smh2016WithTidal(y: number): number {
    let v = deltaTSmh2016Spline(y);
    if (y < 1955) v += tidalSmh2016ToEphemeris(y);
    return v;
}

export function deltaTModern(jdUT: number): number {
    const yTab = decimalYearAlmanac(jdUT);
    const ySmh = decimalYearSmh2016(jdUT);
    if (yTab > MODERN_BRIDGE_LAST_YEAR) return tabulatedDeltaT(yTab);
    if (ySmh < SPLINE_TO_OBS_BLEND_START) return smh2016WithTidal(ySmh);
    if (ySmh < MODERN_OBSERVED_RECORD_START) {
        const obs = tabulatedDeltaT(yTab);
        const w =
            (ySmh - SPLINE_TO_OBS_BLEND_START) /
            (MODERN_OBSERVED_RECORD_START - SPLINE_TO_OBS_BLEND_START);
        return (1 - w) * smh2016WithTidal(ySmh) + w * obs;
    }
    return tabulatedDeltaT(yTab);
}

/** Identifier recorded in result envelopes for precision profile `modern` (SE 2.10-style ΔT). */
export const DELTA_T_MODEL_MODERN =
    'modern:smh2016-s15+aa-usno-monthly+oracle-bridge+ukho-cubic+smh2016-parabola';
