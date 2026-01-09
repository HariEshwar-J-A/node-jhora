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

    // 1. Get Julian Day
    const dateUtc = date.toUTC();
    const jd = engine['module'].julday(dateUtc.year, dateUtc.month, dateUtc.day, dateUtc.hour + dateUtc.minute / 60 + dateUtc.second / 3600, 1);

    // 2. Get Sidereal Time (Greenwich)
    const gmst = engine.getSiderealTime(jd);

    // 3. Calculate RAMC (Right Ascension of Meridian)
    // RAMC = GMST + Longitude (in hours? No, GMST is hours usually. Lon is degrees).
    // SwissEph sidtime returns Hours.
    // Lon needs to be converted to Hours (deg / 15).
    // Result RAMC in Degrees usually needed for formulas.
    // Let's convert GMST to Degrees ( * 15).
    const gmstDeg = gmst * 15;
    const ramc = normalize360(gmstDeg + lon);

    // 4. Get Obliquity (Epsilon)
    // Use True Obliquity (eps + deps)
    const oblData = engine.getEclipticObliquity(jd);
    const eps = oblData.eps + oblData.deps;

    // 5. Calculate MC (Medium Coeli)
    // tan(MC) = tan(RAMC) / cos(eps)
    // MC is in same quadrant as RAMC? No, finding atan2.
    // atan2(y, x) -> y = tan(RAMC), x = cos(eps) ?? No.
    // Formula: tan(alpha) = tan(lambda) * cos(eps) -> this is Eq to Ecl conversion.
    // MC is the intersection of Meridian and Ecliptic.
    // Formula: tan(MC) = tan(RAMC) / cos(eps)
    // With atan2: atan2(sin(RAMC), cos(RAMC) * cos(eps)) ?
    // Let's use strict vector conversion or standard formula.
    // tan(MC) = tan(RAMC) / cos(eps)
    // correct quadrant check usually needed.
    // Using atan2:
    // x = cos(RAMC) * cos(eps) -- Denom?
    // y = sin(RAMC) -- Num (scaled)?
    // From Moshier/standard:
    // tan(MC) = tan(RAMC)/cos(eps)
    // If we use atan2(sin(RAMC), cos(RAMC)*cos(eps)), we preserve quadrant.
    // Let's verify.
    // At RAMC=0 (Aries), MC=0. sin(0)=0. y=0. x=1*cos. atan2(0,1)=0. Correct.
    // At RAMC=90 (Cancer). sin(90)=1. x=0. atan2(1,0)=90. Correct.
    const ramcRad = ramc * DEG_TO_RAD;
    const epsRad = eps * DEG_TO_RAD;
    const mcRad = Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(epsRad));
    let mc = normalize360(mcRad * RAD_TO_DEG);

    // 6. Calculate Ascendant
    // Formula: tan(Asc) = - cos(RAMC) / (sin(eps)*tan(lat) + cos(eps)*sin(RAMC))
    // Or: Asc = accot( - (tan(lat)*sin(eps) + sin(RAMC)*cos(eps)) / cos(RAMC) )
    // Let's use atan2(y, x).
    // tan(Asc) = y / x
    // y = cos(RAMC)
    // x = - (sin(eps)*tan(lat) + cos(eps)*sin(RAMC))
    // Wait, numerator/denominator might be flipped in some refs.
    // Standard: tan(Asc) = cos(RAMC) / - (sin(eps)*tan(lat) + cos(eps)*sin(RAMC))
    // Let's call Num = cos(RAMC), Denom = -...
    // But check quadrants. Ascendant is Ecliptic crossing Eastern Horizon.
    // A robust formula:
    // Asc = atan2(cos(RAMC), -sin(RAMC)*cos(eps) - tan(lat)*sin(eps))
    // Let's verify.
    const latRad = lat * DEG_TO_RAD;
    const ascY = Math.cos(ramcRad);
    const ascX = -Math.sin(ramcRad) * Math.cos(epsRad) - Math.tan(latRad) * Math.sin(epsRad);
    let asc = normalize360(Math.atan2(ascY, ascX) * RAD_TO_DEG);

    // 7. Calculate Houses
    let cusps: number[] = [];

    if (method === 'WholeSign') {
        const signStart = Math.floor(asc / 30) * 30;
        for (let i = 0; i < 12; i++) {
            cusps.push(normalize360(signStart + i * 30));
        }
    } else if (method === 'Porphyry') {
        // Trisection of quadrants
        // MC to Asc (Houses 10, 11, 12)
        // Asc to IC (1, 2, 3)
        // IC to Dsc (4, 5, 6)
        // Dsc to MC (7, 8, 9)

        // Cusp 1 = Asc
        // Cusp 10 = MC
        // Cusp 4 = IC = (MC + 180)%360
        // Cusp 7 = Dsc = (Asc + 180)%360

        const c1 = asc;
        const c10 = mc;
        const c4 = normalize360(mc + 180);
        const c7 = normalize360(asc + 180);

        // Quadrant 1 (10-1): distance MC to Asc
        let q1 = normalize360(c1 - c10); // Arc from MC to Asc
        // Divide by 3
        let step1 = q1 / 3;
        const c11 = normalize360(c10 + step1);
        const c12 = normalize360(c10 + 2 * step1);

        // Quadrant 2 (1-4): distance Asc to IC
        let q2 = normalize360(c4 - c1);
        let step2 = q2 / 3;
        const c2 = normalize360(c1 + step2);
        const c3 = normalize360(c1 + 2 * step2);

        // Quadrant 3 (4-7): distance IC to Dsc
        let q3 = normalize360(c7 - c4);
        let step3 = q3 / 3;
        const c5 = normalize360(c4 + step3);
        const c6 = normalize360(c4 + 2 * step3);

        // Quadrant 4 (7-10): distance Dsc to MC
        let q4 = normalize360(c10 - c7);
        let step4 = q4 / 3;
        const c8 = normalize360(c7 + step4);
        const c9 = normalize360(c7 + 2 * step4);

        // Cusps are 0-indexed (1st House .. 12th House)
        cusps = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12];
    } else {
        // Placidus fallback to Porphyry with warning?
        // Implementing Placidus manually is complex (iterative).
        // For now, use Porphyry logic or Whole Sign.
        // Let's use Porphyry and warn?
        // Or throw.
        console.warn("Placidus not fully supported manually, falling back to Porphyry");
        return calculateHouseCusps(date, lat, lon, 'Porphyry');
    }

    return {
        system: method,
        cusps: cusps,
        ascendant: asc,
        mc: mc,
        armc: ramc
    };
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
