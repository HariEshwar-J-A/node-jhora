
import { EphemerisInterpolator } from '../../src/engine/interpolator.js';
import { EphemerisEngine, PlanetPosition } from '../../src/engine/ephemeris.js';
import { DateTime } from 'luxon';

// Mock Ephemeris to avoid WASM/Slow calls in unit test
class MockEphemeris extends EphemerisEngine {
    getPlanets(date: DateTime, location: any, ayanamsa: number, topo: boolean): PlanetPosition[] {
        // Return linear motion: Sun moves 1 deg/day starting at 0 on RefDate.
        const ref = DateTime.fromISO('2024-01-01T00:00:00Z');
        const diff = date.diff(ref, 'days').days;
        return [
            { id: 0, name: 'Sun', longitude: (diff % 360), speed: 1, latitude: 0, distance: 0 }
        ];
    }
}

describe('Ephemeris Interpolator', () => {
    test('Interpolates between Days', async () => {
        const mock = new MockEphemeris();
        const interpolator = new EphemerisInterpolator(mock);
        
        const start = DateTime.fromISO('2024-01-01T00:00:00Z');
        const end = DateTime.fromISO('2024-01-05T00:00:00Z');
        
        // Cache 5 days
        await interpolator.cacheRange(start, end, 24); 
        
        // Request T + 1.5 days (Should be 1.5 degrees)
        const target = start.plus({ days: 1.5 });
        const frame = interpolator.getFrame(target);
        const sun = frame.find(p => p.id === 0);
        
        expect(sun).toBeDefined();
        // Exact 1.5 ideally, floating point tolerance
        expect(sun?.longitude).toBeCloseTo(1.5, 3);
    });

    test('Handles 360 Wrap correctly', async () => {
        // If Day 1 = 359, Day 2 = 1.
        // T + 0.5 should be 0 (Aries).
        const interpolator = new EphemerisInterpolator();
        // Inject manually to avoid mock complexity?
        // Let's iterate: 359, 1.
        (interpolator as any).startTime = 0;
        (interpolator as any).endTime = 2000; // Set valid range
        (interpolator as any).stepMs = 1000;
        (interpolator as any).snapshots = [
            { time: 0, positions: new Float32Array([359, 0,0,0,0,0,0,0,0]) },
            { time: 1000, positions: new Float32Array([1, 0,0,0,0,0,0,0,0]) }
        ];
        
        // Halfway
        const res = (interpolator as any).getFrame(DateTime.fromMillis(500));
        // 359 -> 1. Short path crosses 0.
        // 359 + (2 * 0.5) = 360 = 0.
        // Expected 0.
        expect(res[0].longitude).toBeCloseTo(0, 3); 
    });
});
