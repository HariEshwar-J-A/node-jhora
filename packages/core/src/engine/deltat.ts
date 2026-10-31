/**
 * deltat.ts — ΔT = TT − UT1, the offset between uniform dynamical time and
 * Earth-rotation-based civil time.
 *
 * Ephemerides (DE440s) are indexed by TDB; birth data is given in UT. One
 * second of ΔT moves the Moon by ~0.55″ and the Sun by ~0.041″.
 *
 * Precision profile 'jhora' (default) matches Swiss Ephemeris 2.02.01 / JHora 8:
 *   • y ≤ −500 — Morrison & Stephenson (2004);
 *   • −500 < y < table switch — Espenak & Meeus (2006) polynomials;
 *   • JD(UT) ≥ 2317746.130902778 — AA K8–K9 / USNO yearly table (Bessel 4th);
 *   • y > 2019 — Stephenson (1997) with 100-year linear join to the table end.
 *
 * Precision profile 'modern' — SMH2016 Table S15 to ~1952.25, blend to the
 * IERS/USNO yearly table through 2028, then UKHO/SMH2016 forecast (ADR 0007).
 *
 * Tidal correction (both profiles, y < 1955 only): Explanatory Supplement /
 * Meeus, δ(ΔT) = −0.000091 (ṅ + 26) (y − 1955)² s with ṅ = −25.8″/cy² (DE431).
 */

import { interpolateBesselFourth } from './deltat-interpolate.js';
import { JHORA_DELTAT_JAN1, JHORA_DELTAT_LAST_YEAR } from './deltat-jhora-yearly.js';
import {
    DELTA_T_MODEL_MODERN,
    deltaTModern,
    LAST_OBSERVED_YEAR_MODERN as LAST_OBSERVED_YEAR_MODERN_PROFILE,
} from './deltat-modern.js';
import { OBSERVED_DELTAT_YEAR0 } from './deltat-observed.js';
import { TIDAL_ACCELERATION_AA, tidalMeeusCorrection } from './deltat-tidal.js';

/** Supported precision profiles. See CalculationSettings.precisionProfile. */
export type PrecisionProfile = 'jhora' | 'modern';

/** Identifier recorded in result envelopes for the ΔT model in use. */
export const DELTA_T_MODEL_JHORA = 'jhora-se2.02:ms2004+em2006+aa-usno-yearly+st1997';
export { DELTA_T_MODEL_MODERN };

/**
 * JD(UT) where the jhora profile switches from Espenak/Meeus polynomials to the
 * yearly AA/USNO table (SE 2.02.01 / JHora 8 tabulation boundary).
 */
export const JHORA_TABLE_SWITCH_JD = 2317746.130902778;

/** Envelope identifier for a profile (or for a pinned override). */
export function deltaTModelId(
    profile: PrecisionProfile = 'jhora',
    overrideSeconds?: number,
): string {
    if (overrideSeconds !== undefined) return `override:${overrideSeconds}s`;
    return profile === 'modern' ? DELTA_T_MODEL_MODERN : DELTA_T_MODEL_JHORA;
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

/** Polynomial branches (ṅ = −26″/cy², before tidal correction). */
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
    if (!ctx || (ctx.profile === undefined && ctx.overrideSeconds === undefined)) return fn();
    const previous = active;
    active = {
        profile: ctx.profile ?? previous.profile,
        overrideSeconds: ctx.overrideSeconds ?? previous.overrideSeconds,
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
export function deltaT(jdUT: number, profile?: PrecisionProfile): number {
    if (profile === undefined) {
        if (active.overrideSeconds !== undefined) return active.overrideSeconds;
        profile = active.profile;
    }
    const y = decimalYear(jdUT);
    if (profile === 'modern') return deltaTModern(jdUT);
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
