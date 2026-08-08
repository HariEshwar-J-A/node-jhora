/**
 * Regression Reference Charts
 *
 * ── What these are, and are not ─────────────────────────────────────────────
 * These are NOT independent ground truth. They are a snapshot of this engine's
 * own output, kept so that unintended changes show up as test failures. Real
 * ground truth lives in two places:
 *
 *   horizons_golden.ts — astrometry, from JPL Horizons, sub-arcsecond
 *   jhora_golden.ts    — sidereal zero point, from JHora's display
 *
 * The distinction matters. A previous revision of this file was labelled a
 * "Golden Standard" while actually holding output captured from a broken
 * engine, and the resulting numbers were physically impossible:
 *
 *   Chart A  Moon speed −3.04°/day    the Moon is never retrograde
 *   Chart A  Sun  speed  0.57°/day    the Sun's range is 0.953–1.019
 *   Chart B  Sun  speed −0.24°/day    the Sun is never retrograde
 *   Chart B  Moon speed  5.88°/day    the Moon's minimum is ~11.8
 *   Chart A  ascendant 180.35°        exactly 180° out; the implied lead over
 *                                     the MC was 284.7°, which cannot occur
 *
 * Those followed from a defective Chebyshev derivative that returned ~0.35× the
 * true velocity. Because the values were treated as authoritative, the suite
 * passed while asserting that the Sun runs backwards.
 *
 * ── Regeneration ────────────────────────────────────────────────────────────
 * Ayanamsa: True Chitrapaksha (SE mode 27) — Spica pinned to 180°, Drik Siddhanta
 * Nodes:    True (osculating) — JHora convention
 * Frame:    Geocentric sidereal, mean ecliptic and equinox of date
 * Places:   Geometric — JHora convention (no light-time or aberration)
 *
 * Regenerate only after the Horizons and JHora suites are green; otherwise a
 * regression is simply re-baselined into the fixture.
 */

export interface PlanetRef {
    name:      string;
    longitude: number; // Sidereal, True Chitrapaksha
    sign:      number; // 1=Aries … 12=Pisces
    speed:     number; // deg/day, negative = retrograde
}

export interface ChartRef {
    label:    string;
    year:     number;
    month:    number;
    day:      number;
    hour:     number; // UTC
    minute:   number;
    second:   number;
    lat:      number;
    lon:      number;
    jd:       number; // Julian Day (UT)
    planets:  PlanetRef[];
    wsCusps:  number[];
    ascendant: number;
    mc:        number;
    panchanga: {
        tithiIndex:      number; // 1-30
        tithiName:       string;
        nakshatraIndex:  number; // 1-27
        nakshatraName:   string;
        nakshatraPada:   number;
        yogaIndex:       number; // 1-27
        yogaName:        string;
        karanaIndex:     number; // 1-60
        karanaName:      string;
        varaIndex:       number; // 0=Sun…6=Sat
        varaName:        string;
    };
}

