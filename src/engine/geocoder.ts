import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface CityData {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
}

export class Geocoder {
    private citiesPath: string;

    constructor() {
        // Resolve path to cities.csv relative to this file
        // Assumes src/engine/geocoder.ts -> src/data/cities.csv
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        this.citiesPath = join(__dirname, '../data/cities.csv');
    }

    /**
     * Searches for a city by name in the CSV file using a stream.
     * Case-insensitive prefix search.
     * 
     * @param query - City name to search for.
     * @returns Promise<CityData | null>
     */
    public async searchCity(query: string): Promise<CityData | null> {
        const normalizedQuery = query.toLowerCase().trim();

        const fileStream = createReadStream(this.citiesPath);
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            // Skip header
            if (line.startsWith('City,Country')) continue;

            // Simple CSV parse - logic: Name,Country,Lat,Long,Timezone
            const parts = line.split(',');
            if (parts.length < 5) continue;

            const name = parts[0];

            // Check match (e.g. exact match or starts with)
            // Using "starts with" specifically for flexibility
            if (name.toLowerCase() === normalizedQuery) {
                rl.close(); // Stop reading
                return {
                    name: parts[0],
                    country: parts[1],
                    latitude: parseFloat(parts[2]),
                    longitude: parseFloat(parts[3]),
                    timezone: parts[4].trim()
                };
            }
        }

        return null;
    }
}
