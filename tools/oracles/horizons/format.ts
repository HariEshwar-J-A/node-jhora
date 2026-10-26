import type { FetchedEpoch } from './fetch.js';

const LON_LAT_DECIMALS = 7;

export function formatAngle(degrees: number): string {
    return degrees.toFixed(LON_LAT_DECIMALS);
}

function formatUtcBlock(utc: FetchedEpoch['utc'], indent: string): string {
    return [
        `${indent}utc: { year: ${utc.year}, month: ${utc.month}, day: ${utc.day}, `,
        `hour: ${utc.hour}, minute: ${utc.minute}, second: ${utc.second} },`,
    ].join('');
}

function formatBodies(bodies: FetchedEpoch['bodies'], indent: string): string {
    const lines = bodies.map((body) => {
        const lon = formatAngle(body.lon).padStart(12, ' ');
        const lat = formatAngle(body.lat).padStart(12, ' ');
        return `${indent}{ name: '${body.name}', lon:${lon}, lat:${lat} },`;
    });
    return lines.join('\n');
}

export function formatHorizonsGoldenTs(
    epochs: readonly FetchedEpoch[],
    provenance: {
        horizonsApiVersion: string;
        ephemeris: string;
        queryUrlTemplate: string;
        requestParameters: Readonly<Record<string, string>>;
    },
): string {
    const header = `/**
 * JPL Horizons Golden Fixture — astrometric ground truth
 *
 * Apparent geocentric ecliptic longitude and latitude, referred to the **true**
 * ecliptic and equinox of date, retrieved from the JPL Horizons API
 * (https://ssd.jpl.nasa.gov/api/horizons.api, QUANTITIES='31', CENTER='500@399',
 * time tags in UT).
 *
 * ── Why this fixture exists ──────────────────────────────────────────────────
 * Sidereal output = astrometry + ayanamsa. Those two are independently wrong-
 * able, and the previous test suite conflated them: ayanamsa constants had been
 * back-fitted so that one chart reproduced one expected Moon longitude, which
 * silently absorbed 7–41″ of astrometric error and then re-emitted it at every
 * other date.
 *
 * This fixture pins the astrometry half on its own. Horizons is the same
 * underlying JPL ephemeris family that professional tools validate against, so
 * matching it to sub-arcsecond means any remaining disagreement with JHora is
 * attributable to the ayanamsa model alone.
 *
 * Epochs deliberately span the full de440s.bsp range (1849–2150) so that
 * precession- and ΔT-dependent errors, which grow with distance from J2000,
 * cannot hide.
 *
 * Regenerate with: pnpm horizons:refresh
 */

import { LAST_OBSERVED_YEAR } from '../../src/engine/deltat.js';

export interface HorizonsBody {
    name: string;
    /** Apparent ecliptic longitude of date, degrees. */
    lon: number;
    /** Apparent ecliptic latitude of date, degrees. */
    lat: number;
}

export interface HorizonsEpoch {
    label: string;
    /** Julian Day, UT. */
    jd: number;
    /** UTC calendar components, for constructing engine inputs. */
    utc: { year: number; month: number; day: number; hour: number; minute: number; second: number };
    bodies: HorizonsBody[];
}

/** How this fixture was produced (no wall-clock timestamps). */
export const HORIZONS_PROVENANCE = {
    horizonsApiVersion: '${provenance.horizonsApiVersion}',
    ephemeris: '${provenance.ephemeris}',
    queryUrlTemplate: '${provenance.queryUrlTemplate}',
    requestParameters: ${JSON.stringify(provenance.requestParameters, null, 4).replace(/\n/g, '\n    ')},
} as const;

`;

    const epochBlocks = epochs.map((epoch) => {
        const jdStr = epoch.jd === Math.trunc(epoch.jd) ? `${epoch.jd}.0` : String(epoch.jd);
        let comment = '';
        if (epoch.utc.year >= 2100) {
            comment = `
        // Horizons holds ΔT fixed at the last known leap second for future dates,
        // while this engine extrapolates it. The two therefore diverge by a few
        // seconds of time here — see FUTURE_TOLERANCE_ARCSEC below.`;
        }
        return `    {
        label: '${epoch.label}',
        jd: ${jdStr},
${formatUtcBlock(epoch.utc, '        ')}
        bodies: [
${formatBodies(epoch.bodies, '            ')}
        ],${comment}
    },`;
    });

    const footer = `
export const HORIZONS_EPOCHS: HorizonsEpoch[] = [
${epochBlocks.join('\n')}
];

/**
 * Accuracy contract, in arcseconds.
 *
 * 1″ = 0.00028°. For scale, the finest subdivision in routine Jyotish use is the
 * D-60 Shashtiamsa at 30′; a 1″ error is three orders of magnitude below any
 * varga or nakshatra-pada boundary, so it can never change a chart reading.
 */
export const TOLERANCE_ARCSEC = {
    /** Longitude, all bodies. */
    longitude: 1.0,
    /** Latitude — same chain, so held to the same standard. */
    latitude: 1.0,
} as const;

/**
 * Beyond the observed-ΔT record, Earth's rotation cannot be predicted: the
 * engine extrapolates ΔT while Horizons freezes it at the last leap second.
 * By 2100 the two differ by ~130 s of time, which is ~30′ of lunar motion. That
 * is a property of the unknowable future, not an engine defect, so future
 * epochs assert only that the chain stays self-consistent.
 */
export const FUTURE_TOLERANCE_ARCSEC = {
    longitude: 180,   // 3′ — observed lunar spread at 2100 is ~46″
    latitude:   60,   // 1′
} as const;

/**
 * Last year for which the engine's ΔT is a tabulated value rather than an
 * extrapolation. The JHora precision profile uses the ΔT record bundled with
 * Swiss Ephemeris 2.02 (JHora's DLL), which ends in 2019, so later epochs are
 * extrapolated exactly as JHora does (~8 s above the observed value by 2024).
 */
export const LAST_OBSERVED_DELTAT_YEAR = LAST_OBSERVED_YEAR;

/** Bodies compared in engine ↔ Horizons tests (matches SPK_BODY_IDS today). */
export const HORIZONS_ENGINE_COMPARE_BODIES = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
] as const;
`;

    return header + footer;
}
