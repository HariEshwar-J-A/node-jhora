import { PlanetPosition } from '@node-jhora/core';
import { ASHTAKAVARGA_RULES } from './rules.js';

export interface AshtakavargaResult {
    bav: Record<number, number[]>; // PlanetID -> [Score in Sign 0...11]
    sav: number[]; // Community Score [Sign 0...11]
}

export class AshtakavargaCalculator {
    /**
     * Calculates Binna Ashtakavarga (BAV) for a specific planet.
     * @param planets List of all planets (including Lagna at ID 99)
     * @param targetPlanetId ID of the planet to calculate BAV for (0-6)
     */
    public static calculateBAV(planets: PlanetPosition[], targetPlanetId: number): number[] {
        const scores = new Array(12).fill(0);
        const rules = ASHTAKAVARGA_RULES[targetPlanetId];
        
        if (!rules) {
            throw new Error(`No rules defined for planet ID ${targetPlanetId}`);
        }

        // Donor IDs: 0-6 (Planets) + 99 (Lagna)
        const donorIds = [0, 1, 4, 2, 5, 3, 6, 99];

        donorIds.forEach(donorId => {
            const beneficHouses = rules[donorId];
            if (!beneficHouses) return;

            const donor = planets.find(p => p.id === donorId);
            if (!donor) return;

            // Sign index (0-based, 0=Aries)
            const donorSignIndex = Math.floor(donor.longitude / 30);

            beneficHouses.forEach(houseNum => {
                // houseNum is 1-based (1st house = same sign)
                const targetSignIndex = (donorSignIndex + houseNum - 1) % 12;
                scores[targetSignIndex]++;
            });
        });

        return scores;
    }

    /**
     * Calculates Sarva Ashtakavarga (SAV) by summing BAVs of all 7 planets.
     * @param planets List of all planets (including Lagna at ID 99)
     */
    public static calculateSAV(planets: PlanetPosition[]): AshtakavargaResult {
        const bav: Record<number, number[]> = {};
        const sav = new Array(12).fill(0);
        const targetPlanets = [0, 1, 4, 2, 5, 3, 6]; // Sun, Moon, Mars, Mer, Jup, Ven, Sat

        targetPlanets.forEach(id => {
            const planetBAV = this.calculateBAV(planets, id);
            bav[id] = planetBAV;
            
            planetBAV.forEach((score, signIdx) => {
                sav[signIdx] += score;
            });
        });

        // Validation Checksum: 337
        const totalBindus = sav.reduce((sum, current) => sum + current, 0);
        if (totalBindus !== 337) {
            throw new Error(`Ashtakavarga Validation Failed: Total Bindus is ${totalBindus}, expected 337.`);
        }

        return { bav, sav };
    }
}
