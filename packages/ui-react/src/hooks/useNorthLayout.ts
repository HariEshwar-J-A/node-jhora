import { PlanetPosition } from '@node-jhora/core';
import { useMemo } from 'react';

// Reusing the collision interface from South Chart if available, or redefining.
// Since this hook is specific, we'll define locally or assume similar structure.
export interface RenderablePlanet extends PlanetPosition {
    // UI specific props
    x?: number;
    y?: number;
    houseIndex: number; // 1-12 (Fixed House in North Chart)
}

/**
 * calculates planet positions for North Indian Chart.
 * In North Chart, House 1 is always Top.
 * Planets are mapped to Houses based on Ascendant.
 * PlanetHouse = (PlanetSign - AscendantSign + 12) % 12 + 1.
 */
export function useNorthLayout(
    planets: PlanetPosition[],
    ascendantSign: number // 1-12 (Sign Index 0-11 + 1)
): RenderablePlanet[][] {

    const groupedPlanets = useMemo(() => {
        // 1. Map planets to Houses (1-12)
        const mapped = planets.map(p => {
            const planetSign = Math.floor(p.longitude / 30) + 1; // 1-12
            // House logic:
            // If Asc=1 (Aries), Planet=1 (Aries) -> House 1.
            // If Asc=4 (Cancer), Planet=1 (Aries) -> House 10.
            // Formula: (PlanetSign - AscSign + 12) % 12 + 1.
            let house = (planetSign - ascendantSign + 12) % 12 + 1;
            
            return {
                ...p,
                houseIndex: house
            } as RenderablePlanet;
        });

        // 2. Group by House
        const groups: RenderablePlanet[][] = Array(12).fill(null).map(() => []);
        mapped.forEach(p => {
            if (p.houseIndex >= 1 && p.houseIndex <= 12) {
                groups[p.houseIndex - 1].push(p);
            }
        });

        // 3. Layout within House (Simple List or Physics)
        // For North Chart, planets are usually listed centrally.
        // We defer specific X/Y calculation to the rendering component or add simple offsets here.
        // Let's just return the groups, and let the component handle the "collision" or list rendering
        // relative to the House Center defined in geometry.
        
        return groups;
    }, [planets, ascendantSign]);

    return groupedPlanets;
}
