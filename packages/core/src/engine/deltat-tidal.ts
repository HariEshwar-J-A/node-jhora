/**
 * Tidal-acceleration correction for ΔT.
 *
 * @provenance
 * - JHora / AA era (Meeus): Explanatory Supplement (1992) p. 267; J. Meeus,
 *   Astronomical Algorithms (2nd ed.) ch. 10 — δ(ΔT) = −0.000091 (n_to − n_from)
 *   (y − 1955)² s, applied only for y < 1955.0.
 * - Modern / SMH2016 (van Gent): R. H. van Gent, "Delta T: Modern values",
 *   https://webspace.science.uu.nl/~gent0113/deltat/deltat_modern.htm — for tabulated
 *   ΔT on n′ = −26″/cy², adjust with δ(ΔT) = −0.91072 (n′ + 26) u² s,
 *   u = (year − 1955.5)/100 (Swiss Ephemeris manual ch. 7, SMH2016 n′ = −25.85).
 */

/** DE431 lunar tidal acceleration, ″/cy². */
export const TIDAL_ACCELERATION_DE431 = -25.8;

/** n′ underlying SMH2016 Table S15, ″/cy². */
export const TIDAL_ACCELERATION_SMH2016 = -25.85;

/** n′ underlying Astronomical Almanac K8–K9 tables, ″/cy². */
export const TIDAL_ACCELERATION_AA = -26;

const MEEUS_COEFF = 0.000091;
const MEEUS_EPOCH_YEAR = 1955;

const VAN_GENT_COEFF = 0.91072;
const VAN_GENT_EPOCH = 1955.5;

function vanGentCenturies(y: number): number {
    return (y - VAN_GENT_EPOCH) / 100;
}

/** Move ΔT from one n′ to another (van Gent / SE manual form). */
export function tidalDeltaTSeconds(y: number, nFrom: number, nTo: number): number {
    const u = vanGentCenturies(y);
    return -VAN_GENT_COEFF * (nTo - nFrom) * u * u;
}

/**
 * Meeus / Explanatory Supplement correction (seconds). Zero for y ≥ 1955.0.
 *
 * @param nFrom  n′ of the underlying ΔT values (AA: −26; SMH2016: −25.85).
 * @param nTo    ephemeris n′ (DE431: −25.8).
 */
export function tidalMeeusCorrection(
    y: number,
    nFrom: number,
    nTo: number = TIDAL_ACCELERATION_DE431,
): number {
    if (y >= MEEUS_EPOCH_YEAR) return 0;
    return -MEEUS_COEFF * (nTo - nFrom) * (y - MEEUS_EPOCH_YEAR) ** 2;
}

/** AA K8–K9 / polynomial era → ephemeris n′ (Meeus; jhora profile). */
export function tidalAaToEphemeris(y: number): number {
    return tidalMeeusCorrection(y, TIDAL_ACCELERATION_AA, TIDAL_ACCELERATION_DE431);
}

/** SMH2016 Table S15 → ephemeris n′ (van Gent; modern profile). */
export function tidalSmh2016ToEphemeris(y: number): number {
    return tidalDeltaTSeconds(y, TIDAL_ACCELERATION_SMH2016, TIDAL_ACCELERATION_DE431);
}
