import { PlanetPosition, normalize360 } from '@node-jhora/core';
import { YogaDef, YogaResult, Condition } from '../types/rules.js';

export interface ChartData {
    planets: PlanetPosition[];
    cusps: number[]; // 12 house cusps (0-indexed)
    ascendant: number;
}

export class YogaEngine {
    /**
     * Finds all yogas from a library that match the current chart.
     */
    public static findYogas(chart: ChartData, library: YogaDef[]): YogaResult[] {
        const results: YogaResult[] = [];

        for (const yoga of library) {
            const triggeringPlanets: Set<string> = new Set();
            let allMatch = true;

            for (const condition of yoga.conditions) {
                const match = this.checkCondition(chart, condition, triggeringPlanets);
                if (!match) {
                    allMatch = false;
                    break;
                }
            }

            if (allMatch) {
                results.push({
                    yoga,
                    triggeringPlanets: Array.from(triggeringPlanets)
                });
            }
        }

        return results;
    }

    private static checkCondition(chart: ChartData, cond: Condition, triggeringPlanets: Set<string>): boolean {
        switch (cond.type) {
            case 'placement':
                return this.evaluatePlacement(chart, cond, triggeringPlanets);
            case 'lordship':
                return this.evaluateLordship(chart, cond, triggeringPlanets);
            case 'conjunction':
                return this.evaluateConjunction(chart, cond, triggeringPlanets);
            case 'aspect':
                return this.evaluateAspect(chart, cond, triggeringPlanets);
            case 'strength':
                return this.evaluateStrength(chart, cond, triggeringPlanets);
            case 'distance':
                return this.evaluateDistance(chart, cond, triggeringPlanets);
            default:
                return false;
        }
    }

    private static evaluatePlacement(chart: ChartData, cond: any, triggeringPlanets: Set<string>): boolean {
        const planetName = this.resolvePlanet(chart, cond.planet);
        if (!planetName) return false;

        const planet = chart.planets.find(p => p.name === planetName);
        if (!planet) return false;

        const planetLon = planet.longitude;
        const signIndex = Math.floor(planetLon / 30);

        // Sign Check
        if (cond.signs && !cond.signs.includes(signIndex)) return false;

        let house: number;
        if (cond.from === 'Moon') {
            house = this.getRelativeHouse(chart, planetName, 'Moon');
        } else if (cond.from === 'Sun') {
            house = this.getRelativeHouse(chart, planetName, 'Sun');
        } else {
            house = this.getHouseNum(chart, planet.longitude);
        }

        if (cond.houses.includes(house)) {
            triggeringPlanets.add(planetName);
            return true;
        }
        return false;
    }

    private static evaluateLordship(chart: ChartData, cond: any, triggeringPlanets: Set<string>): boolean {
        const lordName = this.getLordOfHouse(chart, cond.lordOf);
        if (!lordName) return false;

        const lord = chart.planets.find(p => p.name === lordName);
        if (!lord) return false;

        let house: number;
        if (cond.from === 'Moon') {
            house = this.getRelativeHouse(chart, lordName, 'Moon');
        } else {
            house = this.getHouseNum(chart, lord.longitude);
        }

        if (cond.placedIn.includes(house)) {
            triggeringPlanets.add(lordName);
            return true;
        }
        return false;
    }

    private static evaluateConjunction(chart: ChartData, cond: any, triggeringPlanets: Set<string>): boolean {
        const resolvedPlanets = cond.planets.map((p: string) => this.resolvePlanet(chart, p)).filter((p: string) => !!p);
        if (resolvedPlanets.length < cond.planets.length) return false;

        const firstP = chart.planets.find(p => p.name === resolvedPlanets[0]);
        if (!firstP) return false;

        const firstSign = Math.floor(firstP.longitude / 30);
        const orb = cond.minOrb || 15;

        for (let i = 1; i < resolvedPlanets.length; i++) {
            const currentP = chart.planets.find(p => p.name === resolvedPlanets[i]);
            if (!currentP) return false;

            const currentSign = Math.floor(currentP.longitude / 30);
            if (currentSign !== firstSign) return false;

            const dist = Math.abs(currentP.longitude - firstP.longitude);
            if (dist > orb) return false;
        }

        resolvedPlanets.forEach((p: string) => triggeringPlanets.add(p));
        return true;
    }

