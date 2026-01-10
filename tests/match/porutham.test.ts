
import { PoruthamMatch } from '../../src/match/porutham.js';

describe('Matchmaking (Porutham)', () => {
    
    test('Identical stars should contain excellent Gana/Yoni but fail Rajju?', () => {
        // Ashwini (0) and Ashwini (0).
        // Gana: Deva-Deva (Good).
        // Yoni: Horse-Horse (Good).
        // Rajju: Feet-Feet (BAD). Same Rajju is Dosha.
        
        const res = PoruthamMatch.match(0, 0, 1, 1);
        
        const rajju = res.matches.find(m => m.name === 'Rajju');
        expect(rajju?.isCompatible).toBe(false);
        expect(res.isRecommended).toBe(false); // Rajju fail check
    });

    test('Compatible Pair (Ashwini Boy + Bharani Girl)', () => {
        // Boy: Ashwini (0). Girl: Bharani (1).
        // Dina: (0 - 1) + 1 = 0.. +27 = 27. Good? No, count Girl to Boy.
        // Count: (0 - 1) + 1 = 0. fix: (boy - girl + 1). (0 - 1 + 1) = 0?
        // Logic: (boyNak - girlNak) + 1. If result <=0, add 27.
        // (0 - 1) = -1. +1 = 0. <=0 -> +27 = 27.
        // 27 % 9 = 0. Good.
        
        // Rajju: Ashwini(Feet) vs Bharani(Hip). Good.
        
        const res = PoruthamMatch.match(0, 1, 1, 1);
        const rajju = res.matches.find(m => m.name === 'Rajju');
        expect(rajju?.isCompatible).toBe(true);
    });
});
