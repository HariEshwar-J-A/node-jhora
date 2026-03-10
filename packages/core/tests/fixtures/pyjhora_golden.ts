/**
 * PyJHora Golden Standard Fixture
 *
 * Values extracted verbatim from:
 *   PyJHora/src/jhora/tests/pvr_tests.py  — divisional_chart_tests(), ayanamsa_tests()
 *   PyJHora/src/jhora/tests/test_outputs_lahiri_mean_nodes.json
 *
 * Reference Birth Chart ("Own Chart"):
 *   DOB : 1996-12-07
 *   TOB : 10:34:00 IST  (UTC +5:30  →  05:04:00 UTC)
 *   Place: Chennai, India  (13.0878°N, 80.2785°E)
 *   Ayanamsa: Lahiri (SE_SIDM_LAHIRI = 1)
 *   Nodes:    Mean
 *
 * Planet index mapping (PyJHora):
 *   0=Sun  1=Moon  2=Mars  3=Mercury  4=Jupiter  5=Venus  6=Saturn  7=Rahu  8=Ketu
 *   (PyJHora MARS_ID=2, MERCURY_ID=3 per const.py — differs from SE body IDs)
 *
 * House/sign index: 0-based (0=Aries … 11=Pisces)
 * To convert to node-jhora sign (1-12): sign = house + 1
 */

export const PYJHORA_BIRTH_CHART = {
    dob:   { year: 1996, month: 12, day: 7 },
    /** Local time in IST */
    tob:   { hour: 10, minute: 34, second: 0, utcOffset: 5.5 },
    /** Equivalent UTC time passed to engine */
    tobUTC: { hour: 5, minute: 4, second: 0 },
    lat:   13.0878,
    lon:   80.2785,
    /** Approximate JD — computed by engine at runtime */
    jdApprox: 2450424.7111,
} as const;

// ---------------------------------------------------------------------------
// Ayanamsa golden values (degrees) at the reference JD
// Source: ayanamsa_tests() in pvr_tests.py
// ---------------------------------------------------------------------------

/** SE_SIDM codes mapped to PyJHora ayanamsa names and expected degree values */
export const PYJHORA_AYANAMSA = [
    { name: 'LAHIRI',      seCode: 1,  expectedDeg: 23.814256257896147  },
    { name: 'RAMAN',       seCode: 3,  expectedDeg: 22.367954940799223  },
    { name: 'KP',          seCode: 5,  expectedDeg: 23.717403940799215  },
    { name: 'YUKTESHWAR',  seCode: 7,  expectedDeg: 22.43596692828089   },
    { name: 'TRUE_PUSHYA', seCode: 29, expectedDeg: 22.682633426268836  },
] as const;

// ---------------------------------------------------------------------------
// D-Chart golden values
// Source: divisional_chart_tests() in pvr_tests.py  (lines 6459–6495)
//
// Format per entry: [planetLabel, [houseIdx_0based, degreeInSign]]
//   houseIdx 0-based:  0=Aries … 9=Capricorn … 11=Pisces
//   planetLabel: 'L'=Ascendant, 0=Sun, 1=Moon, 2=Mars, 3=Mercury,
//                4=Jupiter, 5=Venus, 6=Saturn, 7=Rahu, 8=Ketu
// ---------------------------------------------------------------------------

export type PlanetLabel = 'L' | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type GoldenEntry = [PlanetLabel, [number, number]];  // [label, [houseIdx, deg]]

