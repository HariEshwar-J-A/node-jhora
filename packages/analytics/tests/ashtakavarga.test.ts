import { Ashtakavarga, AshtakavargaResult } from '../src/index.js';
import { EphemerisEngine, PlanetPosition } from '@node-jhora/core';
import { DateTime } from 'luxon';

describe('Ashtakavarga System', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
    });

    test('SAV Total points must be exactly 337', () => {
        // Sample Chart: Jan 1 2000 12:00 UTC
        const date = DateTime.fromObject({ year: 2000, month: 1, day: 1, hour: 12 }, { zone: 'utc' });
        const location = { latitude: 13.0827, longitude: 80.2707 }; // Chennai
        
        const planets = engine.getPlanets(date, location, 1, false);

        // Add Lagna (ID 99) as a mock planet for rules
        // In a real app, this comes from calculateHouseCusps.ascendant
        const lagnaPos: PlanetPosition = {
            id: 99,
            name: 'Lagna',
            longitude: 10, // Mock Aries
            latitude: 0,
            distance: 0,
            speed: 0,
            isRetrograde: false
        };
        planets.push(lagnaPos);

        const result: AshtakavargaResult = Ashtakavarga.calculateSAV(planets);

        // Validation Checksum
        const totalBindus = result.sav.reduce((sum, current) => sum + current, 0);
        expect(totalBindus).toBe(337);
        expect(result.sav.length).toBe(12);
    });

    test('BAV Calculation logic for Sun', () => {
        // Create Mock Planets where all are in Aries (0-30)
        const mockPlanets: PlanetPosition[] = [0, 1, 2, 3, 4, 5, 6, 99].map(id => ({
            id,
            name: id === 99 ? 'Lagna' : 'Planet',
            longitude: 1, // All in Aries
            latitude: 0,
            distance: 0,
            speed: 0,
            isRetrograde: false
        }));

        const bav = Ashtakavarga.calculateBAV(mockPlanets, 0); // Sun
        
        // Sun from Sun (0): 1, 2, 4, 7, 8, 9, 10, 11
        // Since all donors in Sign 0 (Aries), 
        // Sun should give points to Signs: 0, 1, 3, 6, 7, 8, 9, 10
        // Let's verify index 0 (Aries) has point from Sun-Sun rule.
        expect(bav[0]).toBeGreaterThan(0);
    });
});
