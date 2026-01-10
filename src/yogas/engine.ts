
import { PlanetPosition } from '../engine/ephemeris.js';

export type YogaCategory = 'Raja' | 'Dhana' | 'Nabhasa' | 'Other';

export type ConditionType = 'placement' | 'aspect' | 'conjunction' | 'lordship' | 'strength';

export interface BaseCondition {
    type: ConditionType;
}

export interface PlacementCondition extends BaseCondition {
    type: 'placement';
    planet: string;
    house?: number[]; // 1-based house numbers [1, 4, 7, 10]
    sign?: number[]; // 0-based sign indices [0, 3, 4] (Aries, Cancer, Leo)
    inOwnSign?: boolean;
    inExaltation?: boolean;
    relativeTo?: string; // Planet name (e.g. 'Moon'). If set, 'house' becomes relative to this planet.
}

export interface AspectCondition extends BaseCondition {
    type: 'aspect';
    from: string; // Planet Name
    to: string;   // Planet Name
}

export interface ConjunctionCondition extends BaseCondition {
    type: 'conjunction';
    planets: string[]; // List of planet names required to be conjoined
}

export interface LordshipCondition extends BaseCondition {
    type: 'lordship';
    lord_of: number; // House number (e.g. 9) whose lord...
    placed_in: number; // ...is placed in this house (e.g. 10)
}

export interface StrengthCondition extends BaseCondition {
    type: 'strength';
    planet: string;
    min_shadbala: number;
}

export type Condition = PlacementCondition | AspectCondition | ConjunctionCondition | LordshipCondition | StrengthCondition;

export interface YogaDefinition {
    name: string;
    category: YogaCategory;
    description?: string;
    conditions: Condition[]; // Implicit AND
}

export interface ChartData {
    planets: PlanetPosition[];
    cusps: number[]; // House cusps (starts)
    ascendant: number;
    // Pre-calculated values to speed up evaluation
    // lords?: { [house: number]: string }; 
    // strengths?: { [planet: string]: number };
}

export class YogaEngine {

    public static findYogas(chart: ChartData, library: YogaDefinition[]): string[] {
        const results: string[] = [];
        for (const yoga of library) {
            if (this.evaluateYoga(chart, yoga)) {
                results.push(yoga.name);
            }
        }
        return results;
    }

    private static evaluateYoga(chart: ChartData, yoga: YogaDefinition): boolean {
        for (const condition of yoga.conditions) {
            if (!this.evaluateCondition(chart, condition)) {
                return false;
            }
        }
        return true;
    }

    private static evaluateCondition(chart: ChartData, condition: Condition): boolean {
        switch (condition.type) {
            case 'placement':
                return this.checkPlacement(chart, condition as PlacementCondition);
            case 'aspect':
                return this.checkAspect(chart, condition as AspectCondition);
            case 'conjunction':
                return this.checkConjunction(chart, condition as ConjunctionCondition);
            case 'lordship':
                return this.checkLordship(chart, condition as LordshipCondition);
            case 'strength':
                return this.checkStrength(chart, condition as StrengthCondition);
            default:
                return false;
        }
    }

    // --- Evaluators ---

    private static checkPlacement(chart: ChartData, cond: PlacementCondition): boolean {
        const planet = chart.planets.find(p => p.name === cond.planet);
        if (!planet) return false;

        const planetLon = planet.longitude;
        const signIndex = Math.floor(planetLon / 30);

        // Sign Check
        if (cond.sign && !cond.sign.includes(signIndex)) return false;

        // House Check (Absolute or Relative)
        if (cond.house) {
            let currentHouse: number;
            
            if (cond.relativeTo) {
                // Relative Placement: Calculate house from Reference Planet
                const refPlanet = chart.planets.find(p => p.name === cond.relativeTo);
                if (!refPlanet) return false;
                
                const refSign = Math.floor(refPlanet.longitude / 30);
                const pSign = signIndex;
                
                // Count signs from Ref to Planet (Inclusive)
                // Same sign = 1. Next sign = 2.
                let count = (pSign - refSign) + 1;
                if (count <= 0) count += 12;
                currentHouse = count;
            } else {
                // Absolute Placement (using Cusps)
                currentHouse = this.getHouse(planetLon, chart.cusps);
            }

            if (!cond.house.includes(currentHouse)) return false;
        }

        // Own Sign Check
        if (cond.inOwnSign) {
            if (!this.isOwnSign(cond.planet, signIndex)) return false;
        }

        // Exaltation Check
        if (cond.inExaltation) {
            if (!this.isExaltationSign(cond.planet, signIndex)) return false;
        }

        return true;
    }

