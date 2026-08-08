/**
 * JHora Parity Fixture
 *
 * Verbatim from a Jagannatha Hora natal chart export (P.V.R. Narasimha Rao).
 *
 * ── Chart ───────────────────────────────────────────────────────────────────
 * Date      : December 6, 1998, 9:23:00 am, TZ +5:30  (03:53:00 UTC)
 * Place     : 80 E 17′ 00″, 13 N 05′ 00″ — Chennai, India
 * Ayanamsa  : 23-49-35.07  → True Chitrapaksha
 * Nodes     : true (osculating)
 * Positions : geometric (JHora does not apply light-time or aberration)
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * Every value carries the exact string JHora printed. Nothing here is computed,
 * inferred, or rounded to fit.
 *
 * That rule exists because the previous fixture broke it. It claimed an ayanamsa
 * of 23-55-35.07 and planets 6′ lower than the real output — ayanamsa 6′ high,
 * planets 6′ low, which is precisely what you get by generating positions from a
 * wrong ayanamsa rather than reading them off a screen. A whole theory ("JHora's
 * Lahiri is 4.78′ non-standard") was built on that artefact. The real chart is
 * plain True Chitrapaksha and matches this engine to 0.015″.
 *
 * Astrometric ground truth lives separately in `horizons_golden.ts`; this file
 * only pins JHora's conventions.
 */

/** Degrees from a JHora "DD-MM-SS.ss" ayanamsa string. */
export function dms(deg: number, min: number, sec: number): number {
    return deg + min / 60 + sec / 3600;
}

/** Sign abbreviations as JHora prints them, in zodiacal order. */
const SIGN_BASE: Record<string, number> = {
    Ar:   0, Ta:  30, Ge:  60, Cn:  90, Le: 120, Vi: 150,
    Li: 180, Sc: 210, Sg: 240, Cp: 270, Aq: 300, Pi: 330,
};

/** Absolute longitude from a JHora body line, e.g. lon(19, 'Sc', 59, 31.99). */
export function lon(deg: number, sign: keyof typeof SIGN_BASE | string, min: number, sec: number): number {
    return SIGN_BASE[sign] + deg + min / 60 + sec / 3600;
}

export const JHORA_BIRTH = {
    local: { year: 1998, month: 12, day: 6, hour: 9, minute: 23, second: 0, utcOffset: 5.5 },
    utc:   { year: 1998, month: 12, day: 6, hour: 3, minute: 53, second: 0 },
    /** 13 N 05′ 00″ */
    lat: 13 + 5 / 60,
    /** 80 E 17′ 00″ */
    lon: 80 + 17 / 60,
    jd:  2451153.661805556,
} as const;

// ---------------------------------------------------------------------------
// Conventions JHora uses — each one measurably confirmed by this chart
// ---------------------------------------------------------------------------

export const JHORA_CONVENTIONS = {
    /** SE_SIDM_TRUE_CITRA. */
    ayanamsaMode: 27,
    /**
     * Geometric, not apparent. Removing light-time and aberration moves Venus
     * 43.9″, the Sun 20.8″ and Saturn 7.4″ — every one of which lands on JHora's
     * printed value to 0.01″ once removed.
     */
    positionMode: 'geometric' as const,
    /**
     * True (osculating) node. The mean node misses JHora's Rahu by 0.97°; the
     * osculating node lands within 0.12″.
     */
    nodeType: 'true' as const,
} as const;

// ---------------------------------------------------------------------------
// Ayanamsa
// ---------------------------------------------------------------------------

export const JHORA_AYANAMSA = {
    printed: '23-49-35.07',
    value: dms(23, 49, 35.07),
    mode: 27,
    toleranceArcsec: 0.5,
} as const;

// ---------------------------------------------------------------------------
// D1 Rasi
// ---------------------------------------------------------------------------

export interface BodyRef {
    name:      string;
    /** Exactly as JHora printed it. */
    printed:   string;
    /** 1 = Aries … 12 = Pisces. */
    sign:      number;
    longitude: number;
    /** Retrograde flag as marked by JHora's "(R)". */
    retrograde?: boolean;
    toleranceArcsec: number;
}

/** Nodes get a looser budget: JHora prints them to 0.01″ but derives them
 *  from an osculating orbit whose exact formulation may differ slightly. */
const NODE_TOL = 2.0;
const BODY_TOL = 1.0;

