
import { PlanetPosition } from '../engine/ephemeris.js';
import { normalize360 } from '../core/math.js';

export interface CharaDashaPeriod {
    signIndex: number; // 0-11
    startYear: number;
    endYear: number;
    durationYears: number;
}

export class JaiminiDashas {

    /**
     * Calculates Chara Dasha Sequence and Durations.
     * @param lagnaSignIndex 0-11
     * @param planets Planet positions (to find lords)
     */
    public static calculateCharaDasha(lagnaSignIndex: number, planets: PlanetPosition[]): CharaDashaPeriod[] {
        // 1. Determine Direction of Sequence (Based on 9th House from Lagna)
        // User Prompt: "Sequence: Determined by the 9th House from Lagna (Savya/Apasavya groups)."
        // Interpretation: Check 9th house sign. 
        // Savya Signs (Direct Group): Aries(0), Leo(4), Virgo(5), Libra(6), Aqua(10), Pis(11)?
        // Apasavya (Reverse): Tau(1), Gem(2), Can(3), Sco(7), Sag(8), Cap(9)?
        // Common Jaimini Grouping (K.N. Rao):
        // Group A (Direct): 0, 4, 5, 6, 10, 11 (Ari, Leo, Vir, Lib, Aqu, Pis)
        // Group B (Reverse): 1, 2, 3, 7, 8, 9 (Tau, Gem, Can, Sco, Sag, Cap)
        
        const ninthHouseSign = (lagnaSignIndex + 8) % 12;
        const groupA = [0, 4, 5, 6, 10, 11];
        const isForward = groupA.includes(ninthHouseSign);

        const periods: CharaDashaPeriod[] = [];
        let currentYear = 0; // Relative to birth

        for (let i = 0; i < 12; i++) {
            // Sequence logic
            let dashaSign: number;
            if (isForward) {
                // Regular Zodiacal order: Lagna, L+1, ...
                dashaSign = (lagnaSignIndex + i) % 12;
            } else {
                // Anti-Zodiacal: Lagna, L-1, ...
                dashaSign = (lagnaSignIndex - i);
                if (dashaSign < 0) dashaSign += 12;
            }

            // Duration Logic
            const years = this.calculateSignDuration(dashaSign, planets);

            periods.push({
                signIndex: dashaSign,
                startYear: currentYear,
                endYear: currentYear + years,
                durationYears: years
            });
            currentYear += years;
        }

        return periods;
    }

    /**
     * Calculates the duration of a Dasha for a specific Sign (Chara/Narayana).
     * Rule: Count from Sign to Lord (Direct/Reverse) - 1.
     * @param signIndex 0-11
     * @param planets Planet positions
     */
    public static calculateSignDuration(signIndex: number, planets: PlanetPosition[]): number {
        // Direct Count Signs: Ari, Tau, Leo, Vir, Sag, Cap. (Indices: 0, 1, 4, 5, 8, 9)
        const directCountSigns = [0, 1, 4, 5, 8, 9];
        const countForward = directCountSigns.includes(signIndex);

        const lordId = this.getSignRulerId(signIndex);
        const lord = planets.find(p => p.id === lordId);
        
        let years = 1; // Default fallback
        if (lord) {
            const lordSign = Math.floor(lord.longitude / 30);
            let count = 0;
            if (countForward) {
                // Count Sign -> Lord
                count = (lordSign - signIndex) + 1;
                if (count <= 0) count += 12;
            } else {
                // Count Sign -> Lord BACKWARDS
                count = (signIndex - lordSign) + 1;
                if (count <= 0) count += 12;
            }
            
            // "Subtract 1"
            years = count - 1;
            if (years === 0) years = 12; // 12th house (0 dist) = 12 years.
        }
        return years;
    }

    public static getSignRulerId(signIndex: number): number {
        // 0=Sun..6=Sat.
        // Ari(Mar=4), Tau(Ven=3), Gem(Mer=2), Can(Mon=1), Leo(Sun=0), Vir(Mer=2)
        // Lib(Ven=3), Sco(Mar=4 + Ketu), Sag(Jup=5), Cap(Sat=6), Aqu(Sat=6 + Rahu), Pis(Jup=5)
        const rulers = [4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5];
        return rulers[signIndex];
    }
}
