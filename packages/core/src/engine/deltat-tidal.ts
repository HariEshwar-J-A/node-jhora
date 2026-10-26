/**
 * Tidal-acceleration correction for ΔT (van Gent / Espenak & Meeus form).
 *
 * @provenance R. H. van Gent, "Delta T: Modern values",
 * https://webspace.science.uu.nl/~gent0113/deltat/deltat_modern.htm — for tabulated
 * ΔT on lunar tidal acceleration n′ = −26″/cy², adjust to another n′ with
 *   δ(ΔT) = −0.91072 (n′ + 26) u²  seconds,
 * u = (year − 1955.5) / 100.
 * Swiss Ephemeris general documentation, ch. 7 ΔT, gives the same rule for
 * moving Stephenson et al. (2016) values (n′ = −25.85″/cy²) to the ephemeris
 * n′ (DE431: −25.80″/cy²).
 */

/** DE431 lunar tidal acceleration, ″/cy² (Swiss Ephemeris default for .se1). */
export const TIDAL_ACCELERATION_DE431 = -25.8;

/** n′ underlying SMH2016 Table S15, ″/cy². */
export const TIDAL_ACCELERATION_SMH2016 = -25.85;

/** n′ underlying Astronomical Almanac K8–K9 tables, ″/cy². */
export const TIDAL_ACCELERATION_AA = -26;

const VAN_GENT_COEFF = 0.91072;
const VAN_GENT_EPOCH = 1955.5;

function vanGentCenturies(y: number): number {
    return (y - VAN_GENT_EPOCH) / 100;
}

/** Move ΔT from one n′ to another (seconds). */
export function tidalDeltaTSeconds(y: number, nFrom: number, nTo: number): number {
    const u = vanGentCenturies(y);
    return -VAN_GENT_COEFF * (nTo - nFrom) * u * u;
}

/** SMH2016 spline values → ephemeris n′. */
export function tidalSmh2016ToEphemeris(y: number): number {
    return tidalDeltaTSeconds(y, TIDAL_ACCELERATION_SMH2016, TIDAL_ACCELERATION_DE431);
}

/** AA observed table → ephemeris n′. */
export function tidalAaToEphemeris(y: number): number {
    return tidalDeltaTSeconds(y, TIDAL_ACCELERATION_AA, TIDAL_ACCELERATION_DE431);
}
