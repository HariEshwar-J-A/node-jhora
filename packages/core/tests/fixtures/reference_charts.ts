/**
 * Golden Standard Reference Charts
 *
 * Values captured from Swiss Ephemeris WASM (swisseph-wasm) with:
 *   - Ayanamsa: Lahiri (SE_SIDM_LAHIRI = 1)
 *   - Nodes:    Mean (SE body 10 = SE_MEAN_NODE)
 *   - Flags:    SEFLG_SWIEPH | SEFLG_SIDEREAL | SEFLG_TRUEPOS | SEFLG_NONUT | SEFLG_SPEED
 *   - Mode:     Geocentric Sidereal
 *
 * These are the ground-truth values for all unit tests.
 * Update ONLY after verifying against pyjhora output or authoritative SE reference.
 */

export interface PlanetRef {
    name:      string;
    longitude: number; // Sidereal, Lahiri
    sign:      number; // 1=Aries … 12=Pisces
    speed:     number; // deg/day
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
    // Planets (sidereal Lahiri, geocentric)
    planets:  PlanetRef[];
    // WholeSign house cusps (1-12 start degrees)
    wsCusps:  number[];
    ascendant: number;
    mc:        number;
    // Panchanga
    panchanga: {
        tithiIndex:      number; // 1-30
        tithiName:       string;
        nakshatraIndex:  number; // 1-27
        nakshatraName:   string;
        nakshatraPada:   number; // 1-4
        yogaIndex:       number; // 1-27
        yogaName:        string;
        karanaIndex:     number; // 1-60
        karanaName:      string;
        varaIndex:       number; // 0=Sun…6=Sat
        varaName:        string;
    };
}

// ---------------------------------------------------------------------------
// Chart A — J2000 Epoch (2000-01-01 12:00 UTC, Greenwich)
// ---------------------------------------------------------------------------
export const CHART_A: ChartRef = {
    label:  'A_J2000',
    year: 2000, month: 1,  day: 1,
    hour: 12, minute: 0,   second: 0,
    lat: 51.4779, lon: 0.0015,
    jd: 2451545.0,
    planets: [
        { name: 'Sun',     longitude: 256.521486,  sign: 9,  speed:  1.019394 },
        { name: 'Moon',    longitude: 199.470528,  sign: 7,  speed: 12.021264 },
        { name: 'Mercury', longitude: 248.048782,  sign: 9,  speed:  1.556218 },
        { name: 'Venus',   longitude: 217.720510,  sign: 8,  speed:  1.209003 },
        { name: 'Mars',    longitude: 304.118365,  sign: 11, speed:  0.775634 },
        { name: 'Jupiter', longitude:   1.400954,  sign: 1,  speed:  0.040721 },
        { name: 'Saturn',  longitude:  16.541446,  sign: 1,  speed: -0.019985 },
        { name: 'Rahu',    longitude: 101.187424,  sign: 4,  speed: -0.054779 },
        { name: 'Ketu',    longitude: 281.187424,  sign: 10, speed: -0.054779 },
    ],
    wsCusps:   [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    ascendant:  24.269467,
    mc:        279.612471,
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
// Chart B — Modern Chart (1985-07-12 00:30 UTC, New Delhi)
// ---------------------------------------------------------------------------
export const CHART_B: ChartRef = {
    label:  'B_MODERN',
    year: 1985, month: 7,  day: 12,
    hour: 0,  minute: 30,  second: 0,
    lat: 28.6139, lon: 77.2090,
    jd: 2446258.5208333335,
    planets: [
        { name: 'Sun',     longitude:  85.969713,  sign: 3,  speed:  0.953719 },
        { name: 'Moon',    longitude:  17.548899,  sign: 1,  speed: 11.824735 },
        { name: 'Mercury', longitude: 112.414378,  sign: 4,  speed:  1.051530 },
        { name: 'Venus',   longitude:  42.497922,  sign: 2,  speed:  1.089424 },
        { name: 'Mars',    longitude:  87.824490,  sign: 3,  speed:  0.651487 },
        { name: 'Jupiter', longitude: 291.229300,  sign: 10, speed: -0.105039 },
        { name: 'Saturn',  longitude: 207.968308,  sign: 7,  speed: -0.022157 },
        { name: 'Rahu',    longitude:  21.328629,  sign: 1,  speed: -0.052992 },
        { name: 'Ketu',    longitude: 201.328629,  sign: 7,  speed: -0.052992 },
    ],
    wsCusps:   [90, 120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60],
    ascendant: 114.824008,
    mc:         15.809653,
    panchanga: {
        tithiIndex:     25,
        tithiName:      'Krishna 10',
        nakshatraIndex:  2,
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
// Chart C — Unix Epoch (1970-01-01 00:00 UTC, Null Island)
// ---------------------------------------------------------------------------
export const CHART_C: ChartRef = {
    label:  'C_EPOCH70',
    year: 1970, month: 1,  day: 1,
    hour: 0,  minute: 0,   second: 0,
    lat: 0.0, lon: 0.0,
    jd: 2440587.5,
    planets: [
        { name: 'Sun',     longitude: 256.722764,  sign: 9,  speed:  1.019229 },
        { name: 'Moon',    longitude: 167.259741,  sign: 6,  speed: 12.547566 },
        { name: 'Mercury', longitude: 275.585044,  sign: 10, speed:  0.562140 },
        { name: 'Venus',   longitude: 251.026313,  sign: 9,  speed:  1.258295 },
        { name: 'Mars',    longitude: 318.803741,  sign: 11, speed:  0.745736 },
        { name: 'Jupiter', longitude: 188.890247,  sign: 7,  speed:  0.136736 },
        { name: 'Saturn',  longitude:   8.623003,  sign: 1,  speed: -0.005446 },
        { name: 'Rahu',    longitude: 321.847558,  sign: 11, speed: -0.000796 },
        { name: 'Ketu',    longitude: 141.847558,  sign: 5,  speed: -0.000796 },
    ],
    wsCusps:   [180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120, 150],
    ascendant: 191.129425,
    mc:         99.401886,
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
