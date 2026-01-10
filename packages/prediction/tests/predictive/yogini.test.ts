
import { YoginiDasha } from '../../src/yogini.js';
import { DateTime } from 'luxon';

describe('Yogini Dasha', () => {
    test('Calculates Correct Start Dasha for Ashwini (0 deg)', () => {
        // Ashwini(0). Index 0. 
        // Formula: (0 + 1 + 3) % 8 = 4 (Bhramari/Mars)??
        // Wait, logic in code: (0 + 1 + 3) % 8 = 4. 4th Yogini is Bhramari?
        // Yoginis: 1=Mangala, 2=Pingala, 3=Dhanya, 4=Bhramari.
        // Yes.
        // Let's verify standard: 
        // Ashwini is ruled by Ketu. Yogini?
        // Some sources say Ashwini starts with Mangala. Some say Bhramari.
        // BPHS: "Add 3 to Nakshatra... divide by 8".
        // If Nakshatra 1 (Ashwini). 1+3=4. Remainder 4. 4th is Bhramari.
        // So Ashwini starts in Bhramari. Correct.
        
        const birthDate = DateTime.fromISO('2000-01-01T00:00:00Z');
        const dashas = YoginiDasha.calculate(0.001, birthDate);
        
        expect(dashas[0].planet).toBe('Bhramari');
        expect(dashas[0].lord).toBe('Mars');
    });

    test('Calculates Correct Start Dasha for Rohini (Index 3)', () => {
        // Rohini is 4th Nakshatra (Index 3).
        // (3 + 1 + 3) = 7. 7th is Siddha.
        // Rohini (Moon) -> Siddha (Venus).
        
        // Rohini spans 40deg - 53.33deg.
        // Midpoint 46 deg.
        const birthDate = DateTime.fromISO('2000-01-01T00:00:00Z');
        const dashas = YoginiDasha.calculate(46, birthDate);
        
        expect(dashas[0].planet).toBe('Siddha');
    });

    test('Generates Full Cycle', () => {
        const birthDate = DateTime.fromISO('2000-01-01T00:00:00Z');
        const dashas = YoginiDasha.calculate(0, birthDate, 40); // 40 years covers > 36
        
        // Check Sequence: Bhramari(4) -> Bhadrika(5) -> Ulka(6) -> Siddha(7) -> Sankata(8) -> Mangala(1)...
        // Indices: 3 -> 4 -> 5 -> 6 -> 7 -> 0
        expect(dashas[0].planet).toBe('Bhramari');
        expect(dashas[1].planet).toBe('Bhadrika');
        expect(dashas[5].planet).toBe('Mangala');
    });
});
