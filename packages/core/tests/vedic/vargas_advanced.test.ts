
import { calculateVarga, calculateD60 } from '../../src/vedic/vargas.js';
import { VargaDeities } from '../../src/vedic/deities.js';

describe('Advanced Varga Precision', () => {

    describe('D2 Hora — BPHS (default) vs Parivritti', () => {
        // BPHS puts every Hora in Leo or Cancer. The previous implementation
        // spread them across all twelve signs, which came from PyJHora's
        // parivritti_even_reverse rather than from Parashara.
        test('Aries 10° → Leo under BPHS', () => {
            expect(calculateVarga(10, 2).sign).toBe(5);
        });
        test('Aries 20° → Cancer under BPHS', () => {
            expect(calculateVarga(20, 2).sign).toBe(4);
        });
        test('Taurus 10° → Cancer under BPHS (even sign reverses)', () => {
            expect(calculateVarga(40, 2).sign).toBe(4);
        });

        test('the variant is still reachable and still differs', () => {
            expect(calculateVarga(10, 2, { horaScheme: 'parivritti' }).sign).toBe(1);
            expect(calculateVarga(20, 2, { horaScheme: 'parivritti' }).sign).toBe(2);
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
