import { DateTime } from 'luxon';
import { BirthInput, AYANAMSA_MAP, AyanamsaKey } from './birth-input.js';
import { lookupCity } from '../services/geocoder.js';

export interface ParsedBirth {
    dt:               DateTime;
    location:         { latitude: number; longitude: number };
    ayanamsaOrder:    number;
    nodeType:         'mean' | 'true';
    dasamsaScheme:    'parashara' | 'jhora_5_8';
    horaScheme:       'parashara' | 'parivritti';
    positionMode:     'geometric' | 'apparent';
    topocentric:      boolean;
    altitudeMetres:   number;
    ayanamsaOffset:   number;
    sunriseHour:      number;
    houseSystem:      string;
    resolvedCity?:     string;
    resolvedTimezone?: string;
}

export function parseBirthInput(input: BirthInput): ParsedBirth {
    let lat: number;
    let lon: number;
    let tz: string;
    let resolvedCity: string | undefined;
    let resolvedTimezone: string | undefined;

    if (input.city !== undefined) {
        const loc = lookupCity(input.city);   // throws CityNotFoundError or AmbiguousCityError
        lat = loc.latitude;
        lon = loc.longitude;
        tz  = loc.timezone;
        resolvedCity     = [loc.city, loc.province, loc.country].filter(Boolean).join(', ');
        resolvedTimezone = loc.timezone;
    } else {
        lat = input.latitude!;
        lon = input.longitude!;
        tz  = input.timezone!;
    }

    const dt = DateTime.fromISO(`${input.date}T${input.time}`, { zone: tz });
    if (!dt.isValid) {
        throw new Error(`Invalid date/time or timezone: ${dt.invalidReason ?? ''}`);
    }

    const ayanamsaOrder = AYANAMSA_MAP[input.ayanamsa as AyanamsaKey];
    const location      = { latitude: lat, longitude: lon, altitude: input.altitudeMetres };

    return { dt, location, ayanamsaOrder, nodeType: input.nodeType,
             dasamsaScheme: input.dasamsaScheme, horaScheme: input.horaScheme,
             houseSystem: input.houseSystem,
             positionMode: input.positionMode, topocentric: input.topocentric,
             altitudeMetres: input.altitudeMetres, ayanamsaOffset: input.ayanamsaOffset,
             sunriseHour: input.sunriseHour,
             resolvedCity, resolvedTimezone };
}
