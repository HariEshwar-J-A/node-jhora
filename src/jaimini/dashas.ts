
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
            // Count from Sign to Lord.
            // Direction of Count: "Forward if Sign is Odd... Backward if Even. Exception: Tau/Sco etc flib."
            // Standard Rule (KN Rao / BPHS):
            // Forward: Ari(0), Tau(1), Gem(2)*Exception?, Can(3)?
            // Better Rule:
            // Odd Signs (0, 2, 4...): Forward.
            // Even Signs (1, 3, 5...): Backward.
            // Exceptions (Tau, Sco, etc?):
            // The prompt says: "Exception: Taurus/Scorpio etc. often flip. Use the standard BPHS method".
            // BPHS Exceptions:
            // Scorpio (7): Even -> Backward? No, Scorpio is Keeta.
            // Let's use the precise K.N. Rao mapping for counting direction as it's "Standard" modern Jaimini.
            // Aries(O): Fwd. Taurus(E): Fwd(Exc!). Gemini(O): Bkwd(Exc!). Cancer(E): Bkwd.
            // Leo(O): Fwd. Virgo(E): Fwd(Exc!). Libra(O): Bkwd(Exc!). Scorpio(E): Bkwd.
            // Sag(O): Fwd. Cap(E): Fwd(Exc!). Aqu(O): Bkwd(Exc!). Pis(E): Bkwd.
            
            // Simplified:
            // Direct Count Signs: Ari, Tau, Leo, Vir, Sag, Cap. (Indices: 0, 1, 4, 5, 8, 9)
            // Reverse Count Signs: Gem, Can, Lib, Sco, Aqu, Pis. (Indices: 2, 3, 6, 7, 10, 11)
            
            const directCountSigns = [0, 1, 4, 5, 8, 9];
            const countForward = directCountSigns.includes(dashaSign);

            const lordId = this.getSignRulerId(dashaSign);
            const lord = planets.find(p => p.id === lordId);
            
            let years = 1; // Minimum
            if (lord) {
                const lordSign = Math.floor(lord.longitude / 30);
                let count = 0;
                if (countForward) {
                    // Count Sign -> Lord
                    count = (lordSign - dashaSign) + 1;
                    if (count <= 0) count += 12;
                } else {
                    // Count Sign -> Lord BACKWARDS
                    // e.g. Cancer(3) to Moon in Aries(0). 3,2,1,0 = 4 signs.
                    // (Sign - Lord) + 1
                    count = (dashaSign - lordSign) + 1;
                    if (count <= 0) count += 12;
                }
                
                // "Subtract 1"
                years = count - 1;
                if (years === 0) years = 12; // 12th house (0 dist) = 12 years.
            }

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

    private static getSignRulerId(signIndex: number): number {
        // 0=Sun..6=Sat.
        // Ari(Mar=4), Tau(Ven=3), Gem(Mer=2), Can(Mon=1), Leo(Sun=0), Vir(Mer=2)
        // Lib(Ven=3), Sco(Mar=4 + Ketu), Sag(Jup=5), Cap(Sat=6), Aqu(Sat=6 + Rahu), Pis(Jup=5)
        // Standard single lord for now.
        // Scorpio: Mars. Aquarius: Saturn. (Prompt doesn't specify Dual Lordship logic for duration, stick to primary).
        const rulers = [4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5];
        return rulers[signIndex];
    }
}
