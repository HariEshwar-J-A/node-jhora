
import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition } from '../engine/ephemeris.js';
import { normalize360 } from '../core/math.js';

export interface TransitEvent {
    planetId: number;
    type: 'Sign' | 'Nakshatra';
    prevValue: number; // Previous Sign/Nakshatra index
    newValue: number;  // New Sign/Nakshatra index
    time: DateTime;    // Time of ingress
}

export class TransitEngine {
    private ephemeris: EphemerisEngine;

    constructor(ephemeris?: EphemerisEngine) {
        // Use singleton if not provided, assuming it's initialized
        this.ephemeris = ephemeris || EphemerisEngine.getInstance();
    }

    /**
     * Finds transit events for a planet within a time range.
     * @param planetId Planet ID (0=Sun...6=Saturn)
     * @param start Start Time
     * @param end End Time
     * @param stepHours Scanning resolution (default 24h for slow planets, 1h for fast)
     */
    public async findTransits(
        planetId: number,
        start: DateTime,
        end: DateTime,
        stepHours: number = 24
    ): Promise<TransitEvent[]> {
        const events: TransitEvent[] = [];
        
        let cursor = start;
        // Get initial state
        let prevPos = this.getPos(planetId, cursor);
        let prevSign = Math.floor(prevPos / 30);
        let prevNak = Math.floor(prevPos / (13 + 1/3));

        while (cursor < end) {
            cursor = cursor.plus({ hours: stepHours });
            if (cursor > end) cursor = end;

            const currPos = this.getPos(planetId, cursor);
            const currSign = Math.floor(currPos / 30);
            const currNak = Math.floor(currPos / (13 + 1/3));

            // Check Sign Change
            if (currSign !== prevSign) {
                // refine time? For MVP, we use the step time. 
                // To be "Best", we should binary search the exact ingress time.
                // TODO: specific binary search refinement here.
                events.push({
                    planetId,
                    type: 'Sign',
                    prevValue: prevSign,
                    newValue: currSign,
                    time: cursor
                });
                prevSign = currSign;
            }

            // Check Nakshatra Change
            if (currNak !== prevNak) {
                events.push({
                    planetId,
                    type: 'Nakshatra',
                    prevValue: prevNak,
                    newValue: currNak,
                    time: cursor
                });
                prevNak = currNak;
            }
            
            prevPos = currPos;

            if (cursor >= end) break;
        }

        return events;
    }

    // Helper: synchronous fetch from cached engine? 
    // EphemerisEngine.getPlanets is technically blocking WASM call (if loaded).
    // But getPlanets signature is not async in our code? 
    // Let's check `src/engine/ephemeris.ts`.
    // It calls `this.swe.swe_calc_ut`. If WASM is loaded, it's synchronous.
    // However, our `getPlanets` takes (date, location). We just need Geocentric or Topo?
    // Transits are usually Geocentric.
    private getPos(planetId: number, time: DateTime): number {
        // Mock location for Geocentric (0,0)? Or reuse standard call.
        // We need a specific `getPlanetPosition(planetId, time)` method in Ephemeris or just use `getPlanets`.
        // Using `getPlanets` is expensive (calcs ALL planets).
        // Optimization: Use `calc_ut` directly if possible, or filtered getPlanets.
        // For now, use getPlanets for API consistency.
        const planets = this.ephemeris.getPlanets(time, { latitude: 0, longitude: 0 }, 0, false); // Sayana/Tropical or Lahiri?
        // Transits in Vedic are Sidereal (Lahiri). So ayanamsaOrder = 1.
        
        // Wait, `getPlanets` takes `ayanamsaOrder`.
        // Let's use Lahiri (1).
        const p = this.ephemeris.getPlanets(time, { latitude: 0, longitude: 0 }, 1, false);
        const target = p.find(x => x.id === planetId);
        return target ? target.longitude : 0;
    }
}
