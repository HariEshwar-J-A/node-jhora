import { PlanetPosition } from '@node-jhora/core';
import { useMemo } from 'react';

// South Indian Layout is simple: Planets are grouped by Sign Index (0-11).
// No House rotation relative to Ascendant logic needed for *placement*, 
// though Ascendant is marked.

export function useSouthLayout(planets: PlanetPosition[]): PlanetPosition[][] {
    return useMemo(() => {
        const bySign: PlanetPosition[][] = Array(12).fill(null).map(() => []);
        
        planets.forEach(p => {
             const s = Math.floor(p.longitude / 30);
             if (s >= 0 && s < 12) {
                 bySign[s].push(p);
             }
        });
        
        return bySign;
    }, [planets]);
}
