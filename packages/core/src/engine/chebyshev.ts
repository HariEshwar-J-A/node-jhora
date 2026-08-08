/**
 * chebyshev.ts
 *
 * Chebyshev polynomial evaluation using the Clenshaw recurrence.
 * Used to evaluate SPK Type 2 ephemeris records.
 *
 * All positions are in km (barycentric J2000 equatorial rectangular).
 * Velocities are in km/s.
 */

// ---------------------------------------------------------------------------
// Position evaluation — Σ aₙ Tₙ(τ) via Clenshaw recurrence
// ---------------------------------------------------------------------------

/**
 * Evaluate a Chebyshev series at normalised argument τ ∈ [-1, +1].
 *
 * Uses the Clenshaw recurrence (numerically stable, O(n)):
 *   b_{n+1} = 0
 *   b_k     = 2τ·b_{k+1} − b_{k+2} + aₖ
 *   result  = τ·b₁ − b₂ + a₀
 */
export function evalCheby(coeffs: readonly number[], tau: number): number {
    const n = coeffs.length;
    if (n === 0) return 0;
    if (n === 1) return coeffs[0];

    let b2 = 0.0;
    let b1 = 0.0;

    for (let i = n - 1; i >= 1; i--) {
        const b0 = 2.0 * tau * b1 - b2 + coeffs[i];
        b2 = b1;
        b1 = b0;
    }

    return tau * b1 - b2 + coeffs[0];
}

// ---------------------------------------------------------------------------
// Velocity evaluation — d/dτ [ Σ aₙ Tₙ(τ) ] via derivative recurrence
// ---------------------------------------------------------------------------

/**
 * Evaluate the derivative dF/dτ of a Chebyshev series.
 *
 * Uses the paired forward recurrences for the polynomials and their derivatives:
 *   T₀ = 1,  T₁ = τ,   Tₖ  = 2τ·Tₖ₋₁ − Tₖ₋₂
 *   T′₀ = 0, T′₁ = 1,  T′ₖ = 2·Tₖ₋₁ + 2τ·T′ₖ₋₁ − T′ₖ₋₂
 *
 * The previous implementation folded a `2k` weight into a Clenshaw-style loop
 * and closed with an unjustified factor of ½. It returned roughly 0.35× the
 * true derivative — Earth's barycentric speed came out as 10.7 km/s instead of
 * 30.2 km/s — which corrupted stellar aberration and every planet's daily
 * motion (and therefore retrograde detection).
 *
 * Records hold ~10–15 coefficients, so the explicit recurrence costs nothing
 * measurable and is far easier to verify than a folded form.
 *
 * To convert to physical velocity: vel = dF/dτ ÷ RADIUS, with RADIUS in seconds.
 */
export function evalChebyDeriv(coeffs: readonly number[], tau: number): number {
    const n = coeffs.length;
    if (n <= 1) return 0;

    let tPrev = 1.0;      // T₀
    let tCurr = tau;      // T₁
    let dPrev = 0.0;      // T′₀
    let dCurr = 1.0;      // T′₁

    let sum = coeffs[1] * dCurr;   // k = 0 contributes nothing (T′₀ = 0)

    for (let k = 2; k < n; k++) {
        const tNext = 2.0 * tau * tCurr - tPrev;
        const dNext = 2.0 * tCurr + 2.0 * tau * dCurr - dPrev;

        sum += coeffs[k] * dNext;

        tPrev = tCurr; tCurr = tNext;
        dPrev = dCurr; dCurr = dNext;
    }

    return sum;
}

// ---------------------------------------------------------------------------
// Convenience: evaluate all 3 components of an SPK Type 2 record
// ---------------------------------------------------------------------------

export interface Vec3 {
    /** km */
    x: number;
    /** km */
    y: number;
    /** km */
    z: number;
    /** km/s */
    vx: number;
    /** km/s */
    vy: number;
    /** km/s */
    vz: number;
}

/**
 * Evaluate an SPK Type 2 coefficient record at ephemeris time `et`.
 *
 * @param record   Flat array of doubles from the SPK data:
 *                 [MID, RADIUS, x₀…xₙ, y₀…yₙ, z₀…zₙ]
 * @param et       Ephemeris time (seconds from J2000.0 TDB)
 */
export function evalRecord(record: Float64Array | number[], et: number): Vec3 {
    const mid    = record[0];   // midpoint of interval (s from J2000)
    const radius = record[1];   // half-interval (s)
    const tau    = (et - mid) / radius;   // ∈ [-1, +1]

    const nCoeff = (record.length - 2) / 3;

    // Slice coefficient arrays (offset 2 = skip MID and RADIUS)
    const xC = Array.from({ length: nCoeff }, (_, i) => record[2 + i]);
    const yC = Array.from({ length: nCoeff }, (_, i) => record[2 + nCoeff + i]);
    const zC = Array.from({ length: nCoeff }, (_, i) => record[2 + 2 * nCoeff + i]);

    // Position (km)
    const x = evalCheby(xC, tau);
    const y = evalCheby(yC, tau);
    const z = evalCheby(zC, tau);

    // Velocity (km/s) — dF/dτ × dτ/dt = dF/dτ / radius
    const vx = evalChebyDeriv(xC, tau) / radius;
    const vy = evalChebyDeriv(yC, tau) / radius;
    const vz = evalChebyDeriv(zC, tau) / radius;

    return { x, y, z, vx, vy, vz };
}
