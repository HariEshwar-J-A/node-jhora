/**
 * Ayanamsa mode registry — anchors transcribed from published definitions only.
 * Mode numbers are compatible with publicly documented numbering (0–46, USER 255).
 * See docs/DATA-SOURCES.md and ADR 0025.
 */

const d = (deg: number, min: number, sec = 0): number => deg + min / 60 + sec / 3600;

/** Mean ayanamsa at anchor, degrees; may differ by precision profile. */
export type ProfileMean = number | { jhora: number; modern: number };

export interface StarModelDef {
    kind: 'star';
    star:
        'Spica' | 'DeltaCancri' | 'ZetaPiscium' | 'LambdaScorpii' | 'Aldebaran' | 'GalacticCenter';
    atLongitude: ProfileMean;
    label: string;
}

export interface EpochModelDef {
    kind: 'epoch';
    jd: number;
    meanAtAnchor: ProfileMean;
    label: string;
}

export interface LahiriModelDef {
    kind: 'lahiri';
    jd: number;
    trueValue: number;
    label: string;
}

export interface TrueEpochModelDef {
    kind: 'true_epoch';
    jd: number;
    trueValue: number;
    label: string;
}

export interface GalacticNodeModelDef {
    kind: 'galactic_node';
    /** Sidereal longitude of the galactic-equator node on the ecliptic, degrees. */
    siderealNodeDeg: number;
    useLz2010: boolean;
    label: string;
}

export type AyanamsaModelDef =
    StarModelDef | EpochModelDef | LahiriModelDef | TrueEpochModelDef | GalacticNodeModelDef;

const complementDeg = (deg: number, min: number, sec = 0): number =>
    (((360 - (deg + min / 60 + sec / 3600)) % 360) + 360) % 360;

export const JD_1900_JAN_0_5 = 2415020.0;
export const JD_1900_JAN_1_NOON = 2415020.5;
export const JD_1950_JAN_1 = 2433282.5;
export const JD_J2000 = 2451545.0;
export const JD_B1950 = 2433282.42345905;
export const JD_YM100_JAN_1 = 1684533.0;
export const JD_HIPPARCHOS = 1674484.0;
export const JD_SASSANIAN = 1927135.8747793;
export const JD_SS499_EQUINOX = 1903396.8128541666;
export const JD_ARY499_EQUINOX = 1903396.7895;
export const JD_ARY522_EQUINOX = 1911797.7407916666;
export const JD_LAHIRI_VP285 = 1825235.245875;
export const JD_KP_VP291 = 1827424.75725;
export const JD_BABYL_ETPSC = 1673941.0;
export const JD_BRITTON_0 = 1721057.5;
export const JD_DJWHAL_2117 = 2488129.5;
export const JD_YUKTESHWAR_1893 = 2412544.0;
export const JD_SHEORAN_4174BCE = -1515029.5;
export const JD_VALENS_150 = 1776027.0;
export const JD_MARDYKS_1998 = 2450819.5;

export const LAHIRI_ANCHOR_JD = 2435553.5;
export const LAHIRI_TRUE_AT_ANCHOR_DEG = d(23, 15, 0.658);

const RAMAN_AYANAMSA_1900_DEG = ((1900 - 397) * (50 + 1 / 3)) / 3600;

function pm(j: number, m: number): ProfileMean {
    return { jhora: j, modern: m };
}

