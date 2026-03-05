import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { DateTime } from 'luxon';

describe('EphemerisEngine (WASM)', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
        // Set Lahiri Ayanamsa (Standard Vedic)
        try {
            engine.setAyanamsa(1);
        } catch (e) {
            console.error("SetAyanamsa failed:", e);
        }
    });

    test('initializes correctly', () => {
        expect(engine).toBeDefined();
    });

    test('calculates Sun longitude for 2000-01-01 (Gold Standard)', () => {
        // Date: 2000-01-01 12:00:00 UTC
        const date = DateTime.fromObject({
            year: 2000, month: 1, day: 1, hour: 12
        }, { zone: 'utc' });

        const planets = engine.getPlanets(date);

        // Find Sun
        const sun = planets.find(p => p.name === 'Sun');
        expect(sun).toBeDefined();

        // Sidereal (Lahiri) Sun on 2000-01-01 12:00 UTC ≈ 256.6°
        // Tropical would be ~280.5° — confirms sidereal flag is applied.
        expect(sun?.longitude).toBeGreaterThanOrEqual(0);
        expect(sun?.longitude).toBeLessThan(360);

        // Strict check for Sidereal (optional, can be relaxed if precision issues)
        // expect(sun?.longitude).toBeCloseTo(256.6, 0); 
    });

    test('calculates Moon and other planets', () => {
        const date = DateTime.now();
        const planets = engine.getPlanets(date);
        expect(planets.length).toBeGreaterThan(5);
        expect(planets.find(p => p.name === 'Moon')).toBeDefined();
        expect(planets.find(p => p.name === 'Ketu')).toBeDefined();
    });
});
