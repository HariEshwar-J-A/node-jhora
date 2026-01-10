
import { PlanetPosition } from '../engine/ephemeris.js';
import { normalize360 } from '../core/math.js';
import { DashaPeriod } from './dasha.js';
import { DateTime } from 'luxon';

// Yogini Dasha Cycle
// 8 Yoginis
const YOGINIS = [
    { name: 'Mangala', years: 1, lord: 'Moon' },
    { name: 'Pingala', years: 2, lord: 'Sun' },
    { name: 'Dhanya', years: 3, lord: 'Jupiter' },
    { name: 'Bhramari', years: 4, lord: 'Mars' },
    { name: 'Bhadrika', years: 5, lord: 'Mercury' },
    { name: 'Ulka', years: 6, lord: 'Saturn' },
    { name: 'Siddha', years: 7, lord: 'Venus' },
    { name: 'Sankata', years: 8, lord: 'Rahu' } // Ketu shares?
];
// Total: 1+2+3+4+5+6+7+8 = 36 Years.

export class YoginiDasha {

    /**
     * Calculates Yogini Dasha periods.
     * @param moonLongitude Moon's Longitude
     * @param birthDate Birth Date
     * @param durationYears Total years to calculate (default 50)
     */
    public static calculate(moonLongitude: number, birthDate: DateTime, durationYears: number = 50): DashaPeriod[] {
        const nakshatraSpan = 13 + (1/3);
        const nakshatraIndex = Math.floor(moonLongitude / nakshatraSpan); // 0-26
        const lonInNak = moonLongitude % nakshatraSpan;

        // Start Yogini Index: (Nakshatra + 3) % 8
        // Note: Some traditions use different seed. BPHS/Standard uses standard offset.
        // There are 27 Nakshatras. 27 is not multiple of 8.
        // Ashwini(0) + 3 = 3 (Bhramari).
        // Let's verify standard: Ashwini starts with Bhramari? Or Mangala starts at Ashwini?
        // Standard Dictum: "Add 3 to Nakshatra number... divide by 8... remainder".
        // Remainder 1 = Mangala.
        // Index 0 (Ashwini) -> (0+1) is Nakshatra Number 1? Or 0-based?
        // Let's assume Nakshatra Number 1-27.
        // (1 + 3) = 4. 4 % 8 = 4 --> Bhramari (if 1=Mangala, 2=Pingala, 3=Dhanya, 4=Bhramari).
        // Yes. So Formula: (NakIndexZeroBased + 1 + 3) % 8.
        // If remainder 0? Means 8 (Sankata).
        
        let seed = (nakshatraIndex + 1 + 3) % 8;
        if (seed === 0) seed = 8;
        
        // Map 1-8 to 0-7 array index
        let yoginiIndex = seed - 1;

        // Balance Calculation
        // Proportion of Nakshatra remaining
        const elapsed = lonInNak / nakshatraSpan;
        const remaining = 1 - elapsed;
        
        const startYogini = YOGINIS[yoginiIndex];
        const balanceYears = startYogini.years * remaining;

        const periods: DashaPeriod[] = [];
        let currentStart = birthDate;
        let runningDate = birthDate.plus({ years: balanceYears }); // End of first period
        
        // Add First Period (Partial)
        periods.push({
            planet: startYogini.name, // Using Name instead of Planet
            lord: startYogini.lord,
            start: currentStart.toISO()!,
            end: runningDate.toISO()!,
            duration: balanceYears,
            subPeriods: []
        });

        // Continue generating
        let currentYear = balanceYears;
        let idx = (yoginiIndex + 1) % 8;

        while (currentYear < durationYears) {
            const yogini = YOGINIS[idx];
            const start = runningDate;
            const end = runningDate.plus({ years: yogini.years });
            
            periods.push({
                planet: yogini.name,
                lord: yogini.lord,
                start: start.toISO()!,
                end: end.toISO()!,
                duration: yogini.years,
                subPeriods: []
            });
            
            runningDate = end;
            currentYear += yogini.years;
            idx = (idx + 1) % 8;
        }

        return periods;
    }
}
