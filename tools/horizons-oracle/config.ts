/**
 * Independent Horizons accuracy oracle — bodies, epochs, and observer sites.
 *
 * Geocenter samples span de440s.bsp (1849–2150). Topocentric sites reuse a
 * small anchor set so parallax (especially the Moon) is checked without
 * bloating the offline fixture cache.
 */

export { FIXTURE_BODY_ORDER, HORIZONS_COMMAND } from '../oracles/horizons/config.js';
export { EPOCH_SPECS, type EpochSpec, type UtcClock } from '../oracles/horizons/config.js';

/** Bodies compared against node-jhora (matches SPK coverage today). */
export const COMPARE_BODIES: readonly string[] = [
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
];

export interface ObserverSite {
    id: string;
    label: string;
    /** Horizons CENTER parameter. */
    center: string;
    /** Horizons SITE_COORD when center is coord@399. */
    siteCoord?: string;
    /** Engine GeoLocation when topocentric. */
    geo?: { latitude: number; longitude: number; altitude?: number };
    /** Subset of EPOCH_SPECS labels, or ALL for the full documented span. */
    epochLabels: readonly string[] | 'ALL';
}

/** Topocentric anchor epochs (parallax + UT locality). */
export const TOPOCENTRIC_EPOCH_LABELS: readonly string[] = [
    '1900-01-01 00:00 UT',
    '2000-01-01 12:00 UT',
    '2024-06-15 00:00 UT',
] as const;

export const OBSERVER_SITES: readonly ObserverSite[] = [
    {
        id: 'geocenter',
        label: 'Geocenter (500@399)',
        center: '500@399',
        epochLabels: 'ALL',
    },
    {
        id: 'chennai',
        label: 'Chennai, India',
        center: 'coord@399',
        siteCoord: '80.2707,13.0827,0.016',
        geo: { latitude: 13.0827, longitude: 80.2707, altitude: 0.016 },
        epochLabels: TOPOCENTRIC_EPOCH_LABELS,
    },
    {
        id: 'palomar',
        label: 'Palomar Observatory',
        center: 'coord@399',
        siteCoord: '-116.8649,33.3563,1.71',
        geo: { latitude: 33.3563, longitude: -116.8649, altitude: 1.71 },
        epochLabels: TOPOCENTRIC_EPOCH_LABELS,
    },
] as const;

/** Horizons observer-table quantities: apparent RA/DEC + ecliptic lon/lat of date. */
export const HORIZONS_ORACLE_QUANTITIES = '2,31';

export const HORIZONS_ORACLE_REQUEST_PARAMS: Readonly<Record<string, string>> = {
    format: 'json',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'OBSERVER',
    QUANTITIES: HORIZONS_ORACLE_QUANTITIES,
    TLIST_TYPE: 'JD',
    CAL_FORMAT: 'CAL',
    TIME_ZONE: '0',
    APPARENT: 'AIRLESS',
    ANG_FORMAT: 'DEG',
    EXTRA_PREC: 'YES',
    OBJ_DATA: 'NO',
};

export const HORIZONS_API_ORIGIN = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** Maximum total byte size of tools/horizons-oracle/fixtures (test-only cache). */
export const FIXTURE_BUDGET_BYTES = 200 * 1024;

export type EraBucket = 'pre-1900' | 'published-dT' | 'future-dT';

export function eraBucket(utcYear: number): EraBucket {
    if (utcYear < 1900) return 'pre-1900';
    if (utcYear <= 2026) return 'published-dT';
    return 'future-dT';
}
