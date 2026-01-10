
import { PlanetPosition } from '../engine/ephemeris.js';
import { KPSubLord, KPSignificator } from './sublord.js';

export interface RulingPlanetsResult {
    lagnaSignLord: number;
    lagnaStarLord: number;
    moonSignLord: number;
    moonStarLord: number;
    dayLord: number; // Vara Lord
}

export class KPRuling {

    /**
     * Calculates the 5 Ruling Planets.
     * @param ascendantLon Longitude of Lagna
     * @param moonLon Longitude of Moon
     * @param dayLordId Planet ID of the Day Lord (Sun=0...Sat=6). 
     *                  Caller must calculate this based on Sunrise!
     */
    public static calculateRulingPlanets(
        ascendantLon: number, 
        moonLon: number, 
        dayLordId: number
    ): RulingPlanetsResult {
        const ascSig = KPSubLord.calculateKPSignificators(ascendantLon);
        const moonSig = KPSubLord.calculateKPSignificators(moonLon);

        return {
            lagnaSignLord: ascSig.signLord,
            lagnaStarLord: ascSig.starLord,
            moonSignLord: moonSig.signLord,
            moonStarLord: moonSig.starLord,
            dayLord: dayLordId
        };
    }
}
