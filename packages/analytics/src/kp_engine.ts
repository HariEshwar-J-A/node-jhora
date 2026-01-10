import { PlanetPosition, HouseData, KPSubLord, KPSignificator } from '@node-jhora/core';

export interface KPPlanetSignificator extends KPSignificator {
    planetName: string;
}

export interface KPHouseSignificator extends KPSignificator {
    houseNumber: number;
}

export class KPEngine {
    /**
     * Calculates KP Significators for all planets.
     * @param planets Array of planet positions
     */
    public static getAllPlanetSignificators(planets: PlanetPosition[]): KPPlanetSignificator[] {
        return planets.map(p => {
            const sig = KPSubLord.calculateKPSignificators(p.longitude);
            return {
                ...sig,
                planetName: p.name
            };
        });
    }

    /**
     * Calculates KP Significators for all house cusps.
     * @param houses House data (usually Placidus for KP)
     */
    public static getAllHouseSignificators(houses: HouseData): KPHouseSignificator[] {
        return houses.cusps.map((c, i) => {
            const sig = KPSubLord.calculateKPSignificators(c);
            return {
                ...sig,
                houseNumber: i + 1
            };
        });
    }
}
