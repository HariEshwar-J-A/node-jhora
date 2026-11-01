/**
 * Lahiri ayanamsa (degrees) — ERFA precession from anchor (ADR 0015 / ADR 0024).
 * @param {number} jdUt
 * @param {number} deltaTSeconds
 */
export function lahiriAyanamsaDeg(jdUt, deltaTSeconds) {
    const jdTT = jdUt + deltaTSeconds / 86400;
    const t = (jdTT - 2451545) / 36525;
    const t0 = (2435553.5 - 2451545) / 36525;
    // General precession in longitude (IAU 2006) between anchor and date, radians.
    const pa = precessionLongitudeRad(t0, t);
    return 23.25 + (pa * 180) / Math.PI;
}

/** @param {number} t0 centuries @param {number} t centuries */
function precessionLongitudeRad(t0, t) {
    // Polynomial from IAU 2006 precession (Capitaine et al. 2003), Δψ_A in longitude.
    const dt = t - t0;
    const arcsec =
        (5029.0966 +
            1.1129948 * (t + t0) +
            0.00000677 * (t + t0) ** 2 -
            0.0000000236 * (t + t0) ** 3) *
        dt;
    return (arcsec / 3600) * (Math.PI / 180);
}