export const AYANAMSA_MODEL_DEFS: Record<number, AyanamsaModelDef> = {
    0: {
        kind: 'epoch',
        jd: JD_1950_JAN_1,
        meanAtAnchor: d(24, 2, 31.36),
        label: 'Fagan/Bradley',
    },
    1: {
        kind: 'lahiri',
        jd: LAHIRI_ANCHOR_JD,
        trueValue: LAHIRI_TRUE_AT_ANCHOR_DEG,
        label: 'Lahiri',
    },
    2: {
        kind: 'epoch',
        jd: JD_1900_JAN_1_NOON,
        meanAtAnchor: d(26, 24, 47),
        label: 'De Luce',
    },
    3: {
        kind: 'epoch',
        jd: JD_1900_JAN_0_5,
        meanAtAnchor: RAMAN_AYANAMSA_1900_DEG,
        label: 'Raman',
    },
    4: {
        kind: 'epoch',
        jd: JD_1900_JAN_1_NOON,
        meanAtAnchor: d(18, 39, 39.46),
        label: 'Usha-Shashi',
    },
    5: {
        kind: 'epoch',
        jd: JD_1900_JAN_0_5,
        meanAtAnchor: d(22, 21, 50),
        label: 'Krishnamurti (KP)',
    },
    6: {
        kind: 'epoch',
        jd: JD_DJWHAL_2117,
        meanAtAnchor: 0,
        label: 'Djwhal Khul',
    },
    7: {
        kind: 'epoch',
        jd: JD_YUKTESHWAR_1893,
        meanAtAnchor: d(20, 54, 36),
        label: 'Yukteshwar',
    },
    8: {
        kind: 'epoch',
        jd: JD_1900_JAN_0_5,
        meanAtAnchor: d(21, 21, 56),
        label: 'J.N. Bhasin',
    },
    9: {
        kind: 'epoch',
        jd: JD_YM100_JAN_1,
        meanAtAnchor: pm(complementDeg(3, 22), complementDeg(5, 40)),
        label: 'Babylonian Kugler 1',
    },
    10: {
        kind: 'epoch',
        jd: JD_YM100_JAN_1,
        meanAtAnchor: pm(complementDeg(4, 46), complementDeg(4, 16)),
        label: 'Babylonian Kugler 2',
    },
    11: {
        kind: 'epoch',
        jd: JD_YM100_JAN_1,
        meanAtAnchor: pm(complementDeg(5, 37), complementDeg(3, 25)),
        label: 'Babylonian Kugler 3',
    },
    12: {
        kind: 'epoch',
        jd: JD_YM100_JAN_1,
        meanAtAnchor: pm(complementDeg(4, 34), complementDeg(4, 28)),
        label: 'Babylonian Huber',
    },
    13: {
        kind: 'epoch',
        jd: JD_BABYL_ETPSC,
        meanAtAnchor: complementDeg(5, 4, 46),
        label: 'Babylonian η Piscium',
    },
    14: {
        kind: 'star',
        star: 'Aldebaran',
        atLongitude: d(15, 0),
        label: 'Aldebaran 15° Taurus',
    },
    15: {
        kind: 'epoch',
        jd: JD_HIPPARCHOS,
        meanAtAnchor: d(350, 40),
        label: 'Hipparchos',
    },
    16: {
        kind: 'epoch',
        jd: JD_SASSANIAN,
        meanAtAnchor: 0,
        label: 'Sassanian',
    },
    17: {
        kind: 'star',
        star: 'GalacticCenter',
        atLongitude: pm(d(240, 0, 25), d(240, 0)),
        label: 'Galactic centre 0° Sagittarius',
    },
    18: {
        kind: 'epoch',
        jd: JD_J2000,
        meanAtAnchor: 0,
        label: 'J2000 (no ayanamsa)',
    },
    19: {
        kind: 'epoch',
        jd: JD_1900_JAN_0_5,
        meanAtAnchor: 0,
        label: 'J1900',
    },
    20: {
        kind: 'epoch',
        jd: JD_B1950,
        meanAtAnchor: 0,
        label: 'B1950',
    },
    21: {
        kind: 'epoch',
        jd: JD_SS499_EQUINOX,
        meanAtAnchor: 0,
        label: 'Surya Siddhanta',
    },
    22: {
        kind: 'epoch',
        jd: JD_SS499_EQUINOX,
        meanAtAnchor: -0.21463395,
        label: 'Surya Siddhanta (mean Sun)',
    },
    23: {
        kind: 'epoch',
        jd: JD_ARY499_EQUINOX,
        meanAtAnchor: 0,
        label: 'Aryabhata',
    },
    24: {
        kind: 'epoch',
        jd: JD_ARY499_EQUINOX,
        meanAtAnchor: -0.23763238,
        label: 'Aryabhata (mean Sun)',
    },
    25: {
        kind: 'epoch',
        jd: JD_SS499_EQUINOX,
        meanAtAnchor: -0.79167046,
        label: 'Surya Siddhanta Revati',
    },
    26: {
        kind: 'epoch',
        jd: JD_SS499_EQUINOX,
        meanAtAnchor: 2.11070444,
        label: 'Surya Siddhanta Citra',
    },
    27: {
        kind: 'star',
        star: 'Spica',
        atLongitude: 180,
        label: 'True Chitrapaksha (Spica at 180°)',
    },
    28: {
        kind: 'star',
        star: 'ZetaPiscium',
        atLongitude: pm(0, d(359, 50)),
        label: 'True Revati',
    },
    29: {
        kind: 'star',
        star: 'DeltaCancri',
        atLongitude: 106,
        label: 'True Pushya',
    },
    30: {
        kind: 'star',
        star: 'GalacticCenter',
        atLongitude: d(242, 14, 50),
        label: 'Galactic centre (Gil Brand)',
    },
    31: {
        kind: 'galactic_node',
        siderealNodeDeg: 240,
        useLz2010: false,
        label: 'Galactic equator IAU 1958',
    },
    32: {
        kind: 'galactic_node',
        siderealNodeDeg: 240,
        useLz2010: true,
        label: 'Galactic equator (Liu/Zhu/Zhang 2010)',
    },
    33: {
        kind: 'galactic_node',
        siderealNodeDeg: 246 + 40 / 60,
        useLz2010: true,
        label: 'Galactic equator mid-Mula',
    },
    34: {
        kind: 'epoch',
        jd: JD_MARDYKS_1998,
        meanAtAnchor: d(30, 0),
        label: 'Galalign Mardyks',
    },
    35: {
        kind: 'star',
        star: 'LambdaScorpii',
        atLongitude: 240,
        label: 'True Mula',
    },
    36: {
        kind: 'star',
        star: 'GalacticCenter',
        atLongitude: d(246, 40),
        label: 'Galactic centre mid-Mula (Wilhelm)',
    },
    37: {
        kind: 'epoch',
        jd: JD_ARY522_EQUINOX,
        meanAtAnchor: 0,
        label: 'Aryabhata 522',
    },
    38: {
        kind: 'epoch',
        jd: JD_BRITTON_0,
        meanAtAnchor: 356.8,
        label: 'Babylonian Britton',
    },
    39: {
        kind: 'true_epoch',
        jd: JD_SHEORAN_4174BCE,
        trueValue: 300,
        label: 'Sheoran Vedic',
    },
    40: {
        kind: 'star',
        star: 'GalacticCenter',
        atLongitude: d(270, 0),
        label: 'Galactic centre 0° Capricorn (Cochrane)',
    },
    41: {
        kind: 'epoch',
        jd: JD_J2000,
        meanAtAnchor: d(25, 0),
        label: 'Galactic equator Fiorenza',
    },
    42: {
        kind: 'epoch',
        jd: JD_VALENS_150,
        meanAtAnchor: 357,
        label: 'Valens Moon',
    },
    43: {
        kind: 'epoch',
        jd: JD_1900_JAN_0_5,
        meanAtAnchor: d(22, 26, 45.5),
        label: 'Lahiri 1940',
    },
    44: {
        kind: 'epoch',
        jd: JD_LAHIRI_VP285,
        meanAtAnchor: 0,
        label: 'Lahiri VP285',
    },
    45: {
        kind: 'epoch',
        jd: JD_KP_VP291,
        meanAtAnchor: 0,
        label: 'Krishnamurti VP291',
    },
    46: {
        kind: 'true_epoch',
        jd: LAHIRI_ANCHOR_JD,
        trueValue: d(23, 15, 0),
        label: 'Lahiri ICRC',
    },
};

export function meanAtAnchorForProfile(value: ProfileMean, profile: 'jhora' | 'modern'): number {
    return typeof value === 'number' ? value : profile === 'modern' ? value.modern : value.jhora;
}
