
import { TransitEngine } from '../../src/predictive/transits.js';
import { EphemerisEngine, PlanetPosition } from '../../src/engine/ephemeris.js';
import { DateTime } from 'luxon';

// Mock Ephemeris that simulates movement
class MockEphemeris extends EphemerisEngine {
    constructor() {
        super();
    }
    
    // Override getPlanets to return simulated data
    public getPlanets(date: DateTime, location: any, ayanamsa: number, topo: boolean): PlanetPosition[] {
        // Base date: 2024-04-10. Sun at 357.
        // Move 1 degree per day.
        const baseDate = DateTime.fromISO('2024-04-10T00:00:00Z');
        const diffDays = date.diff(baseDate, 'days').days;
        
        let sunLon = 357 + diffDays;
        sunLon = sunLon % 360; 
        if (sunLon < 0) sunLon += 360;

        return [
            { id: 0, name: 'Sun', longitude: sunLon, latitude: 0, distance: 1, speed: 1 }
        ];
    }
}

describe('Transit Engine', () => {
    let engine: TransitEngine;

    beforeAll(() => {
        const mockEph = new MockEphemeris();
        engine = new TransitEngine(mockEph);
    });

    test('Detects Sun Sign Ingress (Pisces -> Aries)', async () => {
        // Start: April 10 (357 deg = Pisces).
        // End: April 15.
        // Day 0 (Apr 10): 357 (Pisces)
        // Day 1 (Apr 11): 358 (Pisces)
        // Day 2 (Apr 12): 359 (Pisces)
        // Day 3 (Apr 13): 0 (Aries) -> Ingress!
        
        const start = DateTime.fromISO('2024-04-10T00:00:00Z');
        const end = DateTime.fromISO('2024-04-15T00:00:00Z');
        
        const transits = await engine.findTransits(0, start, end, 6); // 6h steps
        
        // Should find Sign change (11 -> 0)
        const ariesIngress = transits.find(t => t.type === 'Sign' && t.newValue === 0);
        
        expect(ariesIngress).toBeDefined();
        // Expect detected time to be around Day 3 (Apr 13)
        // Since we step 6 hours: 
        // Day 3 00:00 -> 360 (0). 
        // Logic detects change from prev step.
        expect(ariesIngress?.prevValue).toBe(11); // Pisces
        expect(ariesIngress?.newValue).toBe(0); // Aries
        // Allow 12 or 13 depending on floating point precision in mock
        expect(ariesIngress?.time.day).toBeGreaterThanOrEqual(12);
        expect(ariesIngress?.time.day).toBeLessThanOrEqual(13);
    });
});
