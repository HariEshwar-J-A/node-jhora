
import { calculateVarga, calculateD60 } from '../../src/vedic/vargas.js';
import { VargaDeities } from '../../src/vedic/deities.js';

describe('Advanced Varga Precision', () => {

    describe('D2 Hora (Parivritti Even-Reverse)', () => {
        test('Aries 10° → Aries (sign 1)', () => {
            // Aries (signIdx=0, even). hora=0 → targetIdx=(0*2+0)%12=0 → Aries
            const val = calculateVarga(10, 2, 'Parashara');
            expect(val.sign).toBe(1); // Aries
        });
        test('Aries 20° → Taurus (sign 2)', () => {
            // Aries (signIdx=0, even). hora=1 → targetIdx=(0*2+1)%12=1 → Taurus
            const val = calculateVarga(20, 2, 'Parashara');
            expect(val.sign).toBe(2); // Taurus
        });
        test('Taurus 10° → Cancer (sign 4)', () => {
            // Taurus (signIdx=1, odd). hora=0 → targetIdx=(1*2+(1-0))%12=3 → Cancer
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
