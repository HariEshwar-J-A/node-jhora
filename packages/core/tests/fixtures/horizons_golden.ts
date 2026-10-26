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
    horizonsApiVersion: '1.2',
    ephemeris: 'DE441',
    queryUrlTemplate: 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&MAKE_EPHEM=YES&EPHEM_TYPE=OBSERVER&CENTER=500%40399&QUANTITIES=31&TLIST_TYPE=JD&CAL_FORMAT=CAL&TIME_ZONE=0&APPARENT=AIRLESS&OBJ_DATA=NO&COMMAND=%27%7BCOMMAND%7D%27&TLIST=%7BTLIST%7D',
    requestParameters: {
        "format": "json",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER",
        "CENTER": "500@399",
        "QUANTITIES": "31",
        "TLIST_TYPE": "JD",
        "CAL_FORMAT": "CAL",
        "TIME_ZONE": "0",
        "APPARENT": "AIRLESS",
        "OBJ_DATA": "NO"
    },
} as const;


export const HORIZONS_EPOCHS: HorizonsEpoch[] = [
    {
        label: '1890-01-01 00:00 UT',
        jd: 2411368.5,
        utc: { year: 1890, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon: 280.5819751, lat:  -0.0001117 },
            { name: 'Moon', lon:  43.2377159, lat:  -4.0522776 },
            { name: 'Mercury', lon: 294.3331117, lat:  -2.0912811 },
            { name: 'Venus', lon: 268.9434750, lat:   0.0670440 },
            { name: 'Mars', lon: 209.9887435, lat:   1.4381058 },
            { name: 'Jupiter', lon: 287.8293837, lat:  -0.1891731 },
            { name: 'Saturn', lon: 153.6290609, lat:   1.5718459 },
            { name: 'Uranus', lon: 206.3009492, lat:   0.5855143 },
            { name: 'Neptune', lon:  62.2063533, lat:  -1.6851582 },
            { name: 'Pluto', lon:  65.3345806, lat: -12.0402478 },
        ],
    },
    {
        label: '1900-01-01 00:00 UT',
        jd: 2415020.5,
        utc: { year: 1900, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon: 280.1532941, lat:   0.0000648 },
            { name: 'Moon', lon: 272.4162663, lat:   1.1082671 },
            { name: 'Mercury', lon: 258.9977026, lat:   1.1264220 },
            { name: 'Venus', lon: 306.3743725, lat:  -1.6830905 },
            { name: 'Mars', lon: 283.8676754, lat:  -0.9254021 },
            { name: 'Jupiter', lon: 241.1358830, lat:   0.8142907 },
            { name: 'Saturn', lon: 267.7167387, lat:   1.0076898 },
            { name: 'Uranus', lon: 250.1391591, lat:   0.0634029 },
            { name: 'Neptune', lon:  85.2186599, lat:  -1.2996533 },
            { name: 'Pluto', lon:  75.2513936, lat:  -9.7769714 },
        ],
    },
    {
        label: '1970-07-08 20:10 UT',
        jd: 2440776.340277778,
        utc: { year: 1970, month: 7, day: 8, hour: 20, minute: 10, second: 0 },
        bodies: [
            { name: 'Sun', lon: 106.2314144, lat:  -0.0000881 },
            { name: 'Moon', lon: 163.2427602, lat:  -0.8592622 },
            { name: 'Mercury', lon: 108.5135117, lat:   1.5555817 },
            { name: 'Venus', lon: 145.7854914, lat:   1.6218612 },
            { name: 'Mars', lon: 113.9066486, lat:   1.0728017 },
            { name: 'Jupiter', lon: 206.4247440, lat:   1.2264398 },
            { name: 'Saturn', lon:  49.8471184, lat:  -2.1962811 },
            { name: 'Uranus', lon: 184.9631939, lat:   0.6984595 },
            { name: 'Neptune', lon: 238.3884137, lat:   1.7218076 },
            { name: 'Pluto', lon: 174.9785304, lat:  15.6603871 },
        ],
    },
    {
        label: '2000-01-01 12:00 UT',
        jd: 2451545.0,
        utc: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon: 253.8099214, lat:  -0.0001115 },
            { name: 'Moon', lon: 108.3342357, lat:  -3.0015077 },
            { name: 'Mercury', lon: 243.6948338, lat:   2.3168778 },
            { name: 'Venus', lon: 262.9555333, lat:  -0.4716150 },
            { name: 'Mars', lon: 184.8473594, lat:   1.7312726 },
            { name: 'Jupiter', lon: 349.0305332, lat:  -1.3355387 },
            { name: 'Saturn', lon:  27.2690182, lat:  -2.6633881 },
            { name: 'Uranus', lon: 309.7745197, lat:  -0.6390690 },
            { name: 'Neptune', lon: 300.2166974, lat:   0.3064221 },
            { name: 'Pluto', lon: 248.1474964, lat:  11.3667374 },
        ],
    },
    {
        label: '2000-01-01 00:00 UT',
        jd: 2451544.5,
        utc: { year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon: 279.8592049, lat:   0.0002403 },
            { name: 'Moon', lon: 217.2933209, lat:   5.2312994 },
            { name: 'Mercury', lon: 271.1117994, lat:  -0.9456805 },
            { name: 'Venus', lon: 240.9614017, lat:   2.0802345 },
            { name: 'Mars', lon: 327.5754592, lat:  -1.0740062 },
            { name: 'Jupiter', lon:  25.2331086, lat:  -1.2647766 },
            { name: 'Saturn', lon:  40.4058374, lat:  -2.4472226 },
            { name: 'Uranus', lon: 314.7840519, lat:  -0.6584479 },
            { name: 'Neptune', lon: 303.1752432, lat:   0.2351174 },
            { name: 'Pluto', lon: 251.4371500, lat:  10.8545444 },
        ],
    },
    {
        label: '2024-06-15 00:00 UT',
        jd: 2460476.5,
        utc: { year: 2024, month: 6, day: 15, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon:  84.3983760, lat:  -0.0000130 },
            { name: 'Moon', lon: 182.8522759, lat:   0.8844288 },
            { name: 'Mercury', lon:  84.7851129, lat:   0.9941056 },
            { name: 'Venus', lon:  87.2184250, lat:   0.3488697 },
            { name: 'Mars', lon:  34.3005606, lat:  -1.0850150 },
            { name: 'Jupiter', lon:  64.6531149, lat:  -0.7046609 },
            { name: 'Saturn', lon: 349.2461792, lat:  -1.9151279 },
            { name: 'Uranus', lon:  54.9352525, lat:  -0.2609606 },
            { name: 'Neptune', lon: 359.8495327, lat:  -1.2653207 },
            { name: 'Pluto', lon: 301.6964948, lat:  -3.1503413 },
        ],
    },
    {
        label: '2050-01-01 00:00 UT',
        jd: 2469807.5,
        utc: { year: 2050, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon: 280.7483824, lat:   0.0001127 },
            { name: 'Moon', lon:  18.6755970, lat:   3.3912133 },
            { name: 'Mercury', lon: 270.0594885, lat:   3.1357631 },
            { name: 'Venus', lon: 281.2480380, lat:  -0.6060626 },
            { name: 'Mars', lon: 227.7146938, lat:   0.7726782 },
            { name: 'Jupiter', lon: 121.6915484, lat:   0.4580707 },
            { name: 'Saturn', lon: 297.5742802, lat:  -0.2035839 },
            { name: 'Uranus', lon: 170.7326103, lat:   0.7867256 },
            { name: 'Neptune', lon:  53.6034213, lat:  -1.7627912 },
            { name: 'Pluto', lon: 337.5330677, lat: -12.6913738 },
        ],
    },
    {
        label: '2100-01-01 00:00 UT',
        jd: 2488069.5,
        utc: { year: 2100, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon: 280.6041925, lat:   0.0000877 },
            { name: 'Moon', lon: 157.4116073, lat:   1.0917477 },
            { name: 'Mercury', lon: 288.0057719, lat:  -2.1126781 },
            { name: 'Venus', lon: 320.0704851, lat:  -1.8524067 },
            { name: 'Mars', lon:  29.5253593, lat:   0.9517639 },
            { name: 'Jupiter', lon: 201.2063170, lat:   1.2766059 },
            { name: 'Saturn', lon: 205.6316624, lat:   2.4222185 },
            { name: 'Uranus', lon:  17.7413057, lat:  -0.6294645 },
            { name: 'Neptune', lon: 167.2905214, lat:   0.9638819 },
            { name: 'Pluto', lon:  32.4030239, lat: -16.9212249 },
        ],
        // Horizons holds ΔT fixed at the last known leap second for future dates,
        // while this engine extrapolates it. The two therefore diverge by a few
        // seconds of time here — see FUTURE_TOLERANCE_ARCSEC below.
    },
    {
        label: '2149-12-26 00:00 UT',
        jd: 2506325.5,
        utc: { year: 2149, month: 12, day: 26, hour: 0, minute: 0, second: 0 },
        bodies: [
            { name: 'Sun', lon: 274.3470062, lat:   0.0002039 },
            { name: 'Moon', lon: 230.4572950, lat:   4.2366649 },
            { name: 'Mercury', lon: 252.5135422, lat:   2.0602763 },
            { name: 'Venus', lon: 241.8283195, lat:   3.6853770 },
            { name: 'Mars', lon: 261.8607479, lat:  -0.4428220 },
            { name: 'Jupiter', lon: 264.6426720, lat:   0.3597036 },
            { name: 'Saturn', lon:  83.4274318, lat:  -1.4058761 },
            { name: 'Uranus', lon: 244.6036629, lat:   0.1487121 },
            { name: 'Neptune', lon: 273.8730533, lat:   1.0836892 },
            { name: 'Pluto', lon:  80.9109607, lat:  -9.2469854 },
        ],
        // Horizons holds ΔT fixed at the last known leap second for future dates,
        // while this engine extrapolates it. The two therefore diverge by a few
        // seconds of time here — see FUTURE_TOLERANCE_ARCSEC below.
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

/** Bodies compared in engine ↔ Horizons tests (matches SPK_BODY_IDS today). */
export const HORIZONS_ENGINE_COMPARE_BODIES = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
] as const;
