/**
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
 * underlying JPL ephemeris that Swiss Ephemeris — and therefore JHora — is
 * validated against, so matching it to sub-arcsecond means any remaining
 * disagreement with JHora is attributable to the ayanamsa model alone.
 *
 * Epochs deliberately span the full de440s.bsp range (1849–2150) so that
 * precession- and ΔT-dependent errors, which grow with distance from J2000,
 * cannot hide.
 */

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

export const HORIZONS_EPOCHS: HorizonsEpoch[] = [
    {
        label: '1900-01-01 00:00 UT',
        jd: 2415020.5,
        utc: { year: 1900, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun',     lon: 280.1532941, lat:  0.0000648 },
            { name: 'Moon',    lon: 272.4162663, lat:  1.1082671 },
            { name: 'Mercury', lon: 258.9977026, lat:  1.1264220 },
            { name: 'Venus',   lon: 306.3743725, lat: -1.6830905 },
            { name: 'Mars',    lon: 283.8676754, lat: -0.9254021 },
            { name: 'Jupiter', lon: 241.1358830, lat:  0.8142907 },
            { name: 'Saturn',  lon: 267.7167387, lat:  1.0076898 },
        ],
    },
    {
        label: '1970-07-08 20:10 UT',
        jd: 2440776.340278,
        utc: { year: 1970, month: 7, day: 8, hour: 20, minute: 10, second: 0 },
        bodies: [
            { name: 'Sun',     lon: 106.2314146, lat: -0.0000881 },
            { name: 'Moon',    lon: 163.2427628, lat: -0.8592624 },
            { name: 'Mercury', lon: 108.5135122, lat:  1.5555817 },
            { name: 'Venus',   lon: 145.7854916, lat:  1.6218612 },
            { name: 'Mars',    lon: 113.9066488, lat:  1.0728017 },
            { name: 'Jupiter', lon: 206.4247440, lat:  1.2264398 },
            { name: 'Saturn',  lon:  49.8471185, lat: -2.1962811 },
        ],
    },
    {
        label: '1998-12-06 03:53 UT',
        jd: 2451153.661805556,
        utc: { year: 1998, month: 12, day: 6, hour: 3, minute: 53, second: 0 },
        bodies: [
            { name: 'Sun',     lon: 253.8099214, lat: -0.0001115 },
            { name: 'Moon',    lon: 108.3342357, lat: -3.0015077 },
            { name: 'Mercury', lon: 243.6948338, lat:  2.3168778 },
            { name: 'Venus',   lon: 262.9555333, lat: -0.4716150 },
            { name: 'Mars',    lon: 184.8473594, lat:  1.7312726 },
            { name: 'Jupiter', lon: 349.0305332, lat: -1.3355387 },
            { name: 'Saturn',  lon:  27.2690182, lat: -2.6633881 },
        ],
    },
    {
        label: '2024-06-15 00:00 UT',
        jd: 2460476.5,
        utc: { year: 2024, month: 6, day: 15, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun',     lon:  84.3983760, lat: -0.0000130 },
            { name: 'Moon',    lon: 182.8522759, lat:  0.8844288 },
            { name: 'Mercury', lon:  84.7851129, lat:  0.9941056 },
            { name: 'Venus',   lon:  87.2184250, lat:  0.3488697 },
            { name: 'Mars',    lon:  34.3005606, lat: -1.0850150 },
            { name: 'Jupiter', lon:  64.6531149, lat: -0.7046609 },
            { name: 'Saturn',  lon: 349.2461792, lat: -1.9151279 },
        ],
    },
    {
        label: '2100-01-01 00:00 UT',
        jd: 2488069.5,
        utc: { year: 2100, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        // Horizons holds ΔT fixed at the last known leap second for future dates,
        // while this engine extrapolates it. The two therefore diverge by a few
        // seconds of time here — see FUTURE_TOLERANCE_ARCSEC below.
        bodies: [
            { name: 'Sun',     lon: 280.6041915, lat:  0.0000877 },
            { name: 'Moon',    lon: 157.4116064, lat:  1.0917477 },
            { name: 'Mercury', lon: 288.0057710, lat: -2.1126781 },
            { name: 'Venus',   lon: 320.0704841, lat: -1.8524067 },
            { name: 'Mars',    lon:  29.5253584, lat:  0.9517639 },
            { name: 'Jupiter', lon: 201.2063161, lat:  1.2766059 },
            { name: 'Saturn',  lon: 205.6316614, lat:  2.4222185 },
        ],
    },
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

/** Last year for which ΔT is an observation rather than an extrapolation. */
export const LAST_OBSERVED_DELTAT_YEAR = 2025;
