import { MatchResult, KutaScore, Gana, YoniAnimal, Nadi, Varna } from '../types.js';
import { GANA_TABLE, YONI_TABLE, YONI_MATRIX, NADI_TABLE, GRAHA_MAITRI, SIGN_LORDS, VASHYA_PAIRS, VASHYA_SIGNS } from './data.js';

export function calculateAshtaKuta(
    boyStar: number, // 0-26
    girlStar: number, // 0-26
    boySign: number, // 1-12
    girlSign: number // 1-12
): MatchResult {
    const scores: KutaScore[] = [];

    // 1. Varna (1 Point)
    // Rule: Boy Varna >= Girl Varna is Good.
    // Brahmin(0) > Kshatriya(1) > Vaishya(2) > Shudra(3).
    // Note: Lower enum value = Higher Rank.
    // Logic: Boy <= Girl (0 <= 1 is Good).
    const getVarna = (sign: number): Varna => {
        // Signs 1-12
        if ([4, 8, 12].includes(sign)) return Varna.Brahmin;
        if ([1, 5, 9].includes(sign)) return Varna.Kshatriya;
        if ([2, 6, 10].includes(sign)) return Varna.Vaishya;
        return Varna.Shudra;
    };
    const boyV = getVarna(boySign);
    const girlV = getVarna(girlSign);
    const varnaScore = (boyV <= girlV) ? 1 : 0;
    scores.push({ name: 'Varna', score: varnaScore, maxScore: 1, description: varnaScore ? 'Good' : 'Bad', isCompatible: varnaScore > 0 });

    // 2. Vashya (2 Points)
    // Attraction. Based on Pairs.
    // If Boy in Girl's list AND Girl in Boy's list -> 2?
    // Or One Way -> 1?
    // Let's check VASHYA_PAIRS.
    // Def: VASHYA_PAIRS[X] = List of signs compatible with X.
    const boyVList = VASHYA_PAIRS[boySign] || [];
    const girlVList = VASHYA_PAIRS[girlSign] || [];
    
    let vashyaScore = 0;
    if (boyVList.includes(girlSign) && girlVList.includes(boySign)) {
        vashyaScore = 2; // Full
    } else if (boyVList.includes(girlSign) || girlVList.includes(boySign)) {
        vashyaScore = 1; // Half
    } else {
        // Same sign is usually Vashya default
        // Also check same Vashya Group (Sign lookup) if pairs fail
        if (boySign === girlSign) vashyaScore = 2;
        else vashyaScore = 0;
    }
    // Override: Some texts say if Signs belong to same Vashya Group (e.g. both Manava), score is 2?
    // Prompt emphasizes "Attraction (Human vs Lion)".
    // Let's stick to Pairs as primary, and Group matching as fallback if table incomplete?
    // Sticking to standard Pairs Logic + Same Sign.
    scores.push({ name: 'Vashya', score: vashyaScore, maxScore: 2, description: vashyaScore === 2 ? 'Excellent' : (vashyaScore ? 'Passable' : 'Bad'), isCompatible: vashyaScore > 0 });

    // 3. Tara (3 Points)
    // Girl -> Boy. Count.
    let count = (boyStar - girlStar) + 1;
    if (count <= 0) count += 27;
    const rem = count % 9; // 1-9 usually, modulo gives 0-8.
    // Count is 1-based usually.
    // If count=1, rem=1.
    // If count=9, rem=0.
    // Good Rem: 1, 2, 4, 6, 8, 0(9).
    // Bad Rem: 3, 5, 7.
    let taraScore = 0;
    if (rem === 3 || rem === 5 || rem === 7) {
        taraScore = 0;
    } else {
        taraScore = 3; // Or 1.5 if just one way? North usually 3 or 0.
        // Some systems do Boy->Girl too and Avg.
        // Prompt implies standard "Divide by 9... remainder score".
        // Usually full, 3.
    }
    scores.push({ name: 'Tara', score: taraScore, maxScore: 3, description: taraScore ? 'Good' : 'Bad', isCompatible: taraScore > 0 });

    // 4. Yoni (4 Points)
    const boyY = YONI_TABLE[boyStar];
    const girlY = YONI_TABLE[girlStar];
    const yoniScore = YONI_MATRIX[boyY][girlY];
    scores.push({ name: 'Yoni', score: yoniScore, maxScore: 4, description: yoniScore >= 2 ? 'Good' : 'Bad', isCompatible: yoniScore >= 2 });

    // 5. Graha Maitri (5 Points)
    // Lords
    const boyLord = SIGN_LORDS[boySign - 1]; // Sign 1-12 -> Index 0-11
    const girlLord = SIGN_LORDS[girlSign - 1];
    
    // Friendships
    const getRel = (planet: number, target: number) => {
        if (planet === target) return 1; // Own Sign Lord - treated as Friend
        const val = GRAHA_MAITRI[planet][target];
        return val;
    };

    const bToG = getRel(boyLord, girlLord); // Boy Lord's view of Girl Lord
    const gToB = getRel(girlLord, boyLord);
    
    // Scoring Table
    // (1, 1) = 5
    // (1, 0) | (0, 1) = 4
    // (1, -1) | (-1, 1) = 1 (Some say 0.5 or 1) - Standard is 1?
    // (0, 0) = 3
    // (0, -1) | (-1, 0) = 0.5
    // (-1, -1) = 0
    let maitriScore = 0;
    
    // Helper to sum logic
    // Just map standard table
    if (bToG === 1 && gToB === 1) maitriScore = 5;
    else if ((bToG === 1 && gToB === 0) || (bToG === 0 && gToB === 1)) maitriScore = 4;
    else if (bToG === 0 && gToB === 0) maitriScore = 3;
    else if ((bToG === 1 && gToB === -1) || (bToG === -1 && gToB === 1)) maitriScore = 1; // Wait, usually 1 or 0.5? Usually 1.
    else if ((bToG === 0 && gToB === -1) || (bToG === -1 && gToB === 0)) maitriScore = 0.5;
    else maitriScore = 0; // Enemy-Enemy

    scores.push({ name: 'Graha Maitri', score: maitriScore, maxScore: 5, description: maitriScore >= 3 ? 'Good' : 'Bad', isCompatible: maitriScore >= 3 });

    // 6. Gana (6 Points)
    const boyG = GANA_TABLE[boyStar];
    const girlG = GANA_TABLE[girlStar];
    let ganaScore = 0;
    
    if (boyG === girlG) ganaScore = 6;
    else {
        // Diff
        // Deva(0), Man(1), Rak(2)
        if ((boyG === Gana.Deva && girlG === Gana.Manushya) || (girlG === Gana.Deva && boyG === Gana.Manushya)) {
            ganaScore = 6; // D-M is good
        } else if (girlG === Gana.Rakshasa) {
            // Rakshasa Girl...
            if (boyG === Gana.Deva) ganaScore = 0; // Bad
            else if (boyG === Gana.Manushya) ganaScore = 0; // Bad
        } else if (boyG === Gana.Rakshasa) {
            // Rakshasa Boy
            if (girlG === Gana.Deva) ganaScore = 1; // D-R (Boy R) sometimes 1?
            else if (girlG === Gana.Manushya) ganaScore = 0;
        }
    }
    scores.push({ name: 'Gana', score: ganaScore, maxScore: 6, description: ganaScore >= 5 ? 'Good' : 'Bad', isCompatible: ganaScore >= 5 });

    // 7. Bhakoot (7 Points)
    // Distance Boy to Girl
    // Or just relative distance.
    // 1, 7, 3, 11, 4, 10, 5, 9 => Good (7)
    // 2, 12, 6, 8 => Bad (0)
    // Distance logic:
    // d = (Girl - Boy + 12)%12 + 1 ? (This is position of Girl relative to Boy?)
    // Actually relative positions logic:
    // if |B-G| = 1 or 11 (2/12 relationship) -> Bad
    // if |B-G| = 5 or 7 (6/8 relationship) -> Bad
    // Wait, 6/8 means dist is 6 and 8. e.g. 1 and 6? No 1 and 6 is 6th. 1 and 8 is 8th.
    
    let dist = (girlSign - boySign); 
    if (dist < 0) dist += 12;
    // dist is 0..11. (0 means same sign 1/1)
    // Rel Positions:
    // 0: 1/1 (Good)
    // 1: 2/12 (Bad - Girl is 2nd from Boy)
    // 2: 3/11 (Good)
    // 3: 4/10 (Good)
    // 4: 5/9 (Good - User Check: "5/9 is good")
    // 5: 6/8 (Bad)
    // 6: 1/7 (Good)
    // 7: 8/6 (Bad - Girl is 8th from Boy)
    // 8: 9/5 (Good)
    // 9: 10/4 (Good)
    // 10: 11/3 (Good)
    // 11: 12/2 (Bad - Girl is 12th from Boy)
    
    const BAD_DISTS = [1, 5, 7, 11]; // 2nd, 6th, 8th, 12th relative positions (0-based)
    // 0-based: 1=2nd, 5=6th, 7=8th, 11=12th
    
    let bhakootScore = 7;
    if (BAD_DISTS.includes(dist)) bhakootScore = 0;

    scores.push({ name: 'Bhakoot', score: bhakootScore, maxScore: 7, description: bhakootScore ? 'Good' : 'Bad', isCompatible: bhakootScore > 0 });

    // 8. Nadi (8 Points)
    const boyN = NADI_TABLE[boyStar];
    const girlN = NADI_TABLE[girlStar];
    const nadiScore = (boyN !== girlN) ? 8 : 0;
    scores.push({ name: 'Nadi', score: nadiScore, maxScore: 8, description: nadiScore ? 'Good' : 'Bad', isCompatible: nadiScore > 0 });

    const total = scores.reduce((a, b) => a + b.score, 0);
    
    return {
        system: 'AshtaKuta',
        totalScore: total,
        maxScore: 36,
        isCompatible: total >= 18,
        matches: scores
    };
}