// ---------------------------------------------------------------------------
// Chart A — J2000 epoch (2000-01-01 12:00 UTC, Greenwich)
// ---------------------------------------------------------------------------
export const CHART_A: ChartRef = {
    label:  'A_J2000',
    year: 2000, month: 1, day: 1,
    hour: 12, minute: 0, second: 0,
    lat: 51.4779, lon: 0.0015,
    jd: 2451545,
    planets: [
        { name: 'Sun',     longitude:       256.537218145925, sign:  9, speed:       1.019431936293 },
        { name: 'Moon',    longitude:       199.486451941705, sign:  7, speed:      12.021958127757 },
        { name: 'Mercury', longitude:       248.064514937844, sign:  9, speed:       1.556339924677 },
        { name: 'Venus',   longitude:       217.736242964034, sign:  8, speed:       1.209092526089 },
        { name: 'Mars',    longitude:       304.134097902501, sign: 11, speed:       0.775695994258 },
        { name: 'Jupiter', longitude:         1.416685832357, sign:  1, speed:       0.040852748818 },
        { name: 'Saturn',  longitude:        16.557178227540, sign:  1, speed:      -0.019857498305 },
        { name: 'Rahu',    longitude:       100.116551367868, sign:  4, speed:      -0.054665103065 },
        { name: 'Ketu',    longitude:       280.116551367868, sign: 10, speed:      -0.054665103065 },
    ],
    wsCusps:   [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    ascendant:         0.428101391541,
    mc:              255.771110916036,
    panchanga: {
        tithiIndex:     26,
        tithiName:      'Krishna 11',
        nakshatraIndex: 15,
        nakshatraName:  'Swati',
        nakshatraPada:  4,
        yogaIndex:      8,
        yogaName:       'Dhriti',
        karanaIndex:    51,
        karanaName:     'Bava',
        varaIndex:      6,
        varaName:       'Shanivara',
    },
};

// ---------------------------------------------------------------------------
// Chart B — modern chart (1985-07-12 00:30 UTC, New Delhi)
// ---------------------------------------------------------------------------
export const CHART_B: ChartRef = {
    label:  'B_MODERN',
    year: 1985, month: 7, day: 12,
    hour: 0, minute: 30, second: 0,
    lat: 28.6139, lon: 77.209,
    jd: 2446258.5208333335,
    planets: [
        { name: 'Sun',     longitude:        85.985274402867, sign:  3, speed:       0.953757519355 },
        { name: 'Moon',    longitude:        17.564645560312, sign:  1, speed:      11.825649097511 },
        { name: 'Mercury', longitude:       112.429940270674, sign:  4, speed:       1.051214757357 },
        { name: 'Venus',   longitude:        42.513483530523, sign:  2, speed:       1.089525745914 },
        { name: 'Mars',    longitude:        87.840051660529, sign:  3, speed:       0.651520854295 },
        { name: 'Jupiter', longitude:       291.244861376848, sign: 10, speed:      -0.105044587989 },
        { name: 'Saturn',  longitude:       207.983869195410, sign:  7, speed:      -0.022036278727 },
        { name: 'Rahu',    longitude:        22.572281635967, sign:  1, speed:       0.006597321286 },
        { name: 'Ketu',    longitude:       202.572281635967, sign:  7, speed:       0.006597321286 },
    ],
    wsCusps:   [90, 120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60],
    ascendant:        91.184639442745,
    mc:              352.170282144387,
    panchanga: {
        tithiIndex:     25,
        tithiName:      'Krishna 10',
        nakshatraIndex: 2,
        nakshatraName:  'Bharani',
        nakshatraPada:  2,
        yogaIndex:      8,
        yogaName:       'Dhriti',
        karanaIndex:    49,
        karanaName:     'Vanija',
        varaIndex:      4,
        varaName:       'Guruvara',
    },
};

// ---------------------------------------------------------------------------
// Chart C — Unix epoch (1970-01-01 00:00 UTC, Null Island)
// ---------------------------------------------------------------------------
export const CHART_C: ChartRef = {
    label:  'C_EPOCH70',
    year: 1970, month: 1, day: 1,
    hour: 0, minute: 0, second: 0,
    lat: 0, lon: 0,
    jd: 2440587.5,
    planets: [
        { name: 'Sun',     longitude:       256.738142685004, sign:  9, speed:       1.019266930154 },
        { name: 'Moon',    longitude:       167.275311074134, sign:  6, speed:      12.548495274165 },
        { name: 'Mercury', longitude:       275.600422602930, sign: 10, speed:       0.561193492935 },
        { name: 'Venus',   longitude:       251.041691994029, sign:  9, speed:       1.258339673378 },
        { name: 'Mars',    longitude:       318.819119047295, sign: 11, speed:       0.745802878488 },
        { name: 'Jupiter', longitude:       188.905625798931, sign:  7, speed:       0.136693196887 },
        { name: 'Saturn',  longitude:         8.638108492370, sign:  1, speed:      -0.005313819158 },
        { name: 'Rahu',    longitude:       320.635994870227, sign: 11, speed:      -0.000928716726 },
        { name: 'Ketu',    longitude:       140.635994870227, sign:  5, speed:      -0.000928716726 },
    ],
    wsCusps:   [150, 180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120],
    ascendant:       167.706720559922,
    mc:               75.979186831878,
    panchanga: {
        tithiIndex:     23,
        tithiName:      'Krishna 8',
        nakshatraIndex: 13,
        nakshatraName:  'Hasta',
        nakshatraPada:  3,
        yogaIndex:      5,
        yogaName:       'Shobhana',
        karanaIndex:    46,
        karanaName:     'Kaulava',
        varaIndex:      3,
        varaName:       'Budhavara',
    },
};

export const ALL_CHARTS: ChartRef[] = [CHART_A, CHART_B, CHART_C];