    private static evaluateAspect(chart: ChartData, cond: any, triggeringPlanets: Set<string>): boolean {
        const aspectorName = this.resolvePlanet(chart, cond.aspector);
        if (!aspectorName) return false;

        const aspector = chart.planets.find(p => p.name === aspectorName);
        if (!aspector) return false;

        if (typeof cond.target === 'string') {
            const targetName = this.resolvePlanet(chart, cond.target);
            const target = chart.planets.find(p => p.name === targetName);
            if (!target) return false;

            const hasAspect = this.checkGrahaAspect(aspectorName, aspector.longitude, target.longitude);
            if (hasAspect) {
                triggeringPlanets.add(aspectorName);
                triggeringPlanets.add(targetName);
                return true;
            }
        }
        // House aspect logic could go here
        return false;
    }

    private static evaluateStrength(chart: ChartData, cond: any, triggeringPlanets: Set<string>): boolean {
        // Shadbala required here. Mocking for now.
        return true;
    }

    private static evaluateDistance(chart: ChartData, cond: any, triggeringPlanets: Set<string>): boolean {
        const p1Name = this.resolvePlanet(chart, cond.planet);
        const p2Name = this.resolvePlanet(chart, cond.from);
        if (!p1Name || !p2Name) return false;

        const p1 = chart.planets.find(p => p.name === p1Name);
        const p2 = chart.planets.find(p => p.name === p2Name);
        if (!p1 || !p2) return false;

        const s1 = Math.floor(p1.longitude / 30);
        const s2 = Math.floor(p2.longitude / 30);

        let dist = (s1 - s2) + 1;
        if (dist <= 0) dist += 12;

        if (dist >= cond.range[0] && dist <= cond.range[1]) {
            triggeringPlanets.add(p1Name);
            triggeringPlanets.add(p2Name);
            return true;
        }
        return false;
    }

    // --- Helpers ---

    private static resolvePlanet(chart: ChartData, identifier: string): string {
        if (identifier.startsWith('LordOf')) {
            const houseNum = parseInt(identifier.replace('LordOf', ''), 10);
            return this.getLordOfHouse(chart, houseNum) || '';
        }
        return identifier;
    }

    private static getLordOfHouse(chart: ChartData, houseNum: number): string | null {
        const cuspIdx = houseNum - 1;
        const signIdx = Math.floor(chart.cusps[cuspIdx] / 30);
        return this.getSignRuler(signIdx);
    }

    private static getSignRuler(signIdx: number): string {
        const rulers = [
            'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
            'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'
        ];
        return rulers[signIdx];
    }

    private static getHouseNum(chart: ChartData, longitude: number): number {
        for (let i = 0; i < 12; i++) {
            const start = chart.cusps[i];
            const end = chart.cusps[(i + 1) % 12];
            if (start < end) {
                if (longitude >= start && longitude < end) return i + 1;
            } else {
                if (longitude >= start || longitude < end) return i + 1;
            }
        }
        return 1;
    }

    private static getRelativeHouse(chart: ChartData, planetName: string, relativeTo: 'Moon' | 'Sun'): number {
        const p = chart.planets.find(pl => pl.name === planetName);
        const ref = chart.planets.find(pl => pl.name === relativeTo);
        if (!p || !ref) return 0;

        const pSign = Math.floor(p.longitude / 30);
        const refSign = Math.floor(ref.longitude / 30);

        let count = (pSign - refSign) + 1;
        if (count <= 0) count += 12;
        return count;
    }

    private static checkGrahaAspect(aspector: string, fromLon: number, toLon: number): boolean {
        const fromSign = Math.floor(fromLon / 30);
        const toSign = Math.floor(toLon / 30);
        let count = (toSign - fromSign) + 1;
        if (count <= 0) count += 12;

        if (count === 7) return true;
        if (aspector === 'Mars' && (count === 4 || count === 8)) return true;
        if (aspector === 'Jupiter' && (count === 5 || count === 9)) return true;
        if (aspector === 'Saturn' && (count === 3 || count === 10)) return true;

        return false;
    }
}