    private static checkConjunction(chart: ChartData, cond: ConjunctionCondition): boolean {
        // Conjunction: In the same Sign (Rashi) usually. Or strict orb?
        // Standard Yoga definition usually implies Same Sign.
        if (cond.planets.length < 2) return true;

        const firstPlanet = chart.planets.find(p => p.name === cond.planets[0]);
        if (!firstPlanet) return false;

        const firstSign = Math.floor(firstPlanet.longitude / 30);

        for (let i = 1; i < cond.planets.length; i++) {
            const p = chart.planets.find(item => item.name === cond.planets[i]);
            if (!p) return false;
            const s = Math.floor(p.longitude / 30);
            if (s !== firstSign) return false;
        }

        return true;
    }

    private static checkAspect(chart: ChartData, cond: AspectCondition): boolean {
        // Simple Parashari Aspects by Sign logic for now? 
        // Or simple: 7th house aspect. 
        // Mars: 4,7,8. Saturn: 3,7,10. Jupiter: 5,7,9.
        // Needs helper.
        const pFrom = chart.planets.find(p => p.name === cond.from);
        const pTo = chart.planets.find(p => p.name === cond.to);
        if (!pFrom || !pTo) return false;

        return this.hasAspect(cond.from, pFrom.longitude, pTo.longitude);
    }

    private static checkLordship(chart: ChartData, cond: LordshipCondition): boolean {
        // Lord of X placed in Y.
        // 1. Determine Lord of House X.
        const lord = this.getHouseLord(cond.lord_of, chart);
        if (!lord) return false; // Lord unknown (e.g. Rahu/Ketu ownership debated, usually signs ruled by 7 planets)

        // 2. Check placement of that Lord.
        const lordPlanet = chart.planets.find(p => p.name === lord);
        if (!lordPlanet) return false;

        const placementHouse = this.getHouse(lordPlanet.longitude, chart.cusps);
        return placementHouse === cond.placed_in;
    }

    private static checkStrength(chart: ChartData, cond: StrengthCondition): boolean {
        // Placeholder until Shadbala is implemented
        return true;
    }

    // --- Helpers ---

    private static getHouse(lon: number, cusps: number[]): number {
        // Assuming Placidus/Topocentric unequal houses, we check ranges.
        // Cusp 1 is start of House 1. Cusp 2 is end of House 1 / start of House 2.
        for (let i = 0; i < 12; i++) {
            const start = cusps[i];
            const end = cusps[(i + 1) % 12];

            // Handle wrap around 360
            if (start < end) {
                if (lon >= start && lon < end) return i + 1;
            } else {
                if (lon >= start || lon < end) return i + 1;
            }
        }
        return 1; // Fallback
    }

    private static getHouseLord(houseNum: number, chart: ChartData): string | null {
        // House 1-12.
        // Find sign at Cusp of House X.
        // In Placidus, cusp degree defines the sign.
        const cuspDegree = chart.cusps[houseNum - 1]; // 0-indexed
        const signIndex = Math.floor(cuspDegree / 30);
        return this.getSignRuler(signIndex);
    }

    private static getSignRuler(signIndex: number): string {
        // 0=Ar(Mar), 1=Ta(Ven), 2=Ge(Mer), 3=Cn(Mon), 4=Le(Sun), 5=Vi(Mer)
        // 6=Li(Ven), 7=Sc(Mar), 8=Sa(Jup), 9=Cp(Sat), 10=Aq(Sat), 11=Pi(Jup)
        const rulers = [
            'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
            'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'
        ];
        return rulers[signIndex];
    }

    private static isOwnSign(planet: string, sign: number): boolean {
        return this.getSignRuler(sign) === planet;
        // Note: Careful with Co-Lords if implementing Aquarius=Rahu? Standard is Saturn.
    }

    private static isExaltationSign(planet: string, sign: number): boolean {
        // Sun->Aries(0), Moon->Taurus(1), Mars->Capricorn(9), Mer->Virgo(5)
        // Jup->Cancer(3), Ven->Pisces(11), Sat->Libra(6)
        // Rahu->Tau/Gem? Ketu->Sco/Sag?
        const exaltations: { [key: string]: number } = {
            'Sun': 0, 'Moon': 1, 'Mars': 9, 'Mercury': 5,
            'Jupiter': 3, 'Venus': 11, 'Saturn': 6
        };
        return exaltations[planet] === sign;
    }

    private static hasAspect(planet: string, fromLon: number, toLon: number): boolean {
        // Sign-based Aspect for definition ease? Or specific degrees?
        // Yoga definitions usually implicit "Full Aspect".
        // Distance from -> to.
        const fromSign = Math.floor(fromLon / 30);
        const toSign = Math.floor(toLon / 30);

        // Count signs inclusive. 1 = Same sign.
        let count = (toSign - fromSign) + 1;
        if (count <= 0) count += 12;

        // Standard Rules:
        // All aspect 7.
        if (count === 7) return true;

        // Mars: 4, 8
        if (planet === 'Mars' && (count === 4 || count === 8)) return true;

        // Jupiter: 5, 9
        if (planet === 'Jupiter' && (count === 5 || count === 9)) return true;

        // Saturn: 3, 10
        if (planet === 'Saturn' && (count === 3 || count === 10)) return true;

        return false;
    }
}
