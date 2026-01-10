
import { EphemerisEngine, PlanetPosition } from './ephemeris.js';
import { DateTime } from 'luxon';

interface PlanetSnapshot {
    time: number; // toMillis
    positions: Float32Array; // [SunLon, MoonLon, ..., SatLon]
}

export class EphemerisInterpolator {
    private snapshots: PlanetSnapshot[] = [];
    private ephemeris: EphemerisEngine;
    private stepMs: number;
    
    // Cache bounds
    private startTime: number = 0;
    private endTime: number = 0;

    constructor(ephemeris?: EphemerisEngine) {
        this.ephemeris = ephemeris || EphemerisEngine.getInstance();
    }

    /**
     * Pre-calculates positions for a time range.
     * @param start Start Time
     * @param end End Time
     * @param stepHours Step size in hours (default 24h for slow, 1h for fast?)
     *                  For 60fps UI, we might need 6h steps and Cubic Spline, but Linear on 12h is decent.
     */
    public async cacheRange(start: DateTime, end: DateTime, stepHours: number = 24): Promise<void> {
        this.snapshots = [];
        this.startTime = start.toMillis();
        this.endTime = end.toMillis();
        this.stepMs = stepHours * 3600 * 1000;

        let cursor = start;
        const targetIds = [0, 1, 2, 3, 4, 5, 6, 8, 9]; // Sun..Sat, Rahu, Ketu
        
        // Loop and fill
        while (cursor <= end) {
            // Get Planest sync? Ephemeris usually cache friendly?
            // EphemerisEngine.getPlanets is the call.
            const planets = this.ephemeris.getPlanets(cursor, { latitude: 0, longitude: 0 }, 1, true); // Topo?
            
            // Store compacted
            // Map ID to index specific? 
            // Let's store compact array: index 0=Sun, 1=Moon...
            // Or better, Map ID -> Lon.
            // For perf, fixed index array is best.
            // 0=Sun, 1=Moon, 2=Mer, 3=Ven, 4=Mar, 5=Jup, 6=Sat, 7=Rahu, 8=Ketu.
            const pArr = new Float32Array(9);
            
            // Map:
            const getIdIdx = (id: number) => {
                if (id <= 6) return id;
                if (id === 8) return 7; // Rahu
                if (id === 9) return 8; // Ketu
                return -1;
            };

            planets.forEach(p => {
                const idx = getIdIdx(p.id);
                if (idx >= 0) pArr[idx] = p.longitude;
            });

            this.snapshots.push({
                time: cursor.toMillis(),
                positions: pArr
            });

            cursor = cursor.plus({ hours: stepHours });
        }
    }

    /**
     * Gets interpolated positions for a specific time.
     * @param time DateTime
     */
    public getFrame(time: DateTime): PlanetPosition[] {
        const t = time.toMillis();
        if (t < this.startTime || t > this.endTime) {
            // Out of bounds - Fallback or Error?
            // Fallback to real engine (slow but works)
            return this.ephemeris.getPlanets(time, { latitude: 0, longitude: 0 }, 1, true);
        }

        // Find indices
        // Index = (t - start) / step
        const fractionalIndex = (t - this.startTime) / this.stepMs;
        const i1 = Math.floor(fractionalIndex);
        const i2 = i1 + 1;
        
        if (i1 >= this.snapshots.length - 1) {
            // End of range
            return this.unpack(this.snapshots[this.snapshots.length - 1].positions);
        }

        const s1 = this.snapshots[i1];
        const s2 = this.snapshots[i2];
        
        const ratio = fractionalIndex - i1; // 0..1

        // Interpolate
        const result = new Float32Array(9);
        for (let i = 0; i < 9; i++) {
            let v1 = s1.positions[i];
            let v2 = s2.positions[i];
            
            // Handle 360 wrap
            // ex: 359 -> 1. Diff is 2. 
            // if v2-v1 < -180 (359 to 1: -358), then v2 += 360 (361).
            // if v2-v1 > 180 (1 to 359: 358), then v1 += 360 (361).
            if (v2 - v1 < -180) v2 += 360;
            else if (v2 - v1 > 180) v1 += 360;
            
            let val = v1 + (v2 - v1) * ratio;
            if (val >= 360) val -= 360;
            if (val < 0) val += 360;
            
            result[i] = val;
        }

        return this.unpack(result);
    }

    private unpack(arr: Float32Array): PlanetPosition[] {
        // Reconstruct PlanetPosition objects
        // 0=Sun, 1=Moon...
        // Names needed?
        const names = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];
        const ids = [0, 1, 2, 3, 4, 5, 6, 8, 9];
        
        return ids.map((id, idx) => ({
            id,
            name: names[idx],
            longitude: arr[idx],
            speed: 0, // Interpolated speed not calc
            latitude: 0,
            distance: 0
        }));
    }
}
