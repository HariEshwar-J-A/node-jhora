/**
 * IERS Conventions (2010), Technical Note 36, Table 5.2e.
 *
 * Non-polynomial Fourier development of the equation of the origins EO(t)
 * (complementary terms). Amplitudes are in microarcseconds; each term is
 * amplitudeSin·sin(Σ N_j F_j) + amplitudeCos·cos(Σ N_j F_j) with integer
 * multipliers N_j on the fundamental arguments F_1…F_14 from eq. (5.43)–(5.44).
 *
 * Source: IERS TN36 Chapter 5, Table 5.2e (electronic table tab5.2e at
 * https://iers-conventions.obspm.fr/chapter5/chapter5.html).
 */

/** Fundamental-argument index: F1…F14 (l, l′, F, D, Ω, planetary means, p_A). */
export const IERS_FUNDAMENTAL_ARGUMENT_COUNT = 14;

export type IersFundamentalMultipliers = readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
];

/** Single row of IERS TN36 Table 5.2e. */
export interface IersEoComplementaryTerm {
    amplitudeSinMicroarcsec: number;
    amplitudeCosMicroarcsec: number;
    multipliers: IersFundamentalMultipliers;
}

/** All Table 5.2e terms exceeding 0.5 µas (1975–2025); 33 rows in publication order. */
export const IERS_TN36_TABLE_5_2E: readonly IersEoComplementaryTerm[] = [
    {
        amplitudeSinMicroarcsec: 2640.96,
        amplitudeCosMicroarcsec: -0.39,
        multipliers: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 63.52,
        amplitudeCosMicroarcsec: -0.02,
        multipliers: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 11.75,
        amplitudeCosMicroarcsec: 0.01,
        multipliers: [0, 0, 2, -2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 11.21,
        amplitudeCosMicroarcsec: 0.01,
        multipliers: [0, 0, 2, -2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -4.55,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 2, -2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 2.02,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 1.98,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -1.72,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -1.41,
        amplitudeCosMicroarcsec: -0.01,
        multipliers: [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -1.26,
        amplitudeCosMicroarcsec: -0.01,
        multipliers: [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.63,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.63,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.46,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 1, 2, -2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.45,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 1, 2, -2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.36,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 4, -4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.24,
        amplitudeCosMicroarcsec: -0.12,
        multipliers: [0, 0, 1, -1, 1, 0, -8, 12, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.32,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.28,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.27,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.26,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.21,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 2, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.19,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 1, -2, 2, -3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.18,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 1, -2, 2, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.1,
        amplitudeCosMicroarcsec: 0.05,
        multipliers: [0, 0, 0, 0, 0, 0, 8, -13, 0, 0, 0, 0, 0, -1],
    },
    {
        amplitudeSinMicroarcsec: 0.15,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.14,
        amplitudeCosMicroarcsec: 0,
        multipliers: [2, 0, -2, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.14,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, 0, -2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.14,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 1, 2, -2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.14,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, 0, -2, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.13,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 4, -2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: -0.11,
        amplitudeCosMicroarcsec: 0,
        multipliers: [0, 0, 2, -2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.11,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, -2, 0, -3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
        amplitudeSinMicroarcsec: 0.11,
        amplitudeCosMicroarcsec: 0,
        multipliers: [1, 0, -2, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
];
