
import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, normalize360 } from '@node-jhora/core';

export interface TransitEvent {
    planetId: number;
    type: 'Sign' | 'Nakshatra';
    prevValue: number; // Previous Sign/Nakshatra index
    newValue: number;  // New Sign/Nakshatra index
    time: DateTime;    // Time of ingress
}

/** Calculation settings a transit scan must share with the chart it is compared to. */
export interface TransitOptions {
    /** SE_SIDM_* code. Must match the natal chart, or every result is shifted. */
    ayanamsaOrder?: number;
    positionMode?:  'geometric' | 'apparent';
    nodeType?:      'mean' | 'true';
}

export class TransitEngine {
    private ephemeris: EphemerisEngine;
    private options: TransitOptions;

    /**
     * @param ephemeris Initialised engine; falls back to the singleton.
     * @param options   Must match the chart these transits are read against.
     *
     * The ayanamsa used to be hardcoded to Lahiri here regardless of the caller.
     * Against a True Chitrapaksha chart that shifted every longitude by 0.0203 deg,
     * which for Saturn is five hours of motion — so reported sign-ingress times
     * were five hours wrong while looking precise to the second.
     */
    constructor(ephemeris?: EphemerisEngine, options: TransitOptions = {}) {
        this.ephemeris = ephemeris || EphemerisEngine.getInstance();
        this.options = options;
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
                events.push({
                    planetId,
                    type: 'Sign',
                    prevValue: prevSign,
                    newValue: currSign,
                    // Bisect back into the step. Reporting `cursor` would place
                    // the ingress up to `stepHours` late — 24 h by default — and
                    // a date that wrong is worse than an admitted range, because
                    // it will be quoted as if exact.
                    time: this.refineIngress(planetId, cursor.minus({ hours: stepHours }), cursor, 30),
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
                    time: this.refineIngress(planetId, cursor.minus({ hours: stepHours }), cursor,
                                             13 + 1 / 3),
                });
                prevNak = currNak;
            }
            
            prevPos = currPos;

            if (cursor >= end) break;
        }

        return events;
    }

    /**
     * Bisect the moment a planet crosses a boundary of width `arc` degrees.
     *
     * The scan loop only knows the crossing happened somewhere inside the last
     * step. Without this the reported time is the end of that step, so a 24-hour
     * scan yields ingress dates up to a day late. Twenty-eight halvings of a
     * 24 h window converge to well under a second, which costs 28 ephemeris
     * evaluations — negligible next to being wrong by a day.
     *
     * Handles the 360 to 0 wrap, and returns `hi` unchanged if the boundary is
     * not actually inside the bracket (retrograde re-crossings can produce that).
     */
    private refineIngress(planetId: number, lo: DateTime, hi: DateTime, arc: number): DateTime {
        const bucket = (t: DateTime) => Math.floor(this.getPos(planetId, t) / arc);

        const startBucket = bucket(lo);
        if (bucket(hi) === startBucket) return hi;

        let a = lo;
        let b = hi;
        for (let i = 0; i < 28; i++) {
            const midMs = (a.toMillis() + b.toMillis()) / 2;
            const mid = DateTime.fromMillis(midMs, { zone: a.zone });
            if (bucket(mid) === startBucket) a = mid;
            else b = mid;
        }
        return b;
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
    /**
     * Geocentric sidereal longitude, in the caller's zodiac.
     *
     * Location is nominal: it is only consulted for topocentric places, which
     * transit work does not use.
     */
    private getPos(planetId: number, time: DateTime): number {
        const p = this.ephemeris.getPlanets(time, { latitude: 0, longitude: 0 }, {
            ayanamsaOrder: this.options.ayanamsaOrder,
            positionMode:  this.options.positionMode,
            nodeType:      this.options.nodeType,
        });
        const target = p.find((x: PlanetPosition) => x.id === planetId);
        return target ? target.longitude : 0;
    }
}
