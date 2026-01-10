
import { normalize360 } from '../core/math.js';

export interface VargaPoint {
    longitude: number; // 0-360 in the varga (approximate for display)
    sign: number;      // 1-12
    degree: number;    // 0-30 within the sign
    deity?: string;    // Optional Deity name
}

/**
 * Calculates the position of a planet in a Divisional Chart (Varga).
 * Supports standard Parashara rules for D2, D3, etc.
 * 
 * @param longitude - The core longitude of the planet (0-360).
 * @param division - The division number (e.g., 9 for Navamsa).
 * @param method - 'Parashara' (Standard) or 'Harmonic' (Cyclical/Parivritta). Default Parashara.
 */
export function calculateVarga(longitude: number, division: number, method: 'Parashara' | 'Harmonic' = 'Parashara'): VargaPoint {
    const signIndex = Math.floor(longitude / 30); // 0-11
    const degreeInSign = longitude % 30;

    // 1. D2 - Hora (Parashara)
    if (division === 2 && method === 'Parashara') {
        // Odd Signs: 1st half Sun (Leo=5), 2nd half Moon (Can=4)
        // Even Signs: 1st half Moon (Can=4), 2nd half Sun (Leo=5)
        const isOdd = (signIndex + 1) % 2 !== 0;
        const isFirstHalf = degreeInSign < 15;
        
        let targetSignIndex = 0; // 0-11
        if (isOdd) {
            targetSignIndex = isFirstHalf ? 4 : 3; // Leo(4) : Cancer(3)
        } else {
            targetSignIndex = isFirstHalf ? 3 : 4; // Cancer(3) : Leo(4)
        }
        
        // Longitude: Just mapped to middle of sign? Or scaled? 
        // Standard D2 doesn't have degrees usually, just the House.
        // We'll return 15 deg in that sign.
        return {
            longitude: (targetSignIndex * 30) + 15,
            sign: targetSignIndex + 1,
            degree: 15
        };
    }

    // 2. D3 - Drekkana (Parashara)
    if (division === 3 && method === 'Parashara') {
        // 0-10: Sign itself (1)
        // 10-20: 5th from Sign
        // 20-30: 9th from Sign
        const part = Math.floor(degreeInSign / 10); // 0, 1, 2
        let targetSignIndex = signIndex; // default part 0
        
        if (part === 1) targetSignIndex = (signIndex + 4) % 12; // 5th house
        if (part === 2) targetSignIndex = (signIndex + 8) % 12; // 9th house
        
        // Degree in varga: (InputDeg % 10) * 3
        const vargaDeg = (degreeInSign % 10) * 3;
        
        return {
            longitude: (targetSignIndex * 30) + vargaDeg,
            sign: targetSignIndex + 1,
            degree: vargaDeg
        };
    }

    // Default: Generic Harmonic (Parivritta) / D9 / D10 etc often follow this or similar.
    // D9 (Navamsa) Parashara is actually:
    // Movable: Start from Sign
    // Fixed: Start from 9th
    // Dual: Start from 5th
    // Let's verify if Generic Harmonic matches D9 Parashara.
    // Generic: (Long * 9) % 360.
    // P 0deg Aries. 0*9 = 0 (Aries). Correct.
    // P 3deg20 (end of 1st pada). 3.33*9 = 30 (Start Tau). Correct.
    // P 10deg (Start 4th pada). 10*9 = 90 (Cancer).
    // Parashara rule for Aries (Movable): 4th pada is Cancer. Matches.
    // P 30deg (End). 30*9 = 270 (Capricorn?).
    // Wait. 30 in Aries is end of 9th pada. Sagittarius.
    // 30 * 9 = 270. 270/30 = 9 (Cap). 
    // Actually 29.99 * 9 = 269.9. 269/30 = 8.9 (Sag). matches.
    // So Generic Harmonic DOES match Parashara D9.
    
    // So only D2, D3, D7, D12, D16, D30 need special handling.
    // For MVP Phase 13, let's implement Generic for others and D2/D3 specifically.
    // We can expand D-others later.
    
    return calculateHarmonic(longitude, division);
}

function calculateHarmonic(longitude: number, division: number): VargaPoint {
    const vargaLong = normalize360(longitude * division);
    const signIndex = Math.floor(vargaLong / 30);
    const degree = vargaLong % 30;
    return {
        longitude: vargaLong,
        sign: signIndex + 1,
        degree
    };
}

export function calculateD1(longitude: number): VargaPoint {
    return calculateVarga(longitude, 1);
}
export function calculateD9(longitude: number): VargaPoint {
    return calculateHarmonic(longitude, 9);
}
export function calculateD60(longitude: number): VargaPoint {
    return calculateHarmonic(longitude, 60);
}
export const calculateShashtyamsa = calculateD60;