export const PYJHORA_DCHARTS: Record<number, GoldenEntry[]> = {
    1:  [['L',[3,22.44]],[0,[7,21.72]],[1,[11,21.25]],[2,[8,17.85]],[3,[7,0.81]],[4,[6,6.00]],[5,[8,16.46]],[6,[2,21.84]],[7,[5,10.55]],[8,[11,10.55]]],
    2:  [['L',[2,13.44]],[0,[2,13.44]],[1,[10,12.50]],[2,[5,5.70]],[3,[3,1.61]],[4,[0,12.00]],[5,[5,2.91]],[6,[5,13.69]],[7,[11,21.11]],[8,[11,21.11]]],
    3:  [['L',[3,5.16]],[0,[3,5.16]],[1,[7,3.74]],[2,[0,23.55]],[3,[7,2.42]],[4,[6,17.99]],[5,[0,19.37]],[6,[10,5.53]],[7,[9,1.66]],[8,[3,1.66]]],
    4:  [['L',[1,26.88]],[0,[1,26.88]],[1,[5,24.99]],[2,[2,11.41]],[3,[7,3.23]],[4,[6,23.99]],[5,[2,5.82]],[6,[8,27.37]],[7,[8,12.22]],[8,[2,12.22]]],
    5:  [['L',[2,18.60]],[0,[2,18.60]],[1,[10,16.24]],[2,[6,29.26]],[3,[11,4.04]],[4,[6,29.99]],[5,[6,22.28]],[6,[1,19.22]],[7,[2,22.77]],[8,[8,22.77]]],
    7:  [['L',[6,2.04]],[0,[6,2.04]],[1,[9,28.73]],[2,[0,4.96]],[3,[1,5.65]],[4,[7,11.99]],[5,[11,25.19]],[6,[7,2.90]],[7,[1,13.88]],[8,[7,13.88]]],
    9:  [['L',[9,15.48]],[0,[9,15.48]],[1,[9,11.23]],[2,[5,10.66]],[3,[3,7.26]],[4,[7,23.98]],[5,[4,28.10]],[6,[0,16.59]],[7,[0,4.98]],[8,[6,4.98]]],
    10: [['L',[10,7.20]],[0,[10,7.20]],[1,[2,2.48]],[2,[1,28.51]],[3,[3,8.07]],[4,[7,29.98]],[5,[1,14.55]],[6,[9,8.43]],[7,[4,15.54]],[8,[10,15.54]]],
    12: [['L',[3,20.65]],[0,[3,20.65]],[1,[7,14.97]],[2,[3,4.22]],[3,[7,9.69]],[4,[8,11.98]],[5,[2,17.46]],[6,[10,22.12]],[7,[9,6.65]],[8,[3,6.65]]],
    16: [['L',[3,17.53]],[0,[3,17.53]],[1,[7,9.96]],[2,[5,15.62]],[3,[4,12.91]],[4,[3,5.97]],[5,[4,23.28]],[6,[7,19.50]],[7,[1,18.86]],[8,[1,18.86]]],
    20: [['L',[10,14.41]],[0,[10,14.41]],[1,[6,4.95]],[2,[3,27.03]],[3,[8,16.14]],[4,[3,29.96]],[5,[2,29.10]],[6,[6,16.87]],[7,[11,1.08]],[8,[11,1.08]]],
    24: [['L',[8,11.29]],[0,[8,11.29]],[1,[7,29.94]],[2,[6,8.44]],[3,[3,19.37]],[4,[8,23.95]],[5,[5,4.92]],[6,[9,14.24]],[7,[11,13.29]],[8,[11,13.29]]],
    27: [['L',[4,16.45]],[0,[4,16.45]],[1,[4,3.69]],[2,[4,1.99]],[3,[9,21.79]],[4,[11,11.95]],[5,[2,24.29]],[6,[1,19.77]],[7,[0,14.95]],[8,[6,14.95]]],
    30: [['L',[9,21.61]],[0,[9,21.61]],[1,[9,7.43]],[2,[8,25.54]],[3,[1,24.21]],[4,[10,29.94]],[5,[8,13.65]],[6,[2,25.30]],[7,[5,16.61]],[8,[5,16.61]]],
    40: [['L',[10,28.82]],[0,[10,28.82]],[1,[10,9.91]],[2,[11,24.06]],[3,[7,2.28]],[4,[7,29.92]],[5,[9,28.20]],[6,[5,3.74]],[7,[8,2.15]],[8,[8,2.15]]],
    45: [['L',[0,17.42]],[0,[0,17.42]],[1,[3,26.15]],[2,[10,23.32]],[3,[5,6.32]],[4,[8,29.91]],[5,[8,20.48]],[6,[4,22.96]],[7,[11,24.92]],[8,[11,24.92]]],
    60: [['L',[2,13.23]],[0,[2,13.23]],[1,[5,14.86]],[2,[7,21.09]],[3,[8,18.43]],[4,[5,29.88]],[5,[4,27.30]],[6,[9,20.61]],[7,[2,3.23]],[8,[8,3.23]]],
};

/**
 * Sign names (0-indexed, matching PyJHora RAASI_LIST)
 * Used in test failure messages for readability.
 */
export const RASI_NAMES = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
] as const;

/**
 * Planet names in PyJHora index order (0-8).
 * PyJHora: 0=Sun 1=Moon 2=Mars 3=Mercury 4=Jupiter 5=Venus 6=Saturn 7=Rahu 8=Ketu
 * (MARS_ID=2, MERCURY_ID=3 per PyJHora/src/jhora/const.py)
 */
export const PYJHORA_PLANET_NAMES: Record<PlanetLabel, string> = {
    'L': 'Ascendant',
    0: 'Sun',
    1: 'Moon',
    2: 'Mars',
    3: 'Mercury',
    4: 'Jupiter',
    5: 'Venus',
    6: 'Saturn',
    7: 'Rahu',
    8: 'Ketu',
};

/**
 * Maps PyJHora planet index → node-jhora planet name string
 * (as returned by EphemerisEngine.getPlanets()[n].name)
 * PyJHora internal order: 0=Sun 1=Moon 2=Mars 3=Mercury 4=Jupiter 5=Venus 6=Saturn 7=Rahu 8=Ketu
 */
export const PYJHORA_TO_NODE_NAME: Record<number, string> = {
    0: 'Sun',
    1: 'Moon',
    2: 'Mars',
    3: 'Mercury',
    4: 'Jupiter',
    5: 'Venus',
    6: 'Saturn',
    7: 'Rahu',
    8: 'Ketu',
};
