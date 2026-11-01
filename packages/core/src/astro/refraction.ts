// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Atmospheric refraction for horizon events.
 *
 * Bennett's marine-navigation formula gives refraction from the apparent
 * altitude (G. G. Bennett, Journal of Navigation 35, 255–259, 1982). The form
 * used here is Þ. Saemundsson's rearrangement for the true altitude
 * (Sky & Telescope 72, 70, 1986), with the pressure and temperature factors
 * from Meeus, Astronomical Algorithms, ch. 16:
 *
 *   R′ = 1.02 / tan(h + 10.3 / (h + 5.11)) × (P / 1010) × (283 / (273 + T))
 *
 * `h` and the result are in degrees; `R′` is computed in arcminutes. `P` is
 * in hPa and `T` in °C. Below −2° the formula is outside its range and the
 * lift is taken as zero.
 */

const DEG = Math.PI / 180;

/** Refraction lift in degrees for a true (geometric) altitude `altDeg`. */
export function refractionDegrees(
    altDeg: number,
    pressureHPa = 1013.25,
    temperatureC = 15,
): number {
    if (altDeg <= -2) return 0;
    const h = altDeg;
    const rArcmin =
        (1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG)) *
        (pressureHPa / 1010) *
        (283 / (273 + temperatureC));
    return rArcmin / 60;
}
