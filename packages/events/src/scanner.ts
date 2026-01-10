import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, normalize360 } from '@node-jhora/core';

export interface TransitSearchConfig {
    precisionSeconds?: number;
    maxIterations?: number;
}

export class TransitScanner {
    private ephemeris: EphemerisEngine;

    constructor(ephemeris?: EphemerisEngine) {
        this.ephemeris = ephemeris || EphemerisEngine.getInstance();
    }

    /**
     * Generic Solver: Recursive Binary Search (Bisect)
     * Finds the exact moment a condition flips from false to true.
     */
    public async findEventTime(
        start: DateTime,
        end: DateTime,
        check: (date: DateTime) => boolean,
        config: TransitSearchConfig = {}
    ): Promise<DateTime | null> {
        const precision = config.precisionSeconds || 60;
        const startVal = check(start);
        const endVal = check(end);

        // If condition doesn't flip, assume no event in this window
        if (startVal === endVal) {
            return null;
        }

        let low = start.toMillis();
        let high = end.toMillis();
        let result = high;

        // Recursive or iterative binary search
        while (high - low > precision * 1000) {
            const mid = (low + high) / 2;
            const midTime = DateTime.fromMillis(mid);
            const midVal = check(midTime);

            if (midVal === startVal) {
                low = mid;
            } else {
                high = mid;
                result = mid;
            }
        }

        return DateTime.fromMillis(result);
    }

    /**
     * Precision Ingress Finder
     * Finds when a planet enters a specific sign.
     */
    public async findIngress(
        planetId: number,
        targetSignIndex: number, // 0-11
        searchStart: DateTime,
        searchEnd?: DateTime
    ): Promise<DateTime | null> {
        // Initial window: 1 month if not specified
        const end = searchEnd || searchStart.plus({ months: 1 });
        
        const check = (date: DateTime) => {
            const pos = this.getPlanetPos(planetId, date);
            const sign = Math.floor(pos.longitude / 30);
            return sign === targetSignIndex;
        };

        return this.findEventTime(searchStart, end, check);
    }

    /**
     * Automatically finds the next sign ingress based on current position and speed.
     */
    public async findNextIngress(planetId: number, startDate: DateTime): Promise<DateTime | null> {
        const pos = this.getPlanetPos(planetId, startDate);
        const currentSignIdx = Math.floor(pos.longitude / 30);
        const nextSignIdx = (currentSignIdx + (pos.speed > 0 ? 1 : -1) + 12) % 12;

        // Linear Interpolation for initial guess
        const distToBoundary = pos.speed > 0
            ? (currentSignIdx + 1) * 30 - pos.longitude
            : pos.longitude - currentSignIdx * 30;
        
        const daysToEvent = Math.abs(distToBoundary / pos.speed);
        
        // Search in a window around the estimate (+/- 20%)
        const estimate = startDate.plus({ days: daysToEvent });
        const startSearch = estimate.minus({ days: Math.max(1, daysToEvent * 0.2) });
        const endSearch = estimate.plus({ days: Math.max(1, daysToEvent * 0.2) });

        return this.findIngress(planetId, nextSignIdx, startSearch, endSearch);
    }

    /**
     * Precision Stationary Point Finder (Retrograde/Direct station)
     * Finds when planet speed crossing zero.
     */
    public async findStationaryPoint(
        planetId: number,
        searchStart: DateTime,
        searchEnd?: DateTime
    ): Promise<DateTime | null> {
        const end = searchEnd || searchStart.plus({ months: 6 }); // Stations can be far
        
        const initialPos = this.getPlanetPos(planetId, searchStart);
        const isCurrentlyDirect = initialPos.speed > 0;

        const check = (date: DateTime) => {
            const pos = this.getPlanetPos(planetId, date);
            return isCurrentlyDirect ? pos.speed < 0 : pos.speed > 0;
        };

        return this.findEventTime(searchStart, end, check);
    }

    /**
     * Helper: Get planet position using internal ephemeris
     */
    private getPlanetPos(planetId: number, date: DateTime): PlanetPosition {
        const planets = this.ephemeris.getPlanets(date, { latitude: 0, longitude: 0 }, 1, false);
        const target = planets.find(p => p.id === planetId);
        if (!target) throw new Error(`Planet ID ${planetId} not found`);
        return target;
    }
}
