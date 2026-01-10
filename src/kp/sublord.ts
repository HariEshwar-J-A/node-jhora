
import { normalize360 } from '../core/math.js';

export interface KPSignificator {
    longitude: number;
    signLord: number;
    starLord: number;
    subLord: number;
    subSubLord: number;
}

export class KPSubLord {
    
    // Lordship Mapping (0-8)
    // Ketu(8), Ven(3), Sun(0), Mon(1), Mar(4), Rah(7), Jup(5), Sat(6), Mer(2).
    // Vimshottari Order: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury.
    private static lordOrder = [8, 3, 0, 1, 4, 7, 5, 6, 2];
    
    // Dasha Years: Ke(7), Ve(20), Su(6), Mo(10), Ma(7), Ra(18), Ju(16), Sa(19), Me(17). Total 120.
    private static lordYears = [7, 20, 6, 10, 7, 18, 16, 19, 17];

    /**
     * Calculates KP Significators for a given longitude.
     * @param longitude 0-360
     */
    public static calculateKPSignificators(longitude: number): KPSignificator {
        const lon = normalize360(longitude);
        
        // 1. Sign Lord
        const signIndex = Math.floor(lon / 30);
        // Ar(4), Ta(3), Ge(2), Cn(1), Le(0), Vi(2), Li(3), Sc(4), Sg(5), Cp(6), Aq(6), Pi(5).
        // Standard Rulers: 
        // 0=Sun, 1=Mon, 2=Mer, 3=Ven, 4=Mar, 5=Jup, 6=Sat.
        const signRulers = [4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5];
        const signLord = signRulers[signIndex];

        // 2. Star Lord (Nakshatra)
        // 27 Nakshatras. 13 deg 20 min = 13.3333 deg.
        const nakshatraSpan = 13 + (1/3); // 13.3333...
        const nakshatraIndex = Math.floor(lon / nakshatraSpan); // 0-26
        // Lord of Nakshatra 0 (Ashwini) is Ketu. 
        // Cycle of 9 repeats 3 times.
        const starLordIndex = nakshatraIndex % 9;
        const starLord = this.lordOrder[starLordIndex];

        // 3. Sub Lord
        // Position within Nakshatra
        const lonInNak = lon % nakshatraSpan; // 0 to 13.333
        // Sub-Lord is determined by dividing Nakshatra span proportional to Dasha Years.
        // Start lord is the Star Lord itself.
        let subLord = -1;
        let subSubLord = -1;
        
        let remaining = lonInNak;
        let currentLordIdx = starLordIndex; // Starts from Star Lord

        // Iterate 9 subdivisions
        for (let i = 0; i < 9; i++) {
            const lordIdx = (currentLordIdx + i) % 9;
            const years = this.lordYears[lordIdx];
            // Proportion: (Years / 120) * 13.3333
            const subSpan = (years / 120) * nakshatraSpan;

            if (remaining < subSpan) {
                subLord = this.lordOrder[lordIdx];
                
                // 4. Sub-Sub Lord (Repeat logic one level deeper)
                // Position within Sub
                let sslRemaining = remaining;
                let sslLordIdx = lordIdx; // Starts from Sub Lord
                
                for (let j = 0; j < 9; j++) {
                    const subSubLordIdx = (sslLordIdx + j) % 9;
                    const subSubYears = this.lordYears[subSubLordIdx];
                    // Proportion: (Years / 120) * subSpan
                    const subSubSpan = (subSubYears / 120) * subSpan;
                    
                    if (sslRemaining < subSubSpan) {
                        subSubLord = this.lordOrder[subSubLordIdx];
                        break;
                    }
                    sslRemaining -= subSubSpan;
                }
                break;
            }
            remaining -= subSpan;
        }

        return {
            longitude: lon,
            signLord,
            starLord,
            subLord,
            subSubLord
        };
    }
}
