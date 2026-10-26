/**
 * deltat.ts — ΔT = TT − UT1, the offset between uniform dynamical time and
 * Earth-rotation-based civil time.
 *
 * Ephemerides (DE440s) are indexed by TDB; birth data is given in UT. One
 * second of ΔT moves the Moon by ~0.55″ and the Sun by ~0.041″.
 *
 * Precision profile 'jhora' (the default) reproduces the ΔT model of
 * Swiss Ephemeris 2.02.01, the release bundled with Jagannatha Hora. It is
 * built here from the published formulas and the observed record only;
 * nothing is sampled from Swiss Ephemeris or JHora output:
 *
 *   • year ≤ −500 — Morrison & Stephenson (2004), J. Hist. Astron. 35, 327:
 *       ΔT = −20 + 32 u², u = (y − 1820)/100;
 *   • −500 < y < 1633 — Espenak & Meeus (2006), "Polynomial expressions for
 *     Delta T", NASA Five Millennium Canon of Solar Eclipses (TP-2006-214141),
 *     https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html — the −500…500,
 *     500…1600 and 1600…1700 polynomials;
 *   • 1633 ≤ y ≤ 2019 — the observed annual record (deltat-observed.ts:
 *     Astronomical Almanac K8–K9, then USNO), interpolated with Bessel's
 *     central-difference formula through fourth differences (Abramowitz &
 *     Stegun, Handbook of Mathematical Functions, §25.2);
 *   • y > 2019 — Stephenson (1997), Historical Eclipses and Earth's
 *     Rotation, p. 507: ΔT = −20 + 31 u², joined to the last observation by
 *     a correction that decays linearly to zero over 100 years.
 *
 * Before 1955 the record and the polynomials refer to the lunar tidal
 * acceleration ṅ = −26″/cy². They are moved to the ephemeris value with the
 * correction of Morrison & Ward / Espenak & Meeus,
 *     δ(ΔT) = −0.000091 (ṅ + 26) (y − 1955)²  seconds,
 * using ṅ = −25.8″/cy², the DE431 lunar tidal acceleration that the Swiss
 * Ephemeris general documentation (ch. 7, "ΔT") gives as the default for its
 * DE431-based files.
 *
 * The decimal year is y = 2000 + (JD − 2451545)/365.2425 (mean Gregorian
 * year), and the observed-record branch indexes 1 January values by that
 * same decimal year.
 */

import { OBSERVED_DELTAT_JAN1, OBSERVED_DELTAT_YEAR0 } from './deltat-observed.js';

/** Supported precision profiles. See CalculationSettings.precisionProfile. */
export type PrecisionProfile = 'jhora';

/** Identifier recorded in result envelopes for the ΔT model in use. */
export const DELTA_T_MODEL_JHORA = 'jhora-se2.02:ms2004+em2006+aa-usno-obs+st1997';

/** Lunar tidal acceleration of the ephemeris, ″/cy² (DE430/DE431). */
export const TIDAL_ACCELERATION = -25.8;

const RECORD_FIRST = OBSERVED_DELTAT_YEAR0;
const RECORD_LAST = OBSERVED_DELTAT_YEAR0 + OBSERVED_DELTAT_JAN1.length - 1;
/** First year interpolated from the observed record rather than a polynomial. */
const RECORD_START = 1633;

/** Last year whose ΔT comes from an observation rather than extrapolation. */
export const LAST_OBSERVED_YEAR = RECORD_LAST;

function decimalYear(jd: number): number {
    return 2000.0 + (jd - 2451545.0) / 365.2425;
}

function recordAt(year: number): number {
    const y = Math.min(Math.max(year, RECORD_FIRST), RECORD_LAST);
    return OBSERVED_DELTAT_JAN1[y - RECORD_FIRST];
}

/** Bessel's interpolation formula through fourth differences. */
function interpolateRecord(y: number): number {
    let i = Math.floor(y);
    if (i < RECORD_START) i = RECORD_START;
    if (i > RECORD_LAST - 1) i = RECORD_LAST - 1;
    const p = y - i;
    const fm2 = recordAt(i - 2),
        fm1 = recordAt(i - 1),
        f0 = recordAt(i);
    const f1 = recordAt(i + 1),
        f2 = recordAt(i + 2),
        f3 = recordAt(i + 3);
    const d1 = f1 - f0;
    const d2sum = f2 - f1 - (f0 - fm1); // δ²₀ + δ²₁
    const d3 = f2 - 3 * f1 + 3 * f0 - fm1; // δ³½
    const d4sum = fm2 - 4 * fm1 + 6 * f0 - 4 * f1 + f2 + (fm1 - 4 * f0 + 6 * f1 - 4 * f2 + f3); // δ⁴₀ + δ⁴₁
    return (
        f0 +
        p * d1 +
        ((p * (p - 1)) / 4) * d2sum +
        ((p * (p - 1) * (p - 0.5)) / 6) * d3 +
        (((p + 1) * p * (p - 1) * (p - 2)) / 48) * d4sum
    );
}

/** Stephenson (1997) long-term parabola. */
function stephenson1997(y: number): number {
    const u = (y - 1820) / 100;
    return -20 + 31 * u * u;
}

/** ΔT on the ṅ = −26″/cy² system (before the tidal correction). */
function deltaTRaw(y: number): number {
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
    if (y < RECORD_START) {
        const t = y - 1600;
        return 120 - 0.9808 * t - 0.01532 * t * t + t ** 3 / 7129;
    }
    if (y <= RECORD_LAST) return interpolateRecord(y);
    let v = stephenson1997(y);
    if (y < RECORD_LAST + 100) {
        v += (recordAt(RECORD_LAST) - stephenson1997(RECORD_LAST)) * (1 - (y - RECORD_LAST) / 100);
    }
    return v;
}

/**
 * ΔT = TT − UT1 in seconds for the given Julian Day (UT).
 *
 * @param jdUT     Julian Day in UT
 * @param profile  precision profile (only 'jhora' in this release)
 */
export function deltaT(jdUT: number, profile: PrecisionProfile = 'jhora'): number {
    void profile;
    const y = decimalYear(jdUT);
    let v = deltaTRaw(y);
    if (y < 1955) v += -0.000091 * (TIDAL_ACCELERATION + 26) * (y - 1955) ** 2;
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
