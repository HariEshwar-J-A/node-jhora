/**
 * Golden Standard Reference Charts
 *
 * Values computed from DE440 ephemeris (JPL public domain) with:
 *   - Ayanamsa: Lahiri (LAHIRI_AT_J2000 = 23.945930°, DE440-calibrated)
 *   - Nodes:    Mean (IAU analytical formula, Meeus §22)
 *   - Mode:     Geocentric Sidereal
 *
 * These replace the old SE1/WASM golden values.  DE440 gives
 * sub-arcsecond agreement with JHora for the calibration chart
 * (1998-12-06 Chennai: Moon exact 84.411003°, Asc Δ ≤ 0.011°).
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
        { name: 'Sun',     longitude: 256.431892701135325,  sign: 9,  speed:  0.571622229652208 },
        { name: 'Moon',    longitude: 199.372994032194924,  sign: 7,  speed: -3.042368940301886 },
        { name: 'Mercury', longitude: 247.958792569129514,  sign: 9,  speed:  0.073658754585915 },
        { name: 'Venus',   longitude: 217.630777112003216,  sign: 8,  speed:  0.613348019238761 },
        { name: 'Mars',    longitude: 304.028952394693761,  sign: 11, speed:  0.198808176769732 },
        { name: 'Jupiter', longitude:   1.312083498283414,  sign: 1,  speed: -0.043518790429974 },
        { name: 'Saturn',  longitude:  16.452620642684849,  sign: 1,  speed: -0.038705850552801 },
        { name: 'Rahu',    longitude: 101.098624999999970,  sign: 4,  speed: -0.052953764845996 },
        { name: 'Ketu',    longitude: 281.098624999999970,  sign: 10, speed: -0.052953764845996 },
    ],
    wsCusps:   [180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120, 150],
    ascendant:  180.332745438331358,
    mc:         255.669333934579754,
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
        { name: 'Sun',     longitude:  86.082450124299442,  sign: 3,  speed: -0.236179644810319 },
        { name: 'Moon',    longitude:  17.654946648255134,  sign: 1,  speed:  5.881082334461941 },
        { name: 'Mercury', longitude: 112.527054097598977,  sign: 4,  speed: -0.159002273812358 },
        { name: 'Venus',   longitude:  42.610566119571729,  sign: 2,  speed: -0.291113592238676 },
        { name: 'Mars',    longitude:  87.937421122539661,  sign: 3,  speed: -0.197460126459028 },
        { name: 'Jupiter', longitude: 291.342708199606932,  sign: 10, speed:  0.014353435772531 },
        { name: 'Saturn',  longitude: 208.081656627100188,  sign: 7,  speed: -0.000176780785385 },
        { name: 'Rahu',    longitude:  21.239823015560091,  sign: 1,  speed: -0.052953764845996 },
        { name: 'Ketu',    longitude: 201.239823015560091,  sign: 7,  speed: -0.052953764845996 },
    ],
    wsCusps:   [90, 120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60],
    ascendant:  91.081861524112412,
    mc:         352.068456663061397,
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
        { name: 'Sun',     longitude: 257.052517189792525,  sign: 9,  speed:  0.887818785919238 },
        { name: 'Moon',    longitude: 167.584325818847446,  sign: 6,  speed: 11.964453350909043 },
        { name: 'Mercury', longitude: 275.915012760495983,  sign: 10, speed:  1.041691096326888 },
        { name: 'Venus',   longitude: 251.355956769037221,  sign: 9,  speed:  1.084100926450900 },
        { name: 'Mars',    longitude: 319.133622065385453,  sign: 11, speed:  0.778052879916450 },
        { name: 'Jupiter', longitude: 189.220406757950514,  sign: 7,  speed:  0.156731257825284 },
        { name: 'Saturn',  longitude:   8.952951131908549,  sign: 1,  speed: -0.003033448256568 },
        { name: 'Rahu',    longitude: 321.758756281696606,  sign: 11, speed: -0.052953764845996 },
        { name: 'Ketu',    longitude: 141.758756281696606,  sign: 5,  speed: -0.052953764845996 },
    ],
    wsCusps:   [330, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
    ascendant:  347.601230927513825,
    mc:          75.874215259575124,
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
