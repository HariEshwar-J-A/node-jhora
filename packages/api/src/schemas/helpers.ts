import { DateTime } from 'luxon';
import { BirthInput, AYANAMSA_MAP, AyanamsaKey } from './birth-input.js';

export interface ParsedBirth {
    dt:           DateTime;
    location:     { latitude: number; longitude: number };
    ayanamsaOrder: number;
    nodeType:     'mean' | 'true';
    houseSystem:  string;
}

export function parseBirthInput(input: BirthInput): ParsedBirth {
    const dt = DateTime.fromISO(`${input.date}T${input.time}`, { zone: input.timezone });
    if (!dt.isValid) {
        throw new Error(`Invalid date/time or timezone: ${dt.invalidReason ?? ''}`);
    }

    const ayanamsaOrder = AYANAMSA_MAP[input.ayanamsa as AyanamsaKey];
    const location      = { latitude: input.latitude, longitude: input.longitude };

    return { dt, location, ayanamsaOrder, nodeType: input.nodeType, houseSystem: input.houseSystem };
}
