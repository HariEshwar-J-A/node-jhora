import { PlanetPosition, HouseData } from '@node-jhora/core';
import { DoshaResult } from '../types.js';

// Mars ID = 2.
// Houses: 1, 2, 4, 7, 8, 12.
// From: Lagna, Moon, Venus.
const DOSHA_HOUSES = [1, 2, 4, 7, 8, 12];

/**
 * Checks Mangal Dosha for a single chart.
 * Returns true if Dosha exists (without exceptions).
 */
function hasMangalDosha(
    chart: { planets: PlanetPosition[]; houses: HouseData },
    strict: boolean = true
): { hasDosha: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const mars = chart.planets.find(p => p.id === 2);
    if (!mars) return { hasDosha: false, reasons }; // Should not happen

    const ascSign = Math.floor(chart.houses.ascendant / 30) + 1; // 1-12
    const marsSign = Math.floor(mars.longitude / 30) + 1; // 1-12
    const moonSign = Math.floor((chart.planets.find(p => p.id === 1)?.longitude || 0) / 30) + 1;
    const venusSign = Math.floor((chart.planets.find(p => p.id === 5)?.longitude || 0) / 30) + 1;

    // Helper: 1-based House from Ref Sign
    const getHouse = (from: number, target: number) => ((target - from + 12) % 12) + 1;

    // 1. From Lagna
    const hLagna = getHouse(ascSign, marsSign);
    if (DOSHA_HOUSES.includes(hLagna)) {
        reasons.push(`Mars in ${hLagna} from Lagna`);
    }

    // 2. From Moon
    const hMoon = getHouse(moonSign, marsSign);
    if (DOSHA_HOUSES.includes(hMoon)) {
        reasons.push(`Mars in ${hMoon} from Moon`);
    }

    // 3. From Venus
    const hVenus = getHouse(venusSign, marsSign);
    if (DOSHA_HOUSES.includes(hVenus)) {
        reasons.push(`Mars in ${hVenus} from Venus`);
    }

    // Exceptions (Basic)
    // 1. Mars in Aries(1) or Scorpio(8) -> Own House.
    // 2. Mars in Capricorn(10) -> Exalted.
    // 3. Mars in Cancer(4) -> Debilitated (some say cancels, some say worst. BPHS says cancelled).
    // 4. Mars in Leo(5) / Sagittarius(9)? 
    // Let's implement Own/Exalt Check.
    
    // Check if Mars is in Own House or Exalted
    const isOwn = [1, 8].includes(marsSign);
    const isExalted = marsSign === 10;
    
    if ((isOwn || isExalted) && reasons.length > 0) {
        // Exception applies. cancel reasons.
        // Or mark as "Cancelled".
        reasons.push('BUT Cancelled: Mars in Own/Exalted Sign');
        return { hasDosha: false, reasons };
    }

    // Specific House Exceptions (e.g. Mars in 8th in Sagittarius/Pisces? ) -> Too detailed for basic check.
    // Basic Rule: If Mars is in 1,2,4,7,8,12 it is Dosha unless Exception.
    
    return { hasDosha: reasons.length > 0 && !reasons.some(r => r.includes('Cancelled')), reasons };
}

export function checkMangalDosha(
    boyChart: { planets: PlanetPosition[]; houses: HouseData },
    girlChart: { planets: PlanetPosition[]; houses: HouseData }
): DoshaResult {
    const boyCheck = hasMangalDosha(boyChart);
    const girlCheck = hasMangalDosha(girlChart);
    
    // Logic:
    // If Both have Dosha -> Match (Cancel).
    // If Neither have Dosha -> No Dosha.
    // If One has Dosha -> Mismatch (Present).
    
    let status: 'Cancel' | 'Present' | 'None' = 'None';
    
    if (boyCheck.hasDosha && girlCheck.hasDosha) {
        status = 'Cancel'; // Both hold Dosha, neutralizing.
    } else if (boyCheck.hasDosha || girlCheck.hasDosha) {
        status = 'Present'; // One-sided Dosha
    } else {
        status = 'None';
    }

    return {
        boyHasDosha: boyCheck.hasDosha,
        girlHasDosha: girlCheck.hasDosha,
        matchStatus: status,
        exceptions: [...boyCheck.reasons, ...girlCheck.reasons] // Just listing debug info really
    };
}
