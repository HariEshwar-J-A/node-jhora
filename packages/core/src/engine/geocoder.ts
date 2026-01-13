/**
 * Browser-safe stub for Geocoder
 * The real implementation uses Node.js modules (fs, readline).
 * This stub exports a minimal class that throws helpful errors.
 */

export interface CityData {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
}

/**
 * Browser stub - throws error if used in browser.
 * Use external geocoding APIs for browser-based applications.
 */
export class Geocoder {
    constructor() {
        console.warn("Geocoder is not available in browser environments. Use an external geocoding API.");
    }

    public async searchCity(query: string): Promise<CityData | null> {
        throw new Error("Geocoder is not available in browser environments. Use an external geocoding API (e.g., OpenStreetMap Nominatim) instead.");
    }
}
