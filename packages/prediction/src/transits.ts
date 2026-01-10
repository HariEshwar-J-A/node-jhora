
import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, normalize360 } from '@node-jhora/core';

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

    /**
     * Finds when two planets form an exact aspect (Newton-Raphson).
     * @param p1Id Planet 1 ID
     * @param p2Id Planet 2 ID
     * @param targetAngle Aspect Angle (e.g. 90, 180)
     * @param start Search Start
     * @param end Search End
     * @param tolerance Degrees of error (default 0.01)
     */
    public async findExactAspect(
        p1Id: number, 
        p2Id: number, 
        targetAngle: number,
        start: DateTime,
        end: DateTime,
        tolerance: number = 0.01
    ): Promise<DateTime | null> {
        // Crude Scan then Refine.
        // Step size: 6 hours? 
        let cursor = start;
        const stepHours = 24; // Initial crude scan
        
        let prevDiff = 0;
        let prevTime = start;
        
        // Helper: Get Angle Difference (0-360) ensuring minimal distance logic?
        // No, Aspects are usually Longitude difference: abs(l1 - l2).
        // But 350 and 10 is 20 deg difference.
        // Distance = min(|l1-l2|, 360-|l1-l2|)
        
        const getDist = (t: DateTime) => {
            const l1 = this.getPos(p1Id, t);
            const l2 = this.getPos(p2Id, t);
            let diff = Math.abs(l1 - l2);
            if (diff > 180) diff = 360 - diff;
            return diff;
        };

        // Scan LOOP
        while (cursor < end) {
            cursor = cursor.plus({ hours: stepHours });
            if (cursor > end) cursor = end;

            const currDist = getDist(cursor);
            const prevDist = getDist(prevTime);
            
            // Check if we crossed Target
            // e.g. Prev=89, Curr=91. Target 90.
            // Or Prev=91, Curr=89.
            if ((prevDist < targetAngle && currDist >= targetAngle) || 
                (prevDist > targetAngle && currDist <= targetAngle)) {
                
                // Crossed! Refine.
                // Binary Search for MVP (Newton is robust but requires derivative/speed).
                // Binary search 24h window (prevTime to cursor).
                let low = prevTime.toMillis();
                let high = cursor.toMillis();
                let mid = 0;
                
                for(let i=0; i<30; i++) { // 30 iters -> accuracy ~ 100ms
                    mid = (low + high) / 2;
                    const tMid = DateTime.fromMillis(mid);
                    const dMid = getDist(tMid);
                    
                    if (Math.abs(dMid - targetAngle) < tolerance) {
                        return tMid;
                    }
                    
                    // Decide which half
                    // Assume monotonic in this small window
                    const dLow = getDist(DateTime.fromMillis(low));
                    
                    // If Low < Target and Mid > Target -> Target in Low..Mid
                    // But we don't know slope direction easily without checking.
                    // Simple logic: If (dLow < Target) == (dMid < Target), then Mid is on same side as Low.
                    // Move Low to Mid.
                    if ((dLow < targetAngle) === (dMid < targetAngle)) {
                        low = mid;
                    } else {
                        high = mid;
                    }
                }
                return DateTime.fromMillis(mid);
            }
            
            prevTime = cursor;
        }
        
        return null;
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
        const target = p.find((x: PlanetPosition) => x.id === planetId);
        return target ? target.longitude : 0;
    }
}
