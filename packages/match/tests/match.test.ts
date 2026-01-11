import { calculateAshtaKuta } from '../src/kuta/north.js';
import { calculateDashaKuta } from '../src/kuta/south.js';
import { checkMangalDosha } from '../src/dosha/mangal.js';

describe('Marriage Matching Engine', () => {

    // Test Data
    // Ashwini (0), Aries (Sign 1)
    // Bharani (1), Aries (Sign 1)
    
    // Ashta Kuta Test
    test('calculateAshtaKuta: Ashwini boy + Bharani girl (Good)', () => {
        // Boy: Ashwini (0), Aries (1)
        // Girl: Bharani (1), Aries (1)
        const result = calculateAshtaKuta(0, 1, 1, 1);
        
        // Expected Logic:
        // Varna: Both Kshatriya (1). Same = 1/1.
        // Vashya: Both Chatuspada. 2/2.
        // Tara: Girl(1) to Boy(0). Dist = 0-1+1 = 0(27). 27%9=0. Good (3/3).
        // Yoni: Horse(0) vs Elephant(1). Enemy (0)? Or 2? 
        // Yoni Matrix[0][1] = 2.
        // Maitri: Sun vs Sun? No Lord of Aries is Mars. Mars vs Mars = Friend (5/5).
        // Gana: Deva (Ash) vs Manushya (Bha). D-M = 6/6.
        // Bhakoot: Same Sign (1/1). Rel Pos 0. Good (7/7).
        // Nadi: Ash (Adi) vs Bha (Madhya). Diff (8/8).
        // Total: 1+2+3+2+5+6+7+8 = 34?
        
        expect(result.system).toBe('AshtaKuta');
        expect(result.isCompatible).toBe(true);
        expect(result.totalScore).toBeGreaterThan(25);
        expect(result.matches.find(m => m.name === 'Nadi')?.score).toBe(8);
    });

    // Nadi Dosha Test
    test('calculateAshtaKuta: Ashwini boy + Ashwini girl (Nadi Dosha)', () => {
        const result = calculateAshtaKuta(0, 0, 1, 1);
        // Nadi: Both Adi. Score 0.
        const nadi = result.matches.find(m => m.name === 'Nadi');
        expect(nadi?.score).toBe(0);
    });

    // South Kuta Test
    test('calculateDashaKuta: Ashwini boy + Bharani girl', () => {
        const result = calculateDashaKuta(0, 1, 1, 1);
        
        expect(result.system).toBe('DashaKuta');
        // Dinam: G(1)->B(0) = 27. Rem 0. Good.
        // Rajju:
        // Ashwini(0): Group 0, Pos 0.
        // Bharani(1): Group 0, Pos 1.
        // Group logic: floor(0/5)=0. Even. return pos=0. -> Boy Rajju 0.
        // Girl: floor(1/5)=0. Even. return pos=1. -> Girl Rajju 1.
        // Different -> Good.
        expect(result.isRajjuMismatch).toBe(false); 
        expect(result.isCompatible).toBe(true);
        expect(result.totalScore).toBeGreaterThan(15);
    });
    
    // Rajju Mismatch Test
    test('calculateDashaKuta: Rajju Mismatch', () => {
        // Ashwini (0) -> Group 0, Pos 0 -> Rajju 0.
        // Magha (9) -> Group 1, Pos 4. Odd. return 4-4=0. -> Rajju 0.
        // Same Rajju (Shiro) -> Bad.
        // Signs: Ashwini->Aries(1). Magha->Leo(5). 5/9 Axis (usually good Rasi but Rajju Bad).
        
        const result = calculateDashaKuta(0, 9, 1, 5);
        expect(result.isRajjuMismatch).toBe(true);
        expect(result.isCompatible).toBe(false);
    });

    // Mangal Dosha Test
    test('Mangal Dosha: Mars in 7th', () => {
        // Mock Chart (Simplified)
        const planets = [
            { id: 2, longitude: 185, speed: 1 } as any // Mars in Libra (185/30 = 6.1 -> 7th Sign)
        ]; 
        const houses = { ascendant: 5 } as any; // Asc Aries (5 deg) -> 1st Sign.
        
        // Mars in Libra(7) from Lagna Aries(1). 7th House. = Dosha.
        // Exceptions? Libra is not exception.
        
        const result = checkMangalDosha({ planets, houses }, { planets: [], houses: { ascendant: 0 } as any });
        // Boy has Dosha. Girl empty (No Mars) -> No Dosha.
        // Result: Present.
        
        expect(result.boyHasDosha).toBe(true);
        expect(result.girlHasDosha).toBe(false);
        expect(result.matchStatus).toBe('Present');
    });

    // Mangal Exception Test
    test('Mangal Dosha: Exception (Mars in Aries)', () => {
        const planets = [
            { id: 2, longitude: 10, speed: 1 } as any // Mars in Aries (1st Sign)
        ];
        // From Lagna Aries -> Mars in 1st. Usually Dosha.
        // But Mars in Aries is Own House -> Cancellation.
        
        const houses = { ascendant: 5 } as any;
        
        const result = checkMangalDosha({ planets, houses }, { planets: [], houses } );
        // Should be Cancelled -> hasDosha = false.
        
        expect(result.boyHasDosha).toBe(false);
    });

});