export const JHORA_D1: BodyRef[] = [
    { name: 'Sun',     printed: `19 Sc 59' 31.99"`, sign:  8, longitude: lon(19, 'Sc', 59, 31.99), toleranceArcsec: BODY_TOL },
    { name: 'Moon',    printed: `24 Ge 30' 39.61"`, sign:  3, longitude: lon(24, 'Ge', 30, 39.61), toleranceArcsec: BODY_TOL },
    { name: 'Mars',    printed: `11 Vi 01' 45.83"`, sign:  6, longitude: lon(11, 'Vi',  1, 45.83), toleranceArcsec: BODY_TOL },
    { name: 'Mercury', printed: ` 9 Sc 52' 02.95"`, sign:  8, longitude: lon( 9, 'Sc', 52,  2.95), retrograde: true, toleranceArcsec: BODY_TOL },
    { name: 'Jupiter', printed: `25 Aq 12' 32.85"`, sign: 11, longitude: lon(25, 'Aq', 12, 32.85), toleranceArcsec: BODY_TOL },
    { name: 'Venus',   printed: `29 Sc 08' 39.32"`, sign:  8, longitude: lon(29, 'Sc',  8, 39.32), toleranceArcsec: BODY_TOL },
    { name: 'Saturn',  printed: ` 3 Ar 26' 36.50"`, sign:  1, longitude: lon( 3, 'Ar', 26, 36.50), retrograde: true, toleranceArcsec: BODY_TOL },
    { name: 'Rahu',    printed: ` 0 Le 58' 20.94"`, sign:  5, longitude: lon( 0, 'Le', 58, 20.94), toleranceArcsec: NODE_TOL },
    { name: 'Ketu',    printed: ` 0 Aq 58' 20.94"`, sign: 11, longitude: lon( 0, 'Aq', 58, 20.94), toleranceArcsec: NODE_TOL },
];

export const JHORA_ASCENDANT = {
    printed: `2 Cp 20' 40.97"`,
    sign: 10,
    longitude: lon(2, 'Cp', 20, 40.97),
    toleranceArcsec: 2.0,
} as const;

/** JHora prints *local* apparent sidereal time. */
export const JHORA_SIDEREAL_TIME = {
    printed: '14:13:05',
    hours: 14 + 13 / 60 + 5 / 3600,
    toleranceSeconds: 2,
} as const;

// ---------------------------------------------------------------------------
// D9 Navamsa
// ---------------------------------------------------------------------------

export const JHORA_D9: BodyRef[] = [
    { name: 'Sun',     printed: `29 Sg 55' 47.95"`, sign:  9, longitude: lon(29, 'Sg', 55, 47.95), toleranceArcsec: BODY_TOL * 9 },
    { name: 'Moon',    printed: `10 Ta 35' 56.49"`, sign:  2, longitude: lon(10, 'Ta', 35, 56.49), toleranceArcsec: BODY_TOL * 9 },
    { name: 'Mars',    printed: ` 9 Ar 15' 52.51"`, sign:  1, longitude: lon( 9, 'Ar', 15, 52.51), toleranceArcsec: BODY_TOL * 9 },
    { name: 'Mercury', printed: `28 Vi 48' 26.54"`, sign:  6, longitude: lon(28, 'Vi', 48, 26.54), toleranceArcsec: BODY_TOL * 9 },
    { name: 'Jupiter', printed: `16 Ta 52' 55.62"`, sign:  2, longitude: lon(16, 'Ta', 52, 55.62), toleranceArcsec: BODY_TOL * 9 },
    { name: 'Venus',   printed: `22 Pi 17' 53.89"`, sign: 12, longitude: lon(22, 'Pi', 17, 53.89), toleranceArcsec: BODY_TOL * 9 },
    { name: 'Saturn',  printed: ` 0 Ta 59' 28.52"`, sign:  2, longitude: lon( 0, 'Ta', 59, 28.52), toleranceArcsec: BODY_TOL * 9 },
    { name: 'Rahu',    printed: ` 8 Ar 45' 08.46"`, sign:  1, longitude: lon( 8, 'Ar', 45,  8.46), toleranceArcsec: NODE_TOL * 9 },
    { name: 'Ketu',    printed: ` 8 Li 45' 08.46"`, sign:  7, longitude: lon( 8, 'Li', 45,  8.46), toleranceArcsec: NODE_TOL * 9 },
];

export const JHORA_D9_ASCENDANT = {
    printed: `21 Cp 06' 08.69"`,
    sign: 10,
    longitude: lon(21, 'Cp', 6, 8.69),
    toleranceArcsec: 9.0,
} as const;

// ---------------------------------------------------------------------------
// Panchanga
// ---------------------------------------------------------------------------

/**
 * JHora prints the fraction *remaining*; the engine reports the fraction
 * *elapsed*. They must sum to 100.
 */
export const JHORA_PANCHANGA = {
    tithi:     { name: 'Krishna Tritiya', index: 18, percentLeft: 12.34 },
    nakshatra: { name: 'Punarvasu',       index:  7, pada: 2, percentLeft: 66.17 },
    yoga:      { name: 'Sukla',           percentLeft: 41.23 },
    karana:    { name: 'Vishti',          percentLeft: 24.69 },
    vara:      { name: 'Sunday',          index: 0 },
    tolerancePercent: 0.02,
} as const;

