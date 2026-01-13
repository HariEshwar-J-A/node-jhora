/**
 * Browser-safe stub for PlanetaryStream
 * The real implementation uses EventEmitter which is not available in browsers.
 * This stub exports a minimal class that throws helpful errors.
 */
import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, HouseData } from '../engine/ephemeris.js';

export interface StreamConfig {
    location: {
        latitude: number;
        longitude: number;
    };
    intervalMs?: number;
    ayanamsa?: number;
}

export interface StreamUpdate {
    timestamp: DateTime;
    planets: PlanetPosition[];
}

/**
 * Browser stub - throws error if used in browser.
 * Use the Node.js version for actual streaming functionality.
 */
export class PlanetaryStream {
    constructor(engine: EphemerisEngine, config: StreamConfig) {
        console.warn("PlanetaryStream is not available in browser environments");
    }

    public start(): void {
        throw new Error("PlanetaryStream is not available in browser environments. This feature requires Node.js.");
    }

    public stop(): void {}

    public on(event: string, listener: (...args: any[]) => void): this {
        throw new Error("PlanetaryStream is not available in browser environments.");
    }

    public emit(event: string, ...args: any[]): boolean {
        return false;
    }
}
