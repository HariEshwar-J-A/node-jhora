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
 * Evaluate the derivative of a Chebyshev series with respect to τ.
 *
 * Uses the recurrence for Chebyshev derivative series:
 *   T'₀ = 0, T'₁ = 1, T'ₙ = 2Tₙ₋₁ + T'ₙ₋₂   (for n ≥ 2)
 * Equivalently: d[Σ aₙ Tₙ(τ)]/dτ = Σ aₙ T'ₙ(τ)
 *
 * Returns dF/dτ.  To convert to physical velocity:
 *   vel [km/s] = dF/dτ × (2 / INTLEN)   where INTLEN is in seconds.
 */
export function evalChebyDeriv(coeffs: readonly number[], tau: number): number {
    const n = coeffs.length;
    if (n <= 1) return 0;

    // Build derivative coefficients using the standard recurrence
    // d'[k] = 2k * coeffs[k] + d'[k-2]  working backwards
    // Then evaluate with evalCheby-like recurrence
    let b2 = 0.0;
    let b1 = 0.0;

    for (let i = n - 1; i >= 1; i--) {
        const b0 = 2.0 * tau * b1 - b2 + 2.0 * i * coeffs[i];
        b2 = b1;
        b1 = b0;
    }

    // The 0.5 factor comes from the derivative of T₀ through the recurrence
    return 0.5 * (tau * b1 - b2 + coeffs[1]);
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
