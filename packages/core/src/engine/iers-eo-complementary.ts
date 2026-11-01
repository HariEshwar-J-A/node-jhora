// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Complementary part of the equation of the origins (EO) for GMST/GAST.
 *
 * IERS Conventions (2010), TN36 Table 5.2e, summed with fundamental arguments
 * from eq. (5.43)–(5.44). Wallace & Capitaine (2006), A&A 459, 981 relate EO
 * to Greenwich apparent sidereal time.
 */

import { fundamentalArgumentsIers2010Radians } from './iers-fundamental-arguments.js';
import { IERS_FUNDAMENTAL_ARGUMENT_COUNT, IERS_TN36_TABLE_5_2E } from './iers-tn36-table-5-2e.js';

const MICROARCSEC_TO_DEGREES = 1 / (3600 * 1_000_000);

/**
 * Non-polynomial EO complementary sum from Table 5.2e, in degrees (unreduced).
 *
 * @param tCenturies TT Julian centuries since J2000.0
 */
export function equationOfOriginsComplementaryDegrees(tCenturies: number): number {
    const fundamentals = fundamentalArgumentsIers2010Radians(tCenturies);
    let sumMicroarcsec = 0;

    for (const term of IERS_TN36_TABLE_5_2E) {
        let argument = 0;
        for (let j = 0; j < IERS_FUNDAMENTAL_ARGUMENT_COUNT; j++) {
            argument += term.multipliers[j]! * fundamentals[j]!;
        }
        sumMicroarcsec +=
            term.amplitudeSinMicroarcsec * Math.sin(argument) +
            term.amplitudeCosMicroarcsec * Math.cos(argument);
    }

    return sumMicroarcsec * MICROARCSEC_TO_DEGREES;
}
