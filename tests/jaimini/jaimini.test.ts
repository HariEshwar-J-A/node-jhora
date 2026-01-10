
import { JaiminiCore } from '../../src/jaimini/core.js';
import { JaiminiDashas } from '../../src/jaimini/dashas.js';

describe('Jaimini System', () => {

    describe('Karakas', () => {
        test('Calculates AK correctly (Highest Degree)', () => {
            const planets: any[] = [
                { id: 0, longitude: 10 }, // Sun 10
                { id: 1, longitude: 28 }, // Moon 28 (AK)
                { id: 2, longitude: 5 }
            ];
            const karakas = JaiminiCore.calculateCharaKarakas(planets);
            expect(karakas[0].karaka).toBe('AK');
            expect(karakas[0].planetId).toBe(1); // Moon
        });

        test('Resolves Ties natural order (Sun > Moon > ...)', () => {
            const planets: any[] = [
                { id: 0, longitude: 15 }, // Sun
                { id: 1, longitude: 15 }, // Moon
            ];
            const karakas = JaiminiCore.calculateCharaKarakas(planets);
            // Sun Strength 7, Moon Strength 6. Sun should be AK.
            expect(karakas[0].karaka).toBe('AK');
            expect(karakas[0].planetId).toBe(0);
        });
    });

    describe('Rashi Drishti', () => {
        test('Movable (Aries) aspects Fixed (Leo, Sco, Aqu) exc Adj (Tau)', () => {
            // Aries = 0. Aspects 4(Leo), 7(Sco), 10(Aqu). No 1(Tau).
            const aspects = JaiminiCore.getRashiDrishti(0);
            expect(aspects.sort((a,b)=>a-b)).toEqual([4, 7, 10]);
        });

        test('Fixed (Taurus) aspects Movable (Can, Lib, Cap) exc Adj (Ari)', () => {
            // Tau = 1. Aspects 3(Can), 6(Lib), 9(Cap). No 0(Ari).
            const aspects = JaiminiCore.getRashiDrishti(1);
            expect(aspects.sort((a,b)=>a-b)).toEqual([3, 6, 9]);
        });

        test('Dual (Gemini) aspects Dual (Vir, Sag, Pis)', () => {
            const aspects = JaiminiCore.getRashiDrishti(2);
            expect(aspects.sort((a,b)=>a-b)).toEqual([5, 8, 11]);
        });
    });

    describe('Arudha Padas', () => {
        // Test Exception 1: Result in 1st house -> 10th
        test('Exception: Arudha falling in same house moves to 10th', () => {
            // House 1 (Aries). Lord Mars in Aries.
            // Count 1 -> 1. Count again -> 1.
            // Arudha = 1. Exception -> 10th (Capricorn).
            const al = JaiminiCore.calculateArudha(1, 0, 0);
            expect(al).toBe(9); // Capricorn index
        });

        // Test Exception 2: Result in 7th house -> 10th from 7th = 4th
        test('Exception: Arudha falling in 7th house moves to 4th', () => {
            // House 1 (Aries). Lord Mars in Libra (7th).
            // Count 1->7 = 7 signs.
            // Count 7 + (7-1) = 7+6 = 13 -> 1 (Aries).
            // Wait. Lord is in 7th. Distance = 7.
            // Destination = Lord + 6 = 7 + 6 = 13 = 1.
            // Fall is in 1st? Then apply rule 1?
            
            // Let's try Lord in 4th (Cancer).
            // Count 1->4 = 4. 
            // Dist 4 from 4 = 7 (Libra).
            // Position relative to House 1 is 7th.
            // BPHS Rule: if in 7th, move to 10th from 7th (i.e. 4th).
            const al = JaiminiCore.calculateArudha(1, 0, 3);
            expect(al).toBe(3); // Cancer index (4th)
        });
    });
    
    describe('Chara Dasha', () => {
        // Savya logic test
        test('Determines Sequence from 9th House', () => {
            // Lagna Aries(0). 9th is Sag(8) -> Group B (Reverse)?
            // My code: Group B = Reverse.
            // Sequence should be 0, 11, 10...
            const planets: any[] = [{id: 4, longitude: 0}]; // Dummy
            const dashas = JaiminiDashas.calculateCharaDasha(0, planets);
            expect(dashas[1].signIndex).toBe(11); // Pisces
        });
    });
});
