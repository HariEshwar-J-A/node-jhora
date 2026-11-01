/**
 * Canonical digests for extended dashas + shadbala time (Decimal precision contract).
 * Fixture bytes captured from `origin/main` at de758a3 (global Decimal.set via core load).
 */
import { createHash } from 'node:crypto';

import { Body, calculateHouseCusps, EphemerisEngine, type PlanetPosition } from '@node-jhora/core';
import {
    calculateAyanabala,
    calculateChestaBala,
    calculateDigBala,
    calculateNatonataBala,
    calculatePakshaBala,
    calculateTribhagaBala,
} from '../../../analytics/src/shadbala_time.js';
import { DateTime } from 'luxon';

import { generateCyclicDasha } from '../../src/dashas/cyclic.js';
import { KalachakraDasha } from '../../src/dashas/kalachakra.js';
import {
    DrigDasha,
    generateTithiAshtottari,
    MoolaDasha,
    SudasaDasha,
} from '../../src/dashas/special.js';

export interface BirthCase {
    id: string;
    iso: string;
    lat: number;
    lon: number;
}

export const BIRTH_CASES: BirthCase[] = [
    { id: 'varanasi-2020', iso: '2020-12-21T18:20:00+05:30', lat: 25.3176, lon: 82.9739 },
    { id: 'leap-2000-utc', iso: '2000-02-29T12:00:00Z', lat: 51.5074, lon: -0.1278 },
    { id: 'leap-2000-kolkata', iso: '2000-02-29T18:00:00+05:30', lat: 22.5726, lon: 88.3639 },
    { id: 'dst-us-fall-2021', iso: '2021-11-07T01:30:00-04:00', lat: 40.7128, lon: -74.006 },
    { id: 'dst-us-spring-2021', iso: '2021-03-14T09:30:00-04:00', lat: 40.7128, lon: -74.006 },
    { id: 'dst-eu-2024', iso: '2024-03-31T02:30:00+02:00', lat: 48.8566, lon: 2.3522 },
    { id: 'pre-1900-1850', iso: '1850-06-15T08:00:00+05:30', lat: 28.6139, lon: 77.209 },
    { id: 'kernel-start-1850', iso: '1850-01-15T12:00:00Z', lat: 13.0827, lon: 80.2707 },
    { id: 'future-2050', iso: '2050-07-04T12:00:00Z', lat: 34.0522, lon: -118.2437 },
    { id: 'kernel-end-2149', iso: '2149-06-01T12:00:00Z', lat: 48.8566, lon: 2.3522 },
    { id: 'south-pole-ish', iso: '2010-06-21T12:00:00Z', lat: -77.85, lon: 166.67 },
    { id: 'north-high-lat', iso: '2015-01-15T14:00:00+02:00', lat: 69.6496, lon: 18.9553 },
    { id: 'sydney-2016', iso: '2016-10-02T03:00:00+11:00', lat: -33.8688, lon: 151.2093 },
    { id: 'tokyo-1988', iso: '1988-01-08T07:15:00+09:00', lat: 35.6762, lon: 139.6503 },
    { id: 'la-1994', iso: '1994-01-17T06:00:00-08:00', lat: 34.0522, lon: -118.2437 },
    { id: 'utc-midnight-2022', iso: '2022-01-01T00:00:00Z', lat: 52.52, lon: 13.405 },
    { id: 'kathmandu-2015', iso: '2015-04-25T11:56:00+05:45', lat: 27.7172, lon: 85.324 },
    { id: 'dubai-2033', iso: '2033-08-15T16:30:00+04:00', lat: 25.2048, lon: 55.2708 },
    { id: 'chile-2016', iso: '2016-08-13T22:00:00-04:00', lat: -33.4489, lon: -70.6693 },
    { id: 'iceland-2020', iso: '2020-12-21T12:00:00Z', lat: 64.1466, lon: -21.9426 },
    { id: 'india-no-dst-2019', iso: '2019-11-01T05:30:00+05:30', lat: 19.076, lon: 72.8777 },
];

function float64Hex(n: number): string {
    const buf = Buffer.allocUnsafe(8);
    buf.writeDoubleLE(n, 0);
    return buf.toString('hex');
}

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/** Instants for Kalachakra ISO boundaries (antardasha toISO() follows process local zone). */
function kalachakraInstantToken(iso: string): string {
    const dt = DateTime.fromISO(iso, { setZone: true });
    return dt.isValid ? String(dt.toUTC().toMillis()) : iso;
}

