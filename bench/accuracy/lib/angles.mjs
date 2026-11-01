/** @typedef {{ lon: number; lat: number }} Ecliptic */

/**
 * @param {number} deg
 * @returns {number}
 */
export function wrap360(deg) {
    return ((deg % 360) + 360) % 360;
}

/**
 * Signed shortest arc in degrees.
 * @param {number} a
 * @param {number} b
 */
export function signedDeltaDeg(a, b) {
    return ((a - b + 540) % 360) - 180;
}

/**
 * @param {number} a arcsec
 * @param {number} b arcsec
 */
export function signedDeltaArcsec(a, b) {
    return signedDeltaDeg(a / 3600, b / 3600) * 3600;
}

/**
 * @param {readonly number[]} residualsArcsec
 */
export function summarizeResiduals(residualsArcsec) {
    if (residualsArcsec.length === 0) {
        return { n: 0, max: null, rms: null, p99: null };
    }
    const abs = residualsArcsec.map((r) => Math.abs(r));
    abs.sort((x, y) => x - y);
    const n = abs.length;
    const max = abs[n - 1];
    const rms = Math.sqrt(abs.reduce((s, v) => s + v * v, 0) / n);
    const p99Idx = Math.min(n - 1, Math.ceil(0.99 * n) - 1);
    const p99 = abs[p99Idx];
    return { n, max, rms, p99 };
}

/**
 * @param {Ecliptic} truth
 * @param {Ecliptic} sample
 */
export function lonLatResidualArcsec(truth, sample) {
    const dLon = signedDeltaDeg(sample.lon, truth.lon) * 3600;
    const dLat = (sample.lat - truth.lat) * 3600;
    return { dLon, dLat, combined: Math.hypot(dLon, dLat) };
}
