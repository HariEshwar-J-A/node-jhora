
/**
 * South Indian Marriage Compatibility (10 Poruthams).
 */

export interface KutaScore {
    name: string;
    score: number;
    maxScore: number;
    description: string;
    isCompatible: boolean;
}

export interface CompatibilityResult {
    totalScore: number;
    maxTotal: number;
    matches: KutaScore[];
    isRecommended: boolean;
}

// Data Tables
// Nakshatras 1-27
// Gana: Deva(0), Manushya(1), Rakshasa(2)
const GANA_TABLE = [
    0, 1, 2, 1, 0, 1, 0, 0, 2, // 1-9
    2, 1, 1, 0, 2, 0, 0, 0, 2, // 10-18
    2, 0, 1, 0, 2, 2, 1, 1, 0  // 19-27
];

// Yoni (Animal):
// 1.Ashwini(Horse), 2.Bharani(Elephant)...
// Simplified mapping needed. Let's use standard table.
// 0=Horse, 1=Elephant, 2=Goat, 3=Snake, 4=Dog, 5=Cat, 6=Rat, 7=Cow, 8=Buffalo, 
// 9=Tiger, 10=Deer, 11=Monkey, 12=Mongoose, 13=Lion.
// Nakshatra -> Animal Index.
const YONI_MAP = [
    0, 1, 2, 3, 3, 4, 5, 2, 5,  // 1-9 (Ashwini..Aslesha)
    6, 6, 7, 8, 9, 8, 9, 10, 10, // 10-18 (Magha..Jyeshta)
    4, 11, 11, 12, 12, 13, 0, 1, 7 // 19-27 (Mula..Revati)
];
// Enemies?
const YONI_ENEMIES: Record<number, number> = {
    7: 9, 9: 7, // Cow vs Tiger
    1: 13, 13: 1, // Elephant vs Lion
    0: 8, 8: 0, // Horse vs Buffalo
    4: 10, 10: 4, // Dog vs Deer
    3: 12, 12: 3, // Snake vs Mongoose
    11: 2, 2: 11, // Monkey vs Goat
    5: 6, 6: 5  // Cat vs Rat
};

export class PoruthamMatch {

    /**
     * Calculates compatibility.
     * @param boyNak Nakshatra Index (0-26)
     * @param girlNak Nakshatra Index (0-26)
     * @param boySign Moon Sign (1-12)
     * @param girlSign Moon Sign (1-12)
     */
    public static match(boyNak: number, girlNak: number, boySign: number, girlSign: number): CompatibilityResult {
        const matches: KutaScore[] = [];
        
        // 1. Dina Kuta (Health/Prosperity)
        // Count from Girl to Boy.
        // Remainder / 9.
        // Good if Remainder is 2, 4, 6, 8, 9 (0).
        // Bad if 1, 3, 5, 7. (Except 27th is good).
        let count = (boyNak - girlNak) + 1;
        if (count <= 0) count += 27;
        const rem9 = count % 9;
        const dinaGood = [0, 2, 4, 6, 8].includes(rem9) || count === 27;
        matches.push({
            name: 'Dina',
            score: dinaGood ? 1 : 0,
            maxScore: 1,
            description: dinaGood ? 'Compatible' : 'Incompatible',
            isCompatible: dinaGood
        });

        // 2. Gana Kuta (Temperament)
        // Deva(0), Manushya(1), Rakshasa(2).
        // Same Gana = Good.
        // Deva - Manushya = Passable.
        // Deva - Rakshasa = Bad.
        // Rakshasa - Manushya = Bad (Death).
        const boyG = GANA_TABLE[boyNak];
        const girlG = GANA_TABLE[girlNak];
        let ganaScore = 0;
        let ganaMax = 4;
        let ganaDesc = 'Mismatch';

        if (boyG === girlG) {
            ganaScore = 4;
            ganaDesc = 'Excellent';
        } else if ((girlG === 0 && boyG === 1) || (girlG === 1 && boyG === 0)) {
            ganaScore = 2; // Passable
            ganaDesc = 'Moderate';
        } else if (girlG === 2 && boyG === 0) {
            ganaScore = 0; // Rakshasa girl - Deva boy?
            ganaDesc = 'Incompatible'; 
        } else {
            // General rule: 0 if mismatch involving Rakshasa
            ganaScore = 0;
        }
        matches.push({
            name: 'Gana',
            score: ganaScore,
            maxScore: ganaMax,
            description: ganaDesc,
            isCompatible: ganaScore > 0
        });

        // 3. Yoni Kuta (Sexual Compatibility/Intensity)
        const boyY = YONI_MAP[boyNak];
        const girlY = YONI_MAP[girlNak];
        let yoniScore = 0;
        let yoniMax = 4;
        
        if (boyY === girlY) {
            yoniScore = 4;
        } else if (YONI_ENEMIES[boyY] === girlY) {
            yoniScore = 0; // Enemy
        } else {
            yoniScore = 2; // Neutral
        }
        matches.push({
            name: 'Yoni',
            score: yoniScore,
            maxScore: yoniMax,
            description: yoniScore === 4 ? 'Reference' : (yoniScore === 0 ? 'Enemy' : 'Neutral'),
            isCompatible: yoniScore > 0
        });

        // 4. Rajju (Cord - Longevity of Couple) properties
        // Grouped by body part:
        // Head(Shiro): 5, 6, 14, 15, 23, 24... -> Mapped logic needed.
        // Padakrama:
        // 1(Ashwini)-Feet, 2-Hip, 3-Navel, 4-Neck, 5-Head, 6-Head, 7-Neck, 8-Navel, 9-Hip, 10-Feet...
        // Pattern: 1,2,3,4,5, 5,4,3,2,1... ZigZag.
        // Check for same Rajju = Dosha (Bad).
        // Different Rajju = Good.
        const getRajju = (nak: number) => {
            // 1-based logic:
            const n = nak + 1;
            // 1..5 -> 1,2,3,4,5
            // 6..10 -> 5,4,3,2,1
            // 11..15 -> 1,2,3,4,5
            // 16..20 -> 5,4,3,2,1
            // 21..25 -> 1,2,3,4,5
            // 26,27 -> 5,4
            
            const group = Math.ceil(n / 5); // 1 to 6
            const posInGroup = (n - 1) % 5; // 0..4
            
            if (group % 2 !== 0) { // Odd Groups (1,3,5): 1,2,3,4,5 -> Return pos+1
                return posInGroup + 1;
            } else { // Even Groups (2,4,6?): 5,4,3,2,1 -> Return 5-pos
                return 5 - posInGroup;
            }
        };
        
        const boyR = getRajju(boyNak);
        const girlR = getRajju(girlNak);
        
        const rajjuReview = (boyR !== girlR);
        matches.push({
            name: 'Rajju',
            score: rajjuReview ? 1 : 0, // Usually Pass/Fail
            maxScore: 1,
            description: rajjuReview ? 'Match' : 'Dosha (Same Rajju)',
            isCompatible: rajjuReview
        });

        // Summarize
        const total = matches.reduce((sum, m) => sum + m.score, 0);
        const max = matches.reduce((sum, m) => sum + m.maxScore, 0);

        return {
            totalScore: total,
            maxTotal: max,
            matches,
            isRecommended: (total / max) > 0.5 && rajjuReview // Rajju is mandatory usually
        };
    }
}