function serializeDashaPeriods(
    periods: {
        start: DateTime;
        end: DateTime;
        durationYears: number;
        planet?: string;
        subPeriods?: typeof periods;
    }[],
): string {
    const walk = (p: (typeof periods)[0]): string => {
        const subs = p.subPeriods ?? [];
        return `${p.planet ?? ''}:${p.start.toISO()}:${p.end.toISO()}:${float64Hex(p.durationYears)}:${subs.map(walk).join('|')}`;
    };
    return periods.map(walk).join(';');
}

function serializeKalachakra(res: ReturnType<typeof KalachakraDasha.calculate>): string {
    const walk = (p: (typeof res.periods)[0]): string => {
        const subs = (p.subPeriods ?? []).map((s) => walk(s)).join('|');
        return `${p.signIndex}:${kalachakraInstantToken(p.start)}:${kalachakraInstantToken(p.end)}:${float64Hex(p.durationYears)}:${subs}`;
    };
    return [
        res.nakshatraIndex,
        res.pada,
        res.chakra,
        float64Hex(res.paramayusYears),
        float64Hex(res.balanceYearsAtBirth),
        res.periods.map((p) => walk(p)).join(';'),
    ].join(':');
}

function serializeNamedPeriods(
    periods: {
        start: string;
        end: string;
        durationYears?: number;
        durationDays?: number;
        planet?: string;
        signIndex?: number;
        lord?: string;
    }[],
): string {
    return periods
        .map((p) =>
            [
                p.planet ?? p.lord ?? String(p.signIndex ?? ''),
                p.start,
                p.end,
                p.durationYears !== undefined ? float64Hex(p.durationYears) : '',
                p.durationDays !== undefined ? float64Hex(p.durationDays) : '',
            ].join(','),
        )
        .join(';');
}

function shadbalaDigest(
    dt: DateTime,
    planets: PlanetPosition[],
    asc: number,
    mc: number,
    sun: PlanetPosition,
    moon: PlanetPosition,
): string {
    const birthHour = dt.hour + dt.minute / 60 + dt.second / 3600;
    const sunrise = 6;
    const sunset = 18;
    const parts: string[] = [];
    for (const p of planets) {
        if (p.id === Body.Rahu || p.id === Body.Ketu) continue;
        parts.push(
            String(p.id),
            float64Hex(calculateDigBala(p, asc, mc)),
            float64Hex(calculateNatonataBala(p.id, sun.longitude, mc)),
            float64Hex(calculatePakshaBala(p.id, sun.longitude, moon.longitude)),
            float64Hex(calculateTribhagaBala(p.id, birthHour, sunrise, sunset)),
            float64Hex(calculateAyanabala(p.id, p.declination ?? 0)),
            float64Hex(calculateChestaBala(p)),
        );
    }
    return parts.join(':');
}

export async function computeCaseDigests(
    engine: EphemerisEngine,
    c: BirthCase,
): Promise<Record<string, string>> {
    const dt = DateTime.fromISO(c.iso, { setZone: true });
    const planets = engine.getPlanets(dt, { latitude: c.lat, longitude: c.lon });
    const houses = calculateHouseCusps(dt, c.lat, c.lon, 'W', engine);
    const moon = planets.find((p) => p.id === Body.Moon)!;
    const sun = planets.find((p) => p.id === Body.Sun)!;
    const chart = { ascendant: houses.ascendant, planets };

    const cyclicAsht = generateCyclicDasha('ashtottari', dt, moon.longitude, 2);
    const cyclicShata = generateCyclicDasha('shatabdika', dt, moon.longitude, 2);
    const tithi = generateTithiAshtottari(dt, moon.longitude, sun.longitude, 2);
    const kala = KalachakraDasha.calculate(dt, moon.longitude, 2);
    const moola = MoolaDasha.calculate(chart, dt);
    const drig = DrigDasha.calculate(chart, dt, 1);
    const sudasa = SudasaDasha.calculate(chart, dt, moon.longitude, 1);

    return {
        cyclicAshtottari: sha256(serializeDashaPeriods(cyclicAsht)),
        cyclicShatabdika: sha256(serializeDashaPeriods(cyclicShata)),
        tithiAshtottari: sha256(serializeDashaPeriods(tithi)),
        kalachakra: sha256(serializeKalachakra(kala)),
        moolaDasha: sha256(serializeNamedPeriods(moola)),
        drigDasha: sha256(serializeNamedPeriods(drig)),
        sudasaDasha: sha256(serializeNamedPeriods(sudasa)),
        shadbalaTime: sha256(shadbalaDigest(dt, planets, houses.ascendant, houses.mc, sun, moon)),
    };
}

export async function computeAllDigests(
    engine: EphemerisEngine,
): Promise<Record<string, Record<string, string>>> {
    const out: Record<string, Record<string, string>> = {};
    for (const c of BIRTH_CASES) {
        out[c.id] = await computeCaseDigests(engine, c);
    }
    return out;
}
