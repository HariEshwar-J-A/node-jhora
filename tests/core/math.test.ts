import { normalize360, getShortestDistance, dmsToDecimal, decimalToDms, midpoint } from '../../src/core/math.js';

describe('Math Core (First Principles)', () => {
    describe('normalize360', () => {
        test('handles positive angles within range', () => {
            expect(normalize360(45)).toBe(45);
            expect(normalize360(0)).toBe(0);
        });

        test('handles angles > 360', () => {
            expect(normalize360(370)).toBe(10);
            expect(normalize360(720)).toBe(0);
        });

        test('handles negative angles', () => {
            expect(normalize360(-10)).toBe(350);
            expect(normalize360(-370)).toBe(350);
        });
    });

    describe('getShortestDistance', () => {
        test('calculates simple distance', () => {
            expect(getShortestDistance(10, 20)).toBe(10);
        });

        test('calculates distance crossing 360/0', () => {
            expect(getShortestDistance(350, 10)).toBe(20);
        });

        test('handles large distances', () => {
            // 10 to 200 is 190 deg one way, 170 deg the other way (shortest)
            expect(getShortestDistance(10, 200)).toBe(170);
        });
    });

    describe('DMS Conversion', () => {
        test('dmsToDecimal', () => {
            expect(dmsToDecimal(10, 30, 0)).toBe(10.5);
            expect(dmsToDecimal(-10, 30, 0)).toBe(-10.5);
        });

        test('decimalToDms', () => {
            const res = decimalToDms(10.5);
            expect(res.d).toBe(10);
            expect(res.m).toBe(30);
            expect(res.s).toBeCloseTo(0);
        });
    });

    describe('midpoint', () => {
        test('calculates simple midpoint', () => {
            expect(midpoint(10, 30)).toBe(20);
        });

        test('calculates midpoint crossing 0', () => {
            // 350 and 10. Midpoint should be 0 (360)
            expect(midpoint(350, 10)).toBe(0);

            // 340 and 20. Midpoint 0.
            expect(midpoint(340, 20)).toBe(0);

            // 350 and 0. Midpoint 355.
            expect(midpoint(350, 0)).toBe(355);
        });
    });
});
