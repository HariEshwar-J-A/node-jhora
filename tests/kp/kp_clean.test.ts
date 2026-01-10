
import { KPSubLord } from '../../src/kp/sublord.js';
import { KPRuling } from '../../src/kp/ruling.js';

describe('KP System (Clean Room)', () => {

    describe('Sub-Lord Calculation', () => {
        
        test('Ashwini (0 deg) -> Ketu Star, Ketu Sub', () => {
            // 0 - 13.33 deg = Ashwini (Ketu Star).
            // First sub of Ketu Star is Ketu.
            const sig = KPSubLord.calculateKPSignificators(0);
            expect(sig.signLord).toBe(4); // Mars (Aries)
            expect(sig.starLord).toBe(8); // Ketu
            expect(sig.subLord).toBe(8);  // Ketu
            expect(sig.subSubLord).toBe(8); // Ketu
        });

        test('Transition Point check (Near 13.333)', () => {
            // End of Ashwini is 13deg 20m = 13.3333.
            // Next is Bharani (Venus Star).
            // Let's check 13.5 degrees (should be Venus Star).
            const sig = KPSubLord.calculateKPSignificators(13.5);
            expect(sig.signLord).toBe(4); // Mars (Aries)
            expect(sig.starLord).toBe(3); // Venus (Bharani)
            // First sub of Venus Star is Venus.
            expect(sig.subLord).toBe(3); 
        });

        test('Sign Lord check (Leo)', () => {
            // 125 degrees -> Leo (120-150). Lord Sun(0).
            const sig = KPSubLord.calculateKPSignificators(125);
            expect(sig.signLord).toBe(0); // Sun
        });
    });

    describe('Ruling Planets', () => {
        test('Returns correct structure', () => {
            // Asc: 0 (Ari). Mon: 0 (Ari). Day: Sun(0).
            const rp = KPRuling.calculateRulingPlanets(0, 0, 0);
            expect(rp.lagnaSignLord).toBe(4); // Mars
            expect(rp.lagnaStarLord).toBe(8); // Ketu
            expect(rp.moonSignLord).toBe(4); // Mars
            expect(rp.dayLord).toBe(0); // Sun
        });
    });

});
