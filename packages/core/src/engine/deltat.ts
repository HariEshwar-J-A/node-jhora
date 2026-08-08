/**
 * deltat.ts — ΔT = TT − UT1, the offset between uniform dynamical time and
 * Earth-rotation-based civil time.
 *
 * Ephemerides (DE440) are indexed by TDB; birth data is given in UT. Ignoring
 * ΔT shifts every body by its motion over ~60 s, which for the Moon is ~35″ —
 * far larger than everything else in this engine combined.
 *
 * Implementation: the Espenak & Meeus polynomial expressions published by NASA
 * (https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html), the same family of
 * fits Swiss Ephemeris uses outside its tabulated range. For 1600–2150 — which
 * covers all of de440s.bsp — these are accurate to ~1 s or better, i.e. under
 * 0.6″ of lunar motion.
 */

/** Decimal year from a Julian Day (sufficient precision for a ΔT fit). */
function decimalYear(jd: number): number {
    return 2000.0 + (jd - 2451545.0) / 365.25;
}

// ---------------------------------------------------------------------------
// Observed ΔT
// ---------------------------------------------------------------------------

/** First year of the observation table. */
const OBS_START = 2005;

/**
 * Observed ΔT at the start of each year, seconds.
 *
 * ΔT = 32.184 + (TAI − UTC) − (UT1 − UTC), from IERS Bulletin A / USNO.
 *
 * These are measurements, and they matter: the Espenak & Meeus 2005–2050 fit was
 * made in 2006 and assumed Earth's rotation would keep slowing. It did not —
 * the planet has run slightly *fast* since ~2016. By 2024 the polynomial
 * over-predicts ΔT by ~5 s, which is 2.5″ of lunar motion, enough on its own to
 * blow the engine's 1″ budget. Swiss Ephemeris tabulates observations for the
 * same reason.
 */
const OBSERVED_DELTA_T: readonly number[] = [
    64.69, // 2005
    64.85, // 2006
    65.15, // 2007
    65.46, // 2008
    65.78, // 2009
    66.07, // 2010
    66.32, // 2011
    66.60, // 2012
    66.91, // 2013
    67.28, // 2014
    67.64, // 2015
    68.10, // 2016
    68.59, // 2017
    68.97, // 2018
    69.22, // 2019
    69.36, // 2020
    69.36, // 2021
    69.29, // 2022
    69.22, // 2023
    69.18, // 2024
    69.20, // 2025
];

/** Last year covered by {@link OBSERVED_DELTA_T}. */
export const LAST_OBSERVED_YEAR = OBS_START + OBSERVED_DELTA_T.length - 1;

/** Linear interpolation within the observation table. */
function observedDeltaT(y: number): number {
    const idx = Math.floor(y - OBS_START);
    const f   = y - OBS_START - idx;
    const a   = OBSERVED_DELTA_T[idx];
    const b   = OBSERVED_DELTA_T[Math.min(idx + 1, OBSERVED_DELTA_T.length - 1)];
    return a + (b - a) * f;
}

/**
 * Espenak & Meeus fit for 2005–2050, retained as the *shape* of the future
 * curve. It is offset to join the observation table continuously at
 * {@link LAST_OBSERVED_YEAR}, and the offset is tapered out by 2150 so the
 * long-term parabola is recovered at the far end of the ephemeris range.
 *
 * Future ΔT is not predictable to better than tens of seconds by anyone; this
 * simply avoids a discontinuity at the end of the observed record.
 */
function extrapolatedDeltaT(y: number): number {
    const poly = (yy: number) => {
        const u = yy - 2000;
        return 62.92 + 0.32217 * u + 0.005589 * u ** 2;
    };

    const offset = OBSERVED_DELTA_T[OBSERVED_DELTA_T.length - 1] - poly(LAST_OBSERVED_YEAR);
    const taper  = Math.max(0, 1 - (y - LAST_OBSERVED_YEAR) / (2150 - LAST_OBSERVED_YEAR));

    return poly(y) + offset * taper;
}

/**
 * ΔT = TT − UT1 in seconds for the given Julian Day (UT).
 *
 * @param jdUT  Julian Day in UT
 */
export function deltaT(jdUT: number): number {
    const y = decimalYear(jdUT);
    let u: number;

    if (y < -500) {
        u = (y - 1820) / 100;
        return -20 + 32 * u * u;
    }
    if (y < 500) {
        u = y / 100;
        return 10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3
             - 0.1798452 * u ** 4 + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6;
    }
    if (y < 1600) {
        u = (y - 1000) / 100;
        return 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3
             - 0.8503463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
    }
    if (y < 1700) {
        u = y - 1600;
        return 120 - 0.9808 * u - 0.01532 * u ** 2 + u ** 3 / 7129;
    }
    if (y < 1800) {
        u = y - 1700;
        return 8.83 + 0.1603 * u - 0.0059285 * u ** 2 + 0.00013336 * u ** 3 - u ** 4 / 1174000;
    }
    if (y < 1860) {
        u = y - 1800;
        return 13.72 - 0.332447 * u + 0.0068612 * u ** 2 + 0.0041116 * u ** 3
             - 0.00037436 * u ** 4 + 0.0000121272 * u ** 5
             - 0.0000001699 * u ** 6 + 0.000000000875 * u ** 7;
    }
    if (y < 1900) {
        u = y - 1860;
        return 7.62 + 0.5737 * u - 0.251754 * u ** 2 + 0.01680668 * u ** 3
             - 0.0004473624 * u ** 4 + u ** 5 / 233174;
    }
    if (y < 1920) {
        u = y - 1900;
        return -2.79 + 1.494119 * u - 0.0598939 * u ** 2 + 0.0061966 * u ** 3 - 0.000197 * u ** 4;
    }
    if (y < 1941) {
        u = y - 1920;
        return 21.20 + 0.84493 * u - 0.076100 * u ** 2 + 0.0020936 * u ** 3;
    }
    if (y < 1961) {
        u = y - 1950;
        return 29.07 + 0.407 * u - u ** 2 / 233 + u ** 3 / 2547;
    }
    if (y < 1986) {
        u = y - 1975;
        return 45.45 + 1.067 * u - u ** 2 / 260 - u ** 3 / 718;
    }
    if (y < OBS_START) {
        u = y - 2000;
        return 63.86 + 0.3345 * u - 0.060374 * u ** 2 + 0.0017275 * u ** 3
             + 0.000651814 * u ** 4 + 0.00002373599 * u ** 5;
    }
    if (y <= LAST_OBSERVED_YEAR) {
        return observedDeltaT(y);
    }
    if (y < 2150) {
        return extrapolatedDeltaT(y);
    }

    u = (y - 1820) / 100;
    return -20 + 32 * u * u;
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
