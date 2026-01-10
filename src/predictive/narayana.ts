
import { JaiminiDashas, CharaDashaPeriod } from '../jaimini/dashas.js';
import { ChartData } from '../yogas/engine.js';
import { DateTime } from 'luxon';

/**
 * Narayana Dasha (General/Rasi Dasha).
 * Specific variant of Chara Dasha used for general prediction.
 * 
 * Rules (Simplified for MVP):
 * 1. Start Sign: Lagna (Ascendant).
 *    (Real Narayana Dasha compares Lagna vs 7th, but prompt implies simpler flow).
 * 2. Direction: 
 *    - Movable (1,4,7,10): Forward
 *    - Fixed (2,5,8,11): Reverse (exception? No, Narayana usually follows Chara logic).
 *    - Dual (3,6,9,12): ?
 *    
 *    Wait, User Prompt says: "Signs run in zodiacal order (Aries...) or reverse (Pisces...) based on Odd/Even nature of Lagna."
 *    This contradicts standard Chara Dasha (which jumps 1, 6, 11...).
 *    Padakrama (Step) vs Rasi Krama (Zodiacal).
 *    Narayana Dasha is RASI KRAMA (mostly).
 *    
 *    Rule:
 *    - If Lagna is ODD (1,3,5...): Forward (1, 2, 3...)
 *    - If Lagna is EVEN (2,4,6...): Reverse (1, 12, 11...)
 *    - Exceptions: Sat/Ketu in Lagna reverses this? (Prompt mentions check exceptions).
 *    - Let's implement this Odd/Forward, Even/Reverse logic.
 * 
 * 3. Duration: Same as Chara Dasha (Sign to Lord counting).
 */
export class NarayanaDasha {

    public static calculate(
        chart: ChartData, 
        birthDate: DateTime, 
        years: number = 80
    ): CharaDashaPeriod[] {
        const ascSign = chart.houses.ascendant.sign; // 1-12
        const ascObj = chart.planets.find(p => p.id === 99) || { longitude: 0 }; // fallback
        
        // 1. Determine Direction
        // Default: Odd Lagna -> Forward. Even Lagna -> Reverse.
        let isForward = (ascSign % 2 !== 0);

        // Exception: Saturn or Ketu in Lagna?
        // Let's implement basic rule first. User said "Check exceptions for Sat/Ketu".
        // If Sat or Ketu is IN the Lagna sign, reverse the order.
        const saturn = chart.planets.find(p => p.id === 6); // Sat
        const ketu = chart.planets.find(p => p.id === 8);   // Ketu
        
        const saturnInLagna = saturn && Math.floor(saturn.longitude/30)+1 === ascSign;
        const ketuInLagna = ketu && Math.floor(ketu.longitude/30)+1 === ascSign;
        
        if (saturnInLagna || ketuInLagna) {
            isForward = !isForward;
        }

        const periods: CharaDashaPeriod[] = [];
        let runningDate = birthDate;
        let currentSign = ascSign;

        for (let i = 0; i < 12 * 2; i++) { // Generate for 2 cycles implies ~100+ years
            // Calculate Duration for Current Sign
            const duration = JaiminiDashas.calculateSignDuration(currentSign, chart.planets);
            
            periods.push({
                signIndex: currentSign,
                start: runningDate.toISO()!,
                end: runningDate.plus({ years: duration }).toISO()!,
                durationYears: duration,
                isForward // Direction of calculating duration or sequence? 
                          // Chara Duration has its own internal logic (Sign to Lord forward/back).
                          // This flag is for the SEQUENCE.
            });
            
            runningDate = runningDate.plus({ years: duration });
            
            // Move to next sign
            if (isForward) {
                currentSign++;
                if (currentSign > 12) currentSign = 1;
            } else {
                currentSign--;
                if (currentSign < 1) currentSign = 12;
            }
            
            if (runningDate.diff(birthDate, 'years').years >= years) break;
        }

        return periods;
    }
}
