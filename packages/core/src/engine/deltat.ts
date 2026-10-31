/**
 * deltat.ts — ΔT = TT − UT1, the offset between uniform dynamical time and
 * Earth-rotation-based civil time.
 *
 * Ephemerides (DE440s) are indexed by TDB; birth data is given in UT. One
 * second of ΔT moves the Moon by ~0.55″ and the Sun by ~0.041″.
 *
 * Precision profile 'jhora' (default) matches Swiss Ephemeris 2.02.01 / JHora 8:
 *   • y ≤ −500 — Morrison & Stephenson (2004);
 *   • −500 < y < table switch — Espenak & Meeus (2006) polynomials (NASA GSFC,
 *     https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html, public domain);
 *   • JD(UT) ≥ 2317746.130902778 — AA K8–K9 / USNO yearly table (Bessel 4th);
 *     switch JD is an oracle-measured boundary (ADR 0007), not a published date;
 *   • y > 2019 — Stephenson (1997) with 100-year linear join to the table end.
 *
 * Precision profile 'modern' — SMH2016 Table S15 through the 1953 CE knot, blend to the
 * IERS/USNO yearly table through 2028, then a post-bridge forecast selected by
 * {@link CalculationSettings.deltaTForecast}: `'published'` (UKHO lod + SMH2016 eq. 4.1,
 * default) or `'oracle-compat'` (in-house pyswisseph 2.10 extrapolation; test oracles only).
 *
 * Tidal correction (both profiles, y < 1955 only): van Gent / NASA polynomial
 * form δ(ΔT) = −0.91072 (ṅ_to − ṅ_from) u² s, u = (y − 1955.5)/100 (modern);
 * Meeus/AA equivalent −0.000091 (ṅ_to − ṅ_from)(y − 1955)² (jhora). See
 * deltat-tidal.ts. SMH2016 Table S15 uses the mean-Gregorian year scale from
 * JD 2451545 (365.2425 d) by convention in this codebase — an assumption unless
 * sourced from the S15 supplementary readme (ADR 0007).
 */

import { interpolateBesselFourth } from './deltat-interpolate.js';
import { JHORA_DELTAT_JAN1, JHORA_DELTAT_LAST_YEAR } from './deltat-jhora-yearly.js';
import {
    DELTA_T_MODEL_MODERN,
    DELTA_T_MODEL_MODERN_ORACLE_COMPAT,
    DELTA_T_MODEL_MODERN_PUBLISHED,
    deltaTModern,
    LAST_OBSERVED_YEAR_MODERN as LAST_OBSERVED_YEAR_MODERN_PROFILE,
    modernDeltaTModelId,
} from './deltat-modern.js';
import type { DeltaTForecastId } from './deltat-modern-forecast.js';
import { OBSERVED_DELTAT_YEAR0 } from './deltat-observed.js';
import { TIDAL_ACCELERATION_AA, tidalMeeusCorrection } from './deltat-tidal.js';

/** Supported precision profiles. See CalculationSettings.precisionProfile. */
export type PrecisionProfile = 'jhora' | 'modern';

export type { DeltaTForecastId } from './deltat-modern-forecast.js';

/** Identifier recorded in result envelopes for the ΔT model in use. */
export const DELTA_T_MODEL_JHORA = 'jhora-se2.02:ms2004+em2006+aa-usno-yearly+st1997';
export {
    DELTA_T_MODEL_MODERN,
    DELTA_T_MODEL_MODERN_ORACLE_COMPAT,
    DELTA_T_MODEL_MODERN_PUBLISHED,
    modernDeltaTModelId,
};

/**
 * JD(UT) where the jhora profile switches from Espenak/Meeus polynomials to the
 * yearly AA/USNO table. Value = 1633-09-02 15:08:24 UT (y ≈ 1633.671); measured
 * from JHora / SE 2.02 tabulation, not from an open publication (ADR 0007).
 */
export const JHORA_TABLE_SWITCH_JD = 2317746.130902778;

/** Envelope identifier for a profile (or for a pinned override). */
export function deltaTModelId(
    profile: PrecisionProfile = 'jhora',
    overrideSeconds?: number,
    forecast: DeltaTForecastId = 'published',
): string {
    if (overrideSeconds !== undefined) return `override:${overrideSeconds}s`;
    if (profile === 'modern') return modernDeltaTModelId(forecast);
    return DELTA_T_MODEL_JHORA;
}

/** Lunar tidal acceleration of the ephemeris, ″/cy² (DE430/DE431). */
export const TIDAL_ACCELERATION = -25.8;

/** ṅ underlying the SMH2016 spline, ″/cy² (Stephenson et al. 2016). */
export const SMH2016_TIDAL_ACCELERATION = -25.85;

const RECORD_FIRST = OBSERVED_DELTAT_YEAR0;
/** First calendar year in the yearly table used for Bessel interpolation. */
const RECORD_START = 1633;

const JHORA_RECORD: readonly number[] = JHORA_DELTAT_JAN1;
/** Last year whose ΔT comes from the yearly table ('jhora' profile). */
export const LAST_OBSERVED_YEAR = JHORA_DELTAT_LAST_YEAR;
/** Last year whose ΔT comes from the yearly table ('modern' profile). */
export const LAST_OBSERVED_YEAR_MODERN = LAST_OBSERVED_YEAR_MODERN_PROFILE;

/** Last observed year for a profile. Later dates use a predicted ΔT. */
export function lastObservedDeltaTYear(profile: PrecisionProfile = 'jhora'): number {
    return profile === 'modern' ? LAST_OBSERVED_YEAR_MODERN : LAST_OBSERVED_YEAR;
}

export function decimalYear(jd: number): number {
    return 2000.0 + (jd - 2451545.0) / 365.2425;
}

