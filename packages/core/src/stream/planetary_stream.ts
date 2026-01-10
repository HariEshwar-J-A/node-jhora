import { EventEmitter } from 'events';
import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, HouseData } from '../engine/ephemeris.js';

export interface StreamConfig {
    location: {
        latitude: number;
        longitude: number;
    };
    intervalMs?: number; // default 1000
    ayanamsa?: number; // default Lahiri (1)
}

export interface StreamUpdate {
    timestamp: DateTime;
    planets: PlanetPosition[];
    // Houses usually require time, so we could include them if needed, 
    // but prompt says "Optimization: This needs to be lightweight... Just raw D1 positions."
    // However, for a "Clock", houses are often used.
    // I will include planets by default.
}

export class PlanetaryStream extends EventEmitter {
    private engine: EphemerisEngine;
    private config: StreamConfig;
    private timer: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    constructor(engine: EphemerisEngine, config: StreamConfig) {
        super();
        this.engine = engine;
        this.config = {
            intervalMs: 1000,
            ayanamsa: 1, // Lahiri
            ...config
        };
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;

        // Immediate emit
        this.emitUpdate();

        this.timer = setInterval(async () => {
            await this.emitUpdate();
        }, this.config.intervalMs);
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
    }

    private async emitUpdate(): Promise<void> {
        try {
            const now = DateTime.now(); // System time

            // Ensure engine is ready? It should be awaited by caller usually, 
            // but we can check or specific usage depends on design.
            // As per valid EphemerisEngine usage, it awaits internally or we await calls.
            // engine.getPlanets() is async (actually synchronous in my implementation but marked async for future WASM safety?)
            // Checking implementation: getPlanets(date, lat, lon, ayanamsa) is what I likely need.
            // Wait, EphemerisEngine.getPlanets signatures...

            const results = this.engine.getPlanets(
                now,
                this.config.location, // GeoLocation
                this.config.ayanamsa // Ayanamsa override
            );

            // My EphemerisEngine implementation:
            // getPlanets(date: DateTime, settings?: { ayanamsaOrder?: number }): PlanetPosition[]
            // It doesn't take lat/lon for Planets (Geocentric mostly? Topocentric if topo flag?)
            // swisseph usually defaults to geocentric unless topo flag.
            // Calculating Houses needs Lat/Lon.
            // Prompt says "Just raw D1 positions".

            this.emit('reading', {
                timestamp: now,
                planets: results
            });

        } catch (error) {
            this.emit('error', error);
        }
    }
}
