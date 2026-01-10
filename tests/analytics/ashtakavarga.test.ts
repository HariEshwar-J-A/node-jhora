
import { Ashtakavarga } from '../../src/analytics/ashtakavarga.js';

describe('Ashtakavarga System', () => {

    test('Calculates BAV for Sun correctly (Simple Case)', () => {
        // Setup: All planets in Aries (Sign 1). Lagna in Aries.
        // Theoretically, we just sum up the points for House 1, 2, etc, based on "From Sun", "From Moon"...
        // Since all are in 1, checking "From Sun" (1,2,4,7...) implies Sign 1 gets point, Sign 2 gets point...
        // Checking "From Moon" (3,6,10,11) implies Sign 3 gets point...
        
        // Let's manually calculcate Sun's Points in Aries (Sign 1).
        // It's the 1st House from EVERYONE.
        // Sun rules: 0(Sun)->1? Yes. 1(Mon)->House 3 (No). 4(Mar)->1? Yes. 2(Mer)->3 (No). 
        // 5(Jup)->5 (No). 3(Ven)->6 (No). 6(Sat)->1? Yes. 99(Lag)->3 (No).
        // Donors contributing to 1st House from self: Sun, Mars, Saturn.
        // Total = 3 points in Aries for Sun's BAV.
        
        const planets = [
            { id: 0, longitude: 10 }, // Sun in Ari
            { id: 1, longitude: 10 }, // Mon in Ari
            { id: 2, longitude: 10 }, // Mer
            { id: 3, longitude: 10 }, // Ven
            { id: 4, longitude: 10 }, // Mar
            { id: 5, longitude: 10 }, // Jup
            { id: 6, longitude: 10 }, // Sat
        ];
        // Lagna = 1 (Aries)
        
        const res = Ashtakavarga.calculate(planets as any, 1);
        const sunPointsInAries = res.bav[0][0]; // Sun(0) BAV, Sign 0(Aries)
        
        // Expected: Sun(1), Mars(1), Saturn(1) = 3.
        expect(sunPointsInAries).toBe(3);
    });

    test('Calculates SAV Sum sanity check', () => {
        // Total Bindus in SAV is always 337.
        const planets = [
            { id: 0, longitude: 15 }, // Sun
            { id: 1, longitude: 100 }, // Mon (Cancer)
            { id: 2, longitude: 200 }, // Mer (Libra)
            { id: 3, longitude: 300 }, // Ven (Capricorn)
            { id: 4, longitude: 50 },  // Mar (Taurus)
            { id: 5, longitude: 150 }, // Jup (Virgo)
            { id: 6, longitude: 350 }, // Sat (Pisces)
        ];
        
        const res = Ashtakavarga.calculate(planets as any, 1);
        const savTotal = res.sav.reduce((a, b) => a + b, 0);
        
        // 337 is the standard total for complete Ashtakavarga.
        expect(savTotal).toBe(337);
    });
});
