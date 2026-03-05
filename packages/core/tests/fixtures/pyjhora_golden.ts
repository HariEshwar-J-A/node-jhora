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
    1:  [['L',[9,22.45]],[0,[7,21.57]],[1,[6,6.96]],[2,[4,25.54]],[3,[8,9.94]],[4,[8,25.83]],[5,[6,23.72]],[6,[11,6.81]],[7,[5,10.55]],[8,[11,10.55]]],
    2:  [['L',[6,14.89]],[0,[2,13.13]],[1,[0,13.92]],[2,[9,21.08]],[3,[4,19.87]],[4,[5,21.66]],[5,[1,17.43]],[6,[11,13.61]],[7,[11,21.11]],[8,[11,21.11]]],
    3:  [['L',[5,7.34]],[0,[3,4.7]],[1,[6,20.88]],[2,[0,16.62]],[3,[8,29.81]],[4,[4,17.48]],[5,[2,11.15]],[6,[11,20.42]],[7,[9,1.66]],[8,[3,1.66]]],
    4:  [['L',[3,29.78]],[0,[1,26.26]],[1,[6,27.84]],[2,[1,12.16]],[3,[11,9.75]],[4,[5,13.31]],[5,[3,4.87]],[6,[11,27.23]],[7,[8,12.22]],[8,[2,12.22]]],
    5:  [['L',[9,22.23]],[0,[9,17.83]],[1,[10,4.8]],[2,[6,7.7]],[3,[10,19.68]],[4,[6,9.14]],[5,[2,28.59]],[6,[5,4.04]],[7,[5,22.77]],[8,[5,22.77]]],
    6:  [['L',[10,14.67]],[0,[10,9.39]],[1,[1,11.76]],[2,[5,3.24]],[3,[1,29.62]],[4,[5,4.97]],[5,[4,22.3]],[6,[7,10.84]],[7,[8,3.32]],[8,[8,3.32]]],
    7:  [['L',[8,7.12]],[0,[6,0.96]],[1,[7,18.72]],[2,[9,28.78]],[3,[10,9.56]],[4,[2,0.8]],[5,[11,16.02]],[6,[6,17.65]],[7,[1,13.88]],[8,[7,13.88]]],
    8:  [['L',[5,29.57]],[0,[1,22.52]],[1,[1,25.68]],[2,[2,24.32]],[3,[6,19.49]],[4,[10,26.62]],[5,[6,9.74]],[6,[5,24.46]],[7,[6,24.43]],[8,[6,24.43]]],
    9:  [['L',[3,22.01]],[0,[9,14.09]],[1,[8,2.64]],[2,[7,19.86]],[3,[2,29.43]],[4,[7,22.45]],[5,[1,3.45]],[6,[5,1.27]],[7,[0,4.98]],[8,[6,4.98]]],
    10: [['L',[0,14.46]],[0,[10,5.65]],[1,[8,9.59]],[2,[0,15.4]],[3,[11,9.36]],[4,[4,18.28]],[5,[1,27.17]],[6,[9,8.07]],[7,[4,15.54]],[8,[10,15.54]]],
    11: [['L',[11,6.9]],[0,[0,27.22]],[1,[8,16.55]],[2,[5,10.94]],[3,[7,19.3]],[4,[1,14.11]],[5,[2,20.89]],[6,[3,14.88]],[7,[10,26.09]],[8,[4,26.09]]],
    12: [['L',[5,29.35]],[0,[3,18.78]],[1,[8,23.51]],[2,[2,6.48]],[3,[11,29.24]],[4,[6,9.94]],[5,[3,14.61]],[6,[1,21.69]],[7,[9,6.65]],[8,[3,6.65]]],
    16: [['L',[11,29.13]],[0,[3,15.04]],[1,[3,21.35]],[2,[5,18.64]],[3,[1,8.98]],[4,[9,23.25]],[5,[0,19.47]],[6,[11,18.92]],[7,[1,18.86]],[8,[1,18.86]]],
    20: [['L',[2,28.92]],[0,[10,11.31]],[1,[4,19.19]],[2,[1,0.79]],[3,[10,18.73]],[4,[9,6.56]],[5,[3,24.34]],[6,[8,16.15]],[7,[11,1.08]],[8,[11,1.08]]],
    24: [['L',[8,28.7]],[0,[8,7.57]],[1,[9,17.03]],[2,[0,12.95]],[3,[11,28.47]],[4,[0,19.87]],[5,[10,29.21]],[6,[8,13.37]],[7,[11,13.29]],[8,[11,13.29]]],
    27: [['L',[11,6.04]],[0,[4,12.26]],[1,[0,7.91]],[2,[10,29.57]],[3,[8,28.28]],[4,[11,7.36]],[5,[3,10.36]],[6,[3,3.8]],[7,[0,14.95]],[8,[6,14.95]]],
    30: [['L',[9,13.37]],[0,[9,16.96]],[1,[10,28.78]],[2,[6,16.19]],[3,[10,28.09]],[4,[6,24.84]],[5,[2,21.51]],[6,[5,24.22]],[7,[5,16.61]],[8,[5,16.61]]],
    40: [['L',[11,27.83]],[0,[10,22.61]],[1,[9,8.38]],[2,[10,1.59]],[3,[1,7.46]],[4,[10,13.12]],[5,[7,18.69]],[6,[3,2.29]],[7,[8,2.15]],[8,[8,2.15]]],
    45: [['L',[9,20.06]],[0,[0,10.44]],[1,[10,13.18]],[2,[6,9.29]],[3,[10,27.14]],[4,[10,22.26]],[5,[11,17.27]],[6,[6,6.33]],[7,[11,24.92]],[8,[11,24.92]]],
    60: [['L',[5,26.75]],[0,[2,3.92]],[1,[7,27.57]],[2,[7,2.38]],[3,[3,26.19]],[4,[11,19.68]],[5,[5,13.03]],[6,[0,18.44]],[7,[2,3.23]],[8,[8,3.23]]],
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
