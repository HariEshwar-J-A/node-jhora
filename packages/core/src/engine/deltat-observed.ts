/**
 * @provenance Observed ΔT = TT − UT1 (seconds) at 1 January 0h of each year,
 * 1620–2019. Measured record, not a model output.
 *
 *   • 1620–2010: The Astronomical Almanac, Section K, Tables K8–K9
 *     ("Delta T", observed values; Stephenson & Morrison 1984 /
 *     McCarthy & Babcock 1986 / IERS), as reproduced by R. H. van Gent,
 *     "Delta T: Modern Values", https://webspace.science.uu.nl/~gent0113/deltat/deltat_modern.htm
 *     (values 1620–2010, the last year the Almanac lists as observed).
 *     These values are on the Almanac's lunar tidal acceleration ṅ = −26″/cy².
 *   • 2011–2019: U.S. Naval Observatory, Earth Orientation Department,
 *     observed monthly ΔT file "deltat.data" (1 January rows),
 *     https://maia.usno.navy.mil/ser7/deltat.data
 *     (ΔT = (TAI − UTC) − (UT1 − UTC) + 32.184 s, from IERS Bulletin B).
 *
 * The record stops at 2019: that is the end of the tabulated era in the
 * ΔT model of Swiss Ephemeris 2.02.01 (the release bundled with JHora),
 * whose behaviour the 'jhora' precision profile reproduces. Values after the
 * last observation come from Stephenson (1997), not from this file.
 * See deltat.ts for how the record is interpolated and continued.
 */
export const OBSERVED_DELTAT_YEAR0 = 1620;
export const OBSERVED_DELTAT_JAN1: readonly number[] = [
    124, 119, 115, 110, 106, 102, 98, 95, 91, 88, 85, 82, 79, 77, 74, 72, 70, 67, 65, 63, 62, 60,
    58, 57, 55, 54, 53, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 38, 37, 36, 35, 34, 33, 32,
    31, 30, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 14, 13, 12, 12, 11, 11, 10,
    10, 10, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11,
    11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12,
    12, 12, 13, 13, 13, 13, 13, 13, 13, 14, 14, 14, 14, 14, 14, 14, 15, 15, 15, 15, 15, 15, 15, 16,
    16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
    17, 17, 16, 16, 16, 16, 15, 15, 14, 14, 13.7, 13.4, 13.1, 12.9, 12.7, 12.6, 12.5, 12.5, 12.5,
    12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.4, 12.3, 12.2, 12.0, 11.7, 11.4, 11.1, 10.6,
    10.2, 9.6, 9.1, 8.6, 8.0, 7.5, 7.0, 6.6, 6.3, 6.0, 5.8, 5.7, 5.6, 5.6, 5.6, 5.7, 5.8, 5.9, 6.1,
    6.2, 6.3, 6.5, 6.6, 6.8, 6.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.7, 7.8, 7.8, 7.88, 7.82,
    7.54, 6.97, 6.4, 6.02, 5.41, 4.1, 2.92, 1.82, 1.61, 0.1, -1.02, -1.28, -2.69, -3.24, -3.64,
    -4.54, -4.71, -5.11, -5.4, -5.42, -5.2, -5.46, -5.46, -5.79, -5.63, -5.64, -5.8, -5.66, -5.87,
    -6.01, -6.19, -6.64, -6.44, -6.47, -6.09, -5.76, -4.66, -3.74, -2.72, -1.54, -0.02, 1.24, 2.64,
    3.86, 5.37, 6.14, 7.75, 9.13, 10.46, 11.53, 13.36, 14.65, 16.01, 17.2, 18.24, 19.06, 20.25,
    20.95, 21.16, 22.25, 22.41, 23.03, 23.49, 23.62, 23.86, 24.49, 24.34, 24.08, 24.02, 24.0, 23.87,
    23.95, 23.86, 23.93, 23.73, 23.92, 23.96, 24.02, 24.33, 24.83, 25.3, 25.7, 26.24, 26.77, 27.28,
    27.78, 28.25, 28.71, 29.15, 29.57, 29.97, 30.36, 30.72, 31.07, 31.35, 31.68, 32.18, 32.68,
    33.15, 33.59, 34.0, 34.47, 35.03, 35.73, 36.54, 37.43, 38.29, 39.2, 40.18, 41.17, 42.23, 43.37,
    44.49, 45.48, 46.46, 47.52, 48.53, 49.59, 50.54, 51.38, 52.17, 52.96, 53.79, 54.34, 54.87,
    55.32, 55.82, 56.3, 56.86, 57.57, 58.31, 59.12, 59.99, 60.78, 61.63, 62.3, 62.97, 63.47, 63.83,
    64.09, 64.3, 64.47, 64.57, 64.69, 64.85, 65.15, 65.46, 65.78, 66.07, 66.3246, 66.603, 66.9069,
    67.281, 67.6439, 68.1024, 68.5927, 68.9676, 69.2202,
];

/**
 * @provenance Observed ΔT = TT − UT1 (seconds) at 1 January 0h, 2020–2026.
 * U.S. Naval Observatory, Earth Orientation Department, "deltat.data"
 * (monthly observed ΔT from IERS Bulletin B), https://maia.usno.navy.mil/ser7/deltat.data,
 * 1 January rows, as retrieved 2026-10-26 (last row in the file: 2026-10-01).
 *
 * Only the 'modern' precision profile reads these rows. The 'jhora' profile
 * keeps the 2019 end of the record, because that is what Swiss Ephemeris
 * 2.02.01 (bundled with JHora) does.
 */
export const OBSERVED_DELTAT_JAN1_MODERN_EXT: readonly number[] = [
    69.3612, 69.3594, 69.2945, 69.2039, 69.1752, 69.1377, 69.1099,
];
