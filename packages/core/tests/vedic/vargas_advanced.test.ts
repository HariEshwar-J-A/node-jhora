
import { calculateVarga, calculateD60 } from '../../src/vedic/vargas.js';
import { VargaDeities } from '../../src/vedic/deities.js';

describe('Advanced Varga Precision', () => {

    describe('D2 Hora (Parashara)', () => {
        test('Odd Sign (Aries 10deg) -> Sun Hora (Leo)', () => {
            // Aries (Odd). 1st Half (0-15). Rule: Sun (Leo).
            const val = calculateVarga(10, 2, 'Parashara');
            expect(val.sign).toBe(5); // Leo
        });
        test('Odd Sign (Aries 20deg) -> Moon Hora (Cancer)', () => {
            // Aries (Odd). 2nd Half (15-30). Rule: Moon (Can).
            const val = calculateVarga(20, 2, 'Parashara');
            expect(val.sign).toBe(4); // Cancer
        });
        test('Even Sign (Taurus 10deg) -> Moon Hora (Cancer)', () => {
            // Taurus (Even). 1st Half. Rule: Moon (Can).
            const val = calculateVarga(40, 2, 'Parashara'); // 30+10
            expect(val.sign).toBe(4); // Cancer
        });
    });

    describe('D3 Drekkana (Parashara)', () => {
        test('1st Drekkana (Aries 5deg) -> Aries (1)', () => {
            const val = calculateVarga(5, 3, 'Parashara');
            expect(val.sign).toBe(1);
        });
        test('2nd Drekkana (Aries 15deg) -> Leo (5)', () => {
            // 5th from Aries = Leo.
            const val = calculateVarga(15, 3, 'Parashara');
            expect(val.sign).toBe(5);
        });
        test('3rd Drekkana (Aries 25deg) -> Sagittarius (9)', () => {
            // 9th from Aries = Sag.
            const val = calculateVarga(25, 3, 'Parashara');
            expect(val.sign).toBe(9);
        });
    });

    describe('D60 Deities', () => {
        test('Odd Sign (Aries 0.2deg) -> 1st Deity (Ghor)', () => {
            // 0-0.5 is index 0.
            const deity = VargaDeities.getD60Deity(0.2);
            expect(deity).toBe('Ghor');
        });

        test('Even Sign (Taurus 0.2deg) -> Last Deity (Chandrarekha/Indu?)', () => {
            // Taurus (Even). 0-0.5.
            // Reverse order. Index 0 becomes Index 59.
            // List[59] = Chandrarekha
            const deity = VargaDeities.getD60Deity(30.2);
            expect(deity).toBe('Chandrarekha');
        });
    });
});
