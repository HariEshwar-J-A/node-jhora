import { lookupViaCity, findFromCityStateProvince, type CityData } from 'city-timezones';

export interface ResolvedLocation {
    city:      string;
    province:  string;
    country:   string;
    latitude:  number;
    longitude: number;
    timezone:  string;
    pop:       number;
}

export class CityNotFoundError extends Error {
    constructor(query: string) {
        super(`City not found: "${query}"`);
        this.name = 'CityNotFoundError';
    }
}

export class AmbiguousCityError extends Error {
    suggestions: string[];
    constructor(query: string, results: CityData[]) {
        super(`Multiple timezones found for "${query}". Please be more specific.`);
        this.name = 'AmbiguousCityError';
        this.suggestions = results.map(r =>
            [r.city, r.province, r.country].filter(Boolean).join(', ')
        );
    }
}

export function lookupCity(query: string): ResolvedLocation {
    // Try exact city lookup first (case-insensitive match on city name)
    let results = lookupViaCity(query);

    if (results.length === 0) {
        // Normalize: strip commas (e.g. "Hamilton, Ontario" → "Hamilton Ontario")
        // findFromCityStateProvince tokenises by space and checks each token against
        // city, province, state_ansi, and country fields.
        const normalized = query.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        results = findFromCityStateProvince(normalized);
    }

    if (results.length === 0) throw new CityNotFoundError(query);

    if (results.length === 1) return toResolved(results[0]);

    // Multiple matches — check whether all share the same timezone
    const timezones = new Set(results.map(r => r.timezone));
    if (timezones.size === 1) {
        // Same timezone: auto-pick highest-population entry (chart output is identical)
        results = [...results].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0));
        return toResolved(results[0]);
    }

    // Different timezones — require the caller to be more specific
    throw new AmbiguousCityError(query, results);
}

function toResolved(r: CityData): ResolvedLocation {
    return {
        city:      r.city,
        province:  r.province ?? '',
        country:   r.country  ?? '',
        latitude:  r.lat,
        longitude: r.lng,
        timezone:  r.timezone,
        pop:       r.pop ?? 0,
    };
}
