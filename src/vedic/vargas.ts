import { normalize360 } from '../core/math.js';

export interface VargaPoint {
    longitude: number; // 0-360 in the varga
    sign: number;      // 1-12
    degree: number;    // 0-30 within the sign
}

/**
 * Calculates the position of a planet in a Divisional Chart (Varga).
 * Formula: (Longitude * Division) % 360
 * 
 * @param longitude - The core longitude of the planet (0-360).
 * @param division - The division number (e.g., 9 for Navamsa).
 * @returns VargaPoint containing the mapped position.
 */
export function calculateVarga(longitude: number, division: number): VargaPoint {
    const vargaLong = normalize360(longitude * division);
    const signIndex = Math.floor(vargaLong / 30); // 0-11
    const degree = vargaLong % 30;

    return {
        longitude: vargaLong,
        sign: signIndex + 1, // 1-12 (Aries = 1)
        degree: degree
    };
}

// Helpers for common Vargas

/**
 * Calculates Rashi (D1) position.
 */
export function calculateD1(longitude: number): VargaPoint {
    return calculateVarga(longitude, 1);
}

/**
 * Calculates Navamsa (D9) position.
 * Key chart for strength and marriage/dharma.
 */
export function calculateD9(longitude: number): VargaPoint {
    return calculateVarga(longitude, 9);
}

/**
 * Calculates Dasamsa (D10) position.
 * Key chart for career/profession.
 */
export function calculateD10(longitude: number): VargaPoint {
    return calculateVarga(longitude, 10);
}

/**
 * Calculates Shashtyamsa (D60) position.
 * Key chart for past karma and fine distinctions.
 */
export function calculateD60(longitude: number): VargaPoint {
    return calculateVarga(longitude, 60);
}

// Alias for D60
export const calculateShashtyamsa = calculateD60;
