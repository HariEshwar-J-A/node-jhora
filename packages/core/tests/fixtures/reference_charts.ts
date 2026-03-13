/**
 * Golden Standard Reference Charts
 *
 * Values computed from DE440 ephemeris (JPL public domain) with:
 *   - Ayanamsa: Lahiri (LAHIRI_AT_J2000 = 23.930964°, ecliptic-of-date calibration)
 *   - Nodes:    Mean (IAU analytical formula, Meeus §22)
 *   - Mode:     Geocentric Sidereal, ecliptic of date
 *
 * Regenerated after applying IAU 1976 general precession in longitude
 * (coordinates.ts generalPrecessionInLon) so planet longitudes are now in the
 * ecliptic-of-date frame consistent with JHora / Swiss Ephemeris convention.
 */

export interface PlanetRef {
    name:      string;
    longitude: number; // Sidereal, Lahiri, ecliptic of date
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
    // Planets (sidereal Lahiri, geocentric, ecliptic of date)
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
        { name: 'Sun',     longitude: 256.446858701135284,  sign: 9,  speed:  0.571622229652208 },
        { name: 'Moon',    longitude: 199.387960032194997,  sign: 7,  speed: -3.042368940301886 },
        { name: 'Mercury', longitude: 247.973758569129586,  sign: 9,  speed:  0.073658754585915 },
        { name: 'Venus',   longitude: 217.645743112003174,  sign: 8,  speed:  0.613348019238761 },
        { name: 'Mars',    longitude: 304.043918394693719,  sign: 11, speed:  0.198808176769732 },
        { name: 'Jupiter', longitude:   1.327049498283372,  sign: 1,  speed: -0.043518790429974 },
        { name: 'Saturn',  longitude:  16.467586642684807,  sign: 1,  speed: -0.038705850552801 },
        { name: 'Rahu',    longitude: 101.113590999999985,  sign: 4,  speed: -0.052953764845996 },
        { name: 'Ketu',    longitude: 281.113591000000042,  sign: 10, speed: -0.052953764845996 },
    ],
    wsCusps:   [180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120, 150],
    ascendant:  180.347711438331316,
    mc:         255.684299934579826,
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
    lat: 28.6139, lon: 77.209,
    jd: 2446258.5208333335,
    planets: [
        { name: 'Sun',     longitude:  85.895233292156036,  sign: 3,  speed: -0.236179644810319 },
        { name: 'Moon',    longitude:  17.467729816111671,  sign: 1,  speed:  5.881082334461941 },
        { name: 'Mercury', longitude: 112.339837265455515,  sign: 4,  speed: -0.159002273812358 },
        { name: 'Venus',   longitude:  42.423349287428323,  sign: 2,  speed: -0.291113592238676 },
        { name: 'Mars',    longitude:  87.750204290396255,  sign: 3,  speed: -0.197460126459028 },
        { name: 'Jupiter', longitude: 291.155491367463469,  sign: 10, speed:  0.014353435772531 },
        { name: 'Saturn',  longitude: 207.894439794956725,  sign: 7,  speed: -0.000176780785385 },
        { name: 'Rahu',    longitude:  21.254789015560107,  sign: 1,  speed: -0.052953764845996 },
        { name: 'Ketu',    longitude: 201.254789015560164,  sign: 7,  speed: -0.052953764845996 },
    ],
    wsCusps:   [270, 300, 330, 0, 30, 60, 90, 120, 150, 180, 210, 240],
    ascendant:  271.096827524112427,
    mc:         352.083422663061413,
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
        { name: 'Sun',     longitude: 256.648430848125827,  sign: 9,  speed:  0.887818785919238 },
        { name: 'Moon',    longitude: 167.180239477180749,  sign: 6,  speed: 11.964453350909043 },
        { name: 'Mercury', longitude: 275.510926418829285,  sign: 10, speed:  1.041691096326888 },
        { name: 'Venus',   longitude: 250.951870427370523,  sign: 9,  speed:  1.084100926450900 },
        { name: 'Mars',    longitude: 318.729535723718755,  sign: 11, speed:  0.778052879916450 },
        { name: 'Jupiter', longitude: 188.816320416283816,  sign: 7,  speed:  0.156731257825284 },
        { name: 'Saturn',  longitude:   8.548864790241907,  sign: 1,  speed: -0.003033448256568 },
        { name: 'Rahu',    longitude: 321.773722281696678,  sign: 11, speed: -0.052953764845996 },
        { name: 'Ketu',    longitude: 141.773722281696678,  sign: 5,  speed: -0.052953764845996 },
    ],
    wsCusps:   [150, 180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120],
    ascendant:  167.616196927513784,
    mc:          75.889181259575139,
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
