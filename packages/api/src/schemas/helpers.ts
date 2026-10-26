import {
    type AyanamsaId,
    type CalculationSettings,
    type DasaYearKind,
    hashSettings,
    type HouseSystemId,
    settingsFromFlat,
    type SunriseLimb,
} from '@node-jhora/core';
import { DateTime } from 'luxon';

import { lookupCity } from '../services/geocoder.js';
import { AYANAMSA_MAP, AyanamsaKey, BirthInput } from './birth-input.js';

export interface ParsedBirth {
    dt: DateTime;
    location: { latitude: number; longitude: number };
    ayanamsaOrder: number;
    nodeType: 'mean' | 'true';
    dasamsaScheme: 'parashara' | 'jhora_5_8';
    horaScheme: 'parashara' | 'parivritti';
    positionMode: 'geometric' | 'apparent';
    topocentric: boolean;
    altitudeMetres: number;
    ayanamsaOffset: number;
    sunriseHour: number;
    houseSystem: string;
    settings: CalculationSettings;
    settingsHash: string;
    /** True when the client asked for a dasa year other than the historical default. */
    applyDasaYear: boolean;
    dashaYearDays?: number;
    resolvedCity?: string;
    resolvedTimezone?: string;
}

export function parseBirthInput(input: BirthInput): ParsedBirth {
    let lat: number;
    let lon: number;
    let tz: string;
    let resolvedCity: string | undefined;
    let resolvedTimezone: string | undefined;

    if (input.city !== undefined) {
        const loc = lookupCity(input.city); // throws CityNotFoundError or AmbiguousCityError
        lat = loc.latitude;
        lon = loc.longitude;
        tz = loc.timezone;
        resolvedCity = [loc.city, loc.province, loc.country].filter(Boolean).join(', ');
        resolvedTimezone = loc.timezone;
    } else {
        lat = input.latitude!;
        lon = input.longitude!;
        tz = input.timezone!;
    }

    const dt = DateTime.fromISO(`${input.date}T${input.time}`, { zone: tz });
    if (!dt.isValid) {
        throw new Error(`Invalid date/time or timezone: ${dt.invalidReason ?? ''}`);
    }

    const ayanamsaOrder = input.customAyanamsaMode ?? AYANAMSA_MAP[input.ayanamsa as AyanamsaKey];
    const location = { latitude: lat, longitude: lon, altitude: input.altitudeMetres };
    const settings = settingsFromFlat({
        // The HTTP name `true_chitra` and the settings id `true_citra` are one mode.
        ayanamsa: (input.ayanamsa === 'true_chitra' ? 'true_citra' : input.ayanamsa) as AyanamsaId,
        ayanamsaOffsetDeg: input.ayanamsaOffset,
        customAyanamsaMode: input.customAyanamsaMode,
        nodeType: input.nodeType,
        houseSystem: input.houseSystem as HouseSystemId,
        cuspsInMiddle: input.cuspsInMiddle,
        positionMode: input.positionMode,
        topocentric: input.topocentric,
        altitudeMetres: input.altitudeMetres,
        sunriseLimb: input.sunriseLimb as SunriseLimb | undefined,
        sunriseRefraction: input.sunriseRefraction,
        nominalHour: input.sunriseHour,
        dasaYearKind: input.dasaYearKind as DasaYearKind | undefined,
        dasaYearDays: input.dasaYearDays,
        dasamsaScheme: input.dasamsaScheme,
        horaScheme: input.horaScheme,
        vargaVariants: input.vargaVariants,
    });

    return {
        dt,
        location,
        ayanamsaOrder,
        nodeType: input.nodeType,
        dasamsaScheme: input.dasamsaScheme,
        horaScheme: input.horaScheme,
        houseSystem: input.houseSystem,
        positionMode: input.positionMode,
        topocentric: input.topocentric,
        altitudeMetres: input.altitudeMetres,
        ayanamsaOffset: input.ayanamsaOffset,
        sunriseHour: input.sunriseHour,
        settings,
        settingsHash: hashSettings(settings),
        applyDasaYear: input.applyDasaYear === true,
        dashaYearDays: input.dasaYearDays,
        resolvedCity,
        resolvedTimezone,
    };
}
