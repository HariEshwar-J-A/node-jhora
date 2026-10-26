import { Body, BODY_ASHTAKAVARGA_LAGNA_DONOR, EPHEMERIS_BODIES, SEVEN_GRAHAS_JHORA_ORDER } from '../../src/core/body.js';

describe('Body enum', () => {
    test('ephemeris node ids match historical API JSON', () => {
        expect(Body.Rahu).toBe(10);
        expect(Body.Ketu).toBe(99);
        expect(BODY_ASHTAKAVARGA_LAGNA_DONOR).toBe(99);
    });

    test('seven grahas use Swiss-style classical ids 0–6', () => {
        expect(SEVEN_GRAHAS_JHORA_ORDER).toEqual([0, 1, 4, 2, 5, 3, 6]);
        expect(EPHEMERIS_BODIES).toHaveLength(9);
        expect(EPHEMERIS_BODIES.at(-2)).toBe(Body.Rahu);
        expect(EPHEMERIS_BODIES.at(-1)).toBe(Body.Ketu);
    });
});
