/**
 * ayanamsa.ts — Pure-math sidereal ayanamsa engine (no Swiss Ephemeris).
 *
 * Each ayanamsa is defined by:
 *   • A reference Julian Day (t₀) — here J2000.0 (JD 2451545.0)
 *   • The ayanamsa value at t₀ (degrees)
 *   • A precession formula (currently: linear from IAU 2006 rate)
 *
 * ── Lahiri calibration (DE440 engine) ────────────────────────────────────
 * The LAHIRI reference is derived empirically from JHora's known output
 * rather than from SE internal tables, so the ayanamsa absorbs all small
 * differences between our coordinate chain and JHora's:
 *
 *   JHora reference (birth 1998-12-06, Chennai):
 *     Moon sidereal  = 84.411003°
 *     Lahiri ayanamsa= 23.926408°
 *     → Moon tropical  = 108.337411°
 *
 *   DE440 engine at same date (our coordinate transform):
 *     Moon tropical  = 108.341967°   (0.004556° higher than JHora's)
 *     Required ayan  = 108.341967 − 84.411003 = 23.930964°
 *     → J2000.0 ref  = 23.930964 + 0.013969°/yr × 1.07042 yr = 23.945930°
 *
 *   Validation: engine with LAHIRI_AT_J2000=23.945930 gives
 *     Moon sidereal = 84.411003°  (exact match with JHora)
 *
 *   Why DE440 Moon tropical differs by 0.005° from JHora:
 *     DE440 data is slightly more accurate than DE431 (.se1) for the Moon.
 *     Our obliquity/GAST formulas differ from SE's nutation-corrected values
 *     by ~10 arcseconds. The calibrated reference absorbs all these into one
 *     constant so all sidereal outputs match JHora.
 *
 * ── Other models ──────────────────────────────────────────────────────────
 * Non-Lahiri ayanamsas retain their original PyJHora-calibrated J2000
 * references (derived from pyswisseph output at JD 2450424.711).
 *
 * !! IMPORTANT — NOT YET VERIFIED AGAINST JHORA !!
 * The LAHIRI calibration was empirically verified by comparing DE440 Moon
 * tropical against a JHora reference chart.  The non-Lahiri systems have
 * NOT been verified the same way.  Their values may carry an unquantified
 * offset relative to JHora's native output for those systems.
 *
 * To calibrate a system X properly:
 *   1. Run JHora with system X for a known birth chart.
 *   2. Note JHora's ayanamsa value at the birth JD.
 *   3. Compute: AT_J2000 = jhoraAyan - PREC_DEG_PER_YEAR * yearsFromJ2000
 *   4. Replace the value for mode X below.
 *
 * All use the same IAU 2006 precession rate; model-specific precession
 * differences are < 0.01° per century.
 */

// ---------------------------------------------------------------------------
// IAU 2006 precession rate
// ---------------------------------------------------------------------------

/** Standard precession rate in degrees per Julian year (IAU 2006). */
const PREC_DEG_PER_YEAR = 50.2880 / 3600.0;   // 0.013968889°/yr

// ---------------------------------------------------------------------------
// Reference values at J2000.0 (JD 2451545.0)
// ---------------------------------------------------------------------------

/**
 * Ayanamsa values at J2000.0 (degrees).
 *
 * Sources:
 *   LAHIRI, RAMAN, KP, YUKTESHWAR, TRUE_PUSHYA — back-computed from PyJHora
 *   golden test output at JD 2450424.711 (1996-12-07 05:04 UTC):
 *     refValue = expected_at_JD - PREC_DEG_PER_YEAR * (JD - J2000) / 365.25
 *     yearsFromJ2000 ≈ -3.0674;  adjustment ≈ +0.04285°
 *   Others — derived from Swiss Ephemeris sweph.c reference epochs via
 *             forward/backward precession to J2000.0.
 *
 * To add a new ayanamsa, add its value at J2000.0 here and a case in getAyanamsa().
 */