// ---------------------------------------------------------------------------
// Vimshottari Dasha
// ---------------------------------------------------------------------------

/**
 * Mahadasha boundaries, local time as JHora prints them.
 *
 * Agreement is to within ~1 day across the whole 120-year cycle. The residual is
 * a difference in JHora's dasha *balance*, not in the Moon: its printed Moon and
 * its printed "66.17% left" both match this engine, yet its Jupiter dasha start
 * implies 66.153%. That is internally inconsistent within JHora's own output, so
 * the tolerance is set at the observed level rather than chased.
 */
export const JHORA_DASHA = {
    startLord: 'Jupiter',
    boundaries: [
        { lord: 'Jupiter', endsOn: '2009-07-07' },
        { lord: 'Saturn',  endsOn: '2028-07-06' },
        { lord: 'Mercury', endsOn: '2045-07-06' },
        { lord: 'Ketu',    endsOn: '2052-07-06' },
        { lord: 'Venus',   endsOn: '2072-07-06' },
        { lord: 'Sun',     endsOn: '2078-07-06' },
        { lord: 'Moon',    endsOn: '2088-07-06' },
        { lord: 'Mars',    endsOn: '2095-07-07' },
        { lord: 'Rahu',    endsOn: '2113-07-07' },
    ],
    toleranceDays: 3,
} as const;

// ---------------------------------------------------------------------------
// D10 Dasamsa — JHora's "(5-8)" scheme
// ---------------------------------------------------------------------------

/**
 * D10, as printed under JHora's header "D-10 (5-8)".
 *
 * This is a selectable Dasamsa scheme, not the classical Parashara rule:
 *   Odd  signs — identical to Parashara, forward from the sign itself.
 *   Even signs — ten parts counted *backward* from the 5th sign, with the degree
 *                reversed within each part.
 *
 * This chart separates the two schemes cleanly: five bodies sit in odd signs and
 * agree under either rule, five sit in even signs and agree only under JHora's.
 * For every even-sign body, Parashara degree + JHora degree = 30.000 — the
 * reversal showing through.
 *
 * Selected with `dasamsaScheme: 'jhora_5_8' | 'parashara'`.
 */
export const JHORA_D10_SCHEME = 'jhora_5_8' as const;
export const JHORA_D10_LABEL  = 'D-10 (5-8)';

/**
 * Looser than D1 because D10 multiplies the source longitude by ten, so the
 * 0.01" to which JHora prints D1 becomes 0.1" here, and the node's own 0.12"
 * becomes 1.2".
 */
const D10_TOL = 10.0;

export const JHORA_D10: BodyRef[] = [
    { name: 'Sun',     printed: `10 Vi 04' 40.05"`, sign:  6, longitude: lon(10, 'Vi',  4, 40.05), toleranceArcsec: D10_TOL },
    { name: 'Moon',    printed: ` 5 Aq 06' 36.10"`, sign: 11, longitude: lon( 5, 'Aq',  6, 36.10), toleranceArcsec: D10_TOL },
    { name: 'Mars',    printed: ` 9 Li 42' 21.65"`, sign:  7, longitude: lon( 9, 'Li', 42, 21.65), toleranceArcsec: D10_TOL },
    { name: 'Mercury', printed: `21 Sg 19' 30.51"`, sign:  9, longitude: lon(21, 'Sg', 19, 30.51), toleranceArcsec: D10_TOL },
    { name: 'Jupiter', printed: `12 Li 05' 28.47"`, sign:  7, longitude: lon(12, 'Li',  5, 28.47), toleranceArcsec: D10_TOL },
    { name: 'Venus',   printed: ` 8 Ge 33' 26.79"`, sign:  3, longitude: lon( 8, 'Ge', 33, 26.79), toleranceArcsec: D10_TOL },
    { name: 'Saturn',  printed: ` 4 Ta 26' 05.02"`, sign:  2, longitude: lon( 4, 'Ta', 26,  5.02), toleranceArcsec: D10_TOL },
    { name: 'Rahu',    printed: ` 9 Le 43' 29.40"`, sign:  5, longitude: lon( 9, 'Le', 43, 29.40), toleranceArcsec: D10_TOL * 2 },
    { name: 'Ketu',    printed: ` 9 Aq 43' 29.40"`, sign: 11, longitude: lon( 9, 'Aq', 43, 29.40), toleranceArcsec: D10_TOL * 2 },
];

export const JHORA_D10_ASCENDANT = {
    printed: `6 Ta 33' 10.35"`,
    sign: 2,
    longitude: lon(6, 'Ta', 33, 10.35),
    toleranceArcsec: D10_TOL,
} as const;

/** Bodies whose D1 sign is even — the only places the two schemes differ. */
export const JHORA_D10_EVEN_SIGN_BODIES = ['Sun', 'Mars', 'Mercury', 'Venus'] as const;