function recordAt(record: readonly number[], year: number): number {
    const last = RECORD_FIRST + record.length - 1;
    const y = Math.min(Math.max(year, RECORD_FIRST), last);
    return record[y - RECORD_FIRST];
}

function interpolateRecord(record: readonly number[], y: number): number {
    const last = RECORD_FIRST + record.length - 1;
    let i = Math.floor(y);
    if (i < RECORD_START) i = RECORD_START;
    if (i > last - 1) i = last - 1;
    const p = y - i;
    return interpolateBesselFourth(
        p,
        recordAt(record, i - 2),
        recordAt(record, i - 1),
        recordAt(record, i),
        recordAt(record, i + 1),
        recordAt(record, i + 2),
        recordAt(record, i + 3),
    );
}

/** Stephenson (1997) long-term parabola. */
function stephenson1997(y: number): number {
    const u = (y - 1820) / 100;
    return -20 + 31 * u * u;
}

/** Stephenson (1997), joined to the last table value over 100 years. */
function extrapolate(record: readonly number[], y: number): number {
    const last = RECORD_FIRST + record.length - 1;
    let v = stephenson1997(y);
    if (y < last + 100) {
        v += (recordAt(record, last) - stephenson1997(last)) * (1 - (y - last) / 100);
    }
    return v;
}

/** Polynomial branches (Espenak & Meeus, NASA deltatpoly.html, PD). */
function deltaTPolynomial(y: number): number {
    if (y <= -500) {
        const u = (y - 1820) / 100;
        return -20 + 32 * u * u;
    }
    if (y <= 500) {
        const u = y / 100;
        return (
            10583.6 -
            1014.41 * u +
            33.78311 * u ** 2 -
            5.952053 * u ** 3 -
            0.1798452 * u ** 4 +
            0.022174192 * u ** 5 +
            0.0090316521 * u ** 6
        );
    }
    if (y < 1600) {
        const u = (y - 1000) / 100;
        return (
            1574.2 -
            556.01 * u +
            71.23472 * u ** 2 +
            0.319781 * u ** 3 -
            0.8503463 * u ** 4 -
            0.005050998 * u ** 5 +
            0.0083572073 * u ** 6
        );
    }
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t * t + t ** 3 / 7129;
}

function deltaTRaw(jdUT: number): number {
    const y = decimalYear(jdUT);
    if (jdUT < JHORA_TABLE_SWITCH_JD) return deltaTPolynomial(y);
    if (y <= LAST_OBSERVED_YEAR) return interpolateRecord(JHORA_RECORD, y);
    return extrapolate(JHORA_RECORD, y);
}

/** The ΔT model in force for engine calls that do not name one. */
export interface DeltaTContext {
    profile: PrecisionProfile;
    /** Fixed ΔT in seconds, replacing the model (CalculationSettings.deltaTOverrideSeconds). */
    overrideSeconds?: number;
    /** Post-bridge forecast when `profile === 'modern'` (default `'published'`). */
    forecast?: DeltaTForecastId;
}

let active: DeltaTContext = { profile: 'jhora' };

/** The ΔT context in force. */
export function getDeltaTContext(): DeltaTContext {
    return active;
}

/**
 * Run fn with a ΔT model in force. Nested calls restore the outer model on
 * exit, including when fn throws. The engine is synchronous, so the context
 * cannot leak into unrelated work.
 */
export function withDeltaTContext<T>(ctx: Partial<DeltaTContext> | undefined, fn: () => T): T {
    if (
        !ctx ||
        (ctx.profile === undefined &&
            ctx.overrideSeconds === undefined &&
            ctx.forecast === undefined)
    ) {
        return fn();
    }
    const previous = active;
    active = {
        profile: ctx.profile ?? previous.profile,
        overrideSeconds: ctx.overrideSeconds ?? previous.overrideSeconds,
        forecast: ctx.forecast ?? previous.forecast,
    };
    try {
        return fn();
    } finally {
        active = previous;
    }
}

/**
 * ΔT = TT − UT1 in seconds for the given Julian Day (UT).
 *
 * @param jdUT     Julian Day in UT
 * @param profile  precision profile; defaults to the active context ('jhora'
 *                 unless set by withDeltaTContext). Passing a profile
 *                 explicitly ignores any override in the context.
 */
export function deltaT(
    jdUT: number,
    profile?: PrecisionProfile,
    forecast?: DeltaTForecastId,
): number {
    let effectiveProfile: PrecisionProfile;
    let effectiveForecast: DeltaTForecastId;

    if (profile === undefined) {
        if (active.overrideSeconds !== undefined) return active.overrideSeconds;
        effectiveProfile = active.profile;
        effectiveForecast = forecast ?? active.forecast ?? 'published';
    } else {
        effectiveProfile = profile;
        effectiveForecast = forecast ?? 'published';
    }

    if (effectiveProfile === 'modern') return deltaTModern(jdUT, effectiveForecast);
    const y = decimalYear(jdUT);
    let v = deltaTRaw(jdUT);
    const inTableEra = jdUT >= JHORA_TABLE_SWITCH_JD && y <= LAST_OBSERVED_YEAR;
    const inPolynomialEra = jdUT < JHORA_TABLE_SWITCH_JD;
    if (y < 1955 && (inPolynomialEra || inTableEra)) {
        v += tidalMeeusCorrection(y, TIDAL_ACCELERATION_AA);
    }
    return v;
}

/**
 * Convert a Julian Day in UT to ephemeris seconds past J2000.0 TDB, as required
 * by the SPK reader.
 *
 * TDB − TT is periodic with amplitude < 1.7 ms (≈ 0.00002″ of lunar motion), so
 * TT is used directly.
 */
export function jdUTtoET(jdUT: number): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    return (jdTT - 2451545.0) * 86400.0;
}