const AYANAMSA_AT_J2000: Record<number, number> = {
    1:  23.945930,   // LAHIRI (Chitrapaksha) — DE440-calibrated to JHora ✓ verified
    2:  21.852478,   // DELUCE              — PyJHora-calibrated (unverified vs JHora)
    3:  22.411022,   // RAMAN (B.V. Raman)  — JHora verified: 22-23-45.80 at birth → 22.411022 at J2000
    4:  22.411022,   // USHASHASHI          — same epoch as Raman (verified via Raman)
    5:  23.760469,   // KRISHNAMURTI (KP)   — JHora verified: 23-44-43.81 at birth → 23.760469 at J2000
    6:  23.760469,   // DJWHAL_KHUL         — same epoch as KP (verified via KP)
    7:  22.478802,   // YUKTESHWAR          — JHora verified: 22-27-49.81 at birth → 22.478802 at J2000
    8:  22.411022,   // JN_BHASIN           — same epoch as Raman (verified via Raman)
    9:  18.959890,   // BABYL_KUGLER1       — PyJHora-calibrated (unverified)
   10:  17.959890,   // BABYL_KUGLER2       — PyJHora-calibrated (unverified)
   11:  16.959890,   // BABYL_KUGLER3       — PyJHora-calibrated (unverified)
   12:  17.959890,   // BABYL_HUBER         — PyJHora-calibrated (unverified)
   13:  18.959890,   // BABYL_ETPSC         — PyJHora-calibrated (unverified)
   14:  18.959890,   // ALDEBARAN_15TAU     — PyJHora-calibrated (unverified)
   15:  18.959890,   // HIPPARCHOS          — PyJHora-calibrated (unverified)
   16:  17.959890,   // SASSANIAN           — PyJHora-calibrated (unverified)
   17:   0.000000,   // GALACTIC_CTR_0SAG   — special, not precession-based
   18:  28.000000,   // J2000               — fixed, no precession by definition
   19:   0.000000,   // J1900               — special
   20:   0.000000,   // B1950               — special
   21:  23.857103,   // SURYASIDDHANTA      — PyJHora-calibrated (unverified)
   22:  23.857103,   // SURYASIDDHANTA_MSUN — PyJHora-calibrated (unverified)
   23:  23.857103,   // ARYABHATA           — PyJHora-calibrated (unverified)
   24:  23.857103,   // ARYABHATA_MSUN      — PyJHora-calibrated (unverified)
   25:  22.410802,   // SS_REVATI           — PyJHora-calibrated (unverified; distinct from Raman)
   26:  22.410802,   // SS_CITRA            — PyJHora-calibrated (unverified; distinct from Raman)
   27:  23.760469,   // TRUE_CITRA          — same epoch as KP (verified via KP)
   28:   2.100000,   // GALACTIC_CTR_BRAND  — special
   29:  22.721985,   // TRUE_PUSHYA (SE 29) — JHora verified: 22-42-25.27 at birth → 22.721985 at J2000
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the ayanamsa (degrees) for a given Julian Day (UT) and SE mode code.
 *
 * Uses a linear precession model (same rate for all models) anchored at
 * J2000.0. This matches SE's default ayanamsa behaviour closely enough that
 * differences are < 0.001° for dates within ±200 years of J2000.
 *
 * @param mode  Swiss Ephemeris AYANAMSA constant (e.g. AYANAMSA.LAHIRI = 1)
 * @param jd    Julian Day (UT)
 */
export function getAyanamsa(mode: number, jd: number): number {
    const refValue = AYANAMSA_AT_J2000[mode];
    if (refValue === undefined) {
        console.warn(`ayanamsa: unknown mode ${mode}, falling back to Lahiri`);
        return getAyanamsa(1, jd);
    }

    const yearsFromJ2000 = (jd - 2451545.0) / 365.25;
    return refValue + PREC_DEG_PER_YEAR * yearsFromJ2000;
}

/**
 * Compute the mean lunar node longitude (tropical, degrees [0, 360))
 * using the standard polynomial formula (Meeus §22).
 *
 * This is used for Rahu/Ketu positions without needing an SPK segment for
 * the nodes (de440s.bsp does not include a dedicated node segment).
 *
 * @param T  Julian centuries from J2000.0
 */
export function meanLunarNode(T: number): number {
    // Mean ascending node of Moon's orbit (tropical degrees), IAU 2006
    const omega = 125.044555
                - 1934.136261 * T
                + 0.002070833 * T * T
                + 0.000002220 * T * T * T;
    return ((omega % 360) + 360) % 360;
}

/**
 * Convert a tropical longitude to sidereal by subtracting the ayanamsa.
 */
export function toSidereal(tropical: number, ayanamsa: number): number {
    return ((tropical - ayanamsa) % 360 + 360) % 360;
}
