import { EphemerisEngine, HouseData } from '../engine/ephemeris.js';
import { normalize360, dmsToDecimal } from '../core/math.js';
import { DateTime } from 'luxon';

export type HouseSystemMethod = 'WholeSign' | 'Placidus' | 'Porphyry';

export interface HouseResult {
    system: HouseSystemMethod;
    cusps: number[]; // 0-11 (1st house start ... 12th house start)
    ascendant: number;
    mc: number;
    vertex?: number;
    armc: number;
}

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Calculates House Cusps using manual trigonometric formulas for Ascendant/MC (First Principles),
 * passing dependency on broken `swe_houses`.
 */
export function calculateHouseCusps(date: DateTime, lat: number, lon: number, method: HouseSystemMethod = 'WholeSign', engineInstance?: EphemerisEngine): HouseResult {
    const engine = engineInstance || EphemerisEngine.getInstance();

    // 1. Get Julian Day via the engine's public API
    const jd = engine.julday(date);

    // If method is supported natively by SwissEph, try using it first.
    // 'Placidus' -> 'P'
    // 'Porphyry' -> 'O'
    // 'WholeSign' -> 'W' (Check if SE 'W' matches Vedic Whole Sign. SE 'W' is Equal Whole Sign, usually matches).
    
    let seMethod = '';
    switch (method) {
        case 'Placidus': seMethod = 'P'; break;
        case 'Porphyry': seMethod = 'O'; break;
        case 'WholeSign': seMethod = 'W'; break; // Verify SE behavior manually if specific offset needed?
        // Vedic Whole Sign is usually: Asc sign is House 1. 0-30 deg of that sign is H1? No, 0-30 of Sign.
        // SE 'W' (Whole Sign) returns cusps at 0, 30, 60... starting from Sign(Asc). 
        // This exactly matches Vedic Whole Sign.
        default: seMethod = 'P';
    }

    try {
        // Attempt Native SwissEph Calculation
        const seHouses = engine.getHouses(jd, lat, lon, seMethod);

        // For Whole Sign, snap cusps to sidereal sign boundaries starting from ascendant's sign.
        // swe_houses returns tropical cusps; after ayanamsa subtraction they no longer fall on
        // exact 30° boundaries. Vedic Whole Sign requires cusps at 0°, 30°, 60°… of the sidereal zodiac.
        let cusps = seHouses.cusps;
        if (method === 'WholeSign') {
            const signStart = Math.floor(seHouses.ascendant / 30) * 30;
            cusps = Array.from({ length: 12 }, (_, i) => (signStart + i * 30) % 360);
        }

        // Map to HouseResult
        return {
            system: method,
            cusps,
            ascendant: seHouses.ascendant,
            mc: seHouses.mc,
            vertex: seHouses.vertex,
            armc: seHouses.armc
        };
    } catch (e) {
        // Fallback to Manual Calculation if WASM `swe_houses` fails or not exposed properly
        // console.warn("Native House Calc failed, falling back to manual", e);
        
        if (method === 'Placidus') {
            throw new Error("Placidus system requires functioning WASM module.");
        }
        
        // Manual Logic (Existing Porphyry/WholeSign as fallback)
        // ... (Keep existing manual logic only if needed, or remove to rely on SE)
        // For robustness, let's keep logic for Porphyry/WholeSign manual if SE fails?
        // But the previous manual logic was minimal.
        // Let's rely on SE for Phase 10 as it's the "Superior" path.
        // If getting house cusps manually is needed, better to implement pure math.
        // But for now, just re-throw or handle.
        throw e;
    }
}

/**
 * Calculates Bhava Madhya (Middle of House) and Sandhi (Junction/Start/End).
 */
export function calculateBhavaSandhi(cusps: number[]): { start: number, middle: number, end: number }[] {
    const res = [];
    for (let i = 0; i < 12; i++) {
        const start = cusps[i];
        const next = cusps[(i + 1) % 12];

        let diff = normalize360(next - start);
        if (Math.abs(diff) < 1e-9) diff = 360;

        const middle = normalize360(start + diff / 2);
        const end = next;

        res.push({ start, middle, end });
    }
    return res;
}
