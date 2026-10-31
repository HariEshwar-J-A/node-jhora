/**
 * Sunshine houses — Makransky algorithm (registry letter `i`; see swephprg.htm).
 *
 * All intermediate cusp math follows Bob Makransky, _Primary Directions: A Primer
 * of Calculation_ (1988): meridian distance, pole, ascensional difference Q, and
 * oblique ascension W (pp. 36–39); Solar House Cusp Algorithm and east/west hour-
 * circle continuation, fig. IV-4 (pp. 147–148); southern-latitude RAIC rule (p. 148).
 *
 * Letter `I` vs `i` naming only: Swiss Ephemeris programmer documentation (swephprg.htm).
 * Treindl/APC in `house-systems.ts` matches this construction when min(DSA, NSA) ≥ 45°;
 * below that wedge, pp. 147–148 require the full algorithm.
 */

import { mod360 } from './coordinates.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Non-angular cusps computed by {@link makranskyIntermediateCusp}. */
export type MakranskyIntermediateIndex = 2 | 3 | 5 | 6 | 8 | 9 | 11 | 12;

function clampUnit(x: number): number {
    return Math.max(-1, Math.min(1, x));
}

/**
 * Steps 6–9 of the Solar House Cusp Algorithm (Makransky 1988, pp. 147–148):
 * `tan λ = sin W / (cos ε cos W − sin ε tan p)` with oriented pole height `p`.
 */
function makranskyEclipticCut(
    wDeg: number,
    poleDeg: number,
    epsRad: number,
    easternFamily: boolean,
): number {
    const effectivePole = easternFamily ? Math.abs(poleDeg) : -Math.abs(poleDeg);
    const wRad = wDeg * DEG;
    const poleRad = effectivePole * DEG;
    const lon =
        Math.atan2(
            Math.sin(wRad),
            Math.cos(epsRad) * Math.cos(wRad) - Math.sin(epsRad) * Math.tan(poleRad),
        ) * RAD;
    return mod360(lon);
}

/**
 * One intermediate Sunshine cusp from Makransky's RA-offset construction.
 * See module header for primary references.
 */
export function makranskyIntermediateCusp(
    index: MakranskyIntermediateIndex,
    offsetDeg: number,
    armcDeg: number,
    latDeg: number,
    sunDecDeg: number,
    epsDeg: number,
): number {
    const nocturnal = index === 2 || index === 3 || index === 5 || index === 6;
    const easternFamily = index === 2 || index === 3 || index === 11 || index === 12;
    const epsRad = epsDeg * DEG;

    const raDeg = mod360(armcDeg + (nocturnal ? 180 : 0) + offsetDeg);

    const rawMd = Math.abs(offsetDeg);
    const beyondEastWest = rawMd > 90;
    const mdDeg = beyondEastWest ? 180 - rawMd : rawMd;

    const isUpperDistance = (nocturnal ? false : true) !== beyondEastWest;

    const latRad = latDeg * DEG;
    const absLatRad = Math.abs(latDeg) * DEG;
    const decRad = sunDecDeg * DEG;
    const mdRad = mdDeg * DEG;

    let zenithDistance: number;
    if (Math.abs(mdDeg - 90) < 1e-12) {
        zenithDistance = 90 - Math.atan(Math.sin(absLatRad) * Math.tan(decRad)) * RAD;
    } else {
        const angleA = Math.atan(Math.cos(latRad) * Math.tan(mdRad)) * RAD;
        const angleB = Math.atan(Math.tan(absLatRad) * Math.cos(mdRad)) * RAD;
        const sameDeclHem = sunDecDeg >= 0 === latDeg >= 0;
        const cSign = sameDeclHem === isUpperDistance ? -1 : 1;
        const triangleC = angleB + cSign * Math.abs(sunDecDeg);
        const angleF =
            Math.atan(Math.sin(absLatRad) * Math.sin(mdRad) * Math.tan(triangleC * DEG)) * RAD;
        zenithDistance = angleA + angleF;
        if (beyondEastWest) {
            zenithDistance = Math.abs(zenithDistance - 90);
        }
    }

    const poleDeg = Math.asin(clampUnit(Math.sin(latRad) * Math.sin(zenithDistance * DEG))) * RAD;
    const qDeg = Math.asin(clampUnit(Math.tan(decRad) * Math.tan(poleDeg * DEG))) * RAD;

    let qSign = easternFamily ? -1 : 1;
    if (beyondEastWest) qSign = -qSign;
    const wDeg = mod360(raDeg + qSign * qDeg);

    return makranskyEclipticCut(wDeg, poleDeg, epsRad, easternFamily);
}

/** True when the Sun is circumpolar at `latDeg` (no sunrise/sunset). */
export function makranskySunCircumpolar(latDeg: number, sunDecDeg: number): boolean {
    return Math.abs(Math.tan(sunDecDeg * DEG) * Math.tan(latDeg * DEG)) >= 1 - 1e-15;
}

/**
 * Twelve tropical ecliptic cusps for Makransky Sunshine (`i`).
 * Angular cusps use supplied asc/mc (already oriented per SE §6.4).
 */
export function makranskySunshineCusps(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
    sunDecDeg: number,
): number[] {
    if (makranskySunCircumpolar(lat, sunDecDeg)) {
        throw new Error(`Sunshine Makransky: Sun circumpolar at lat=${lat}, decl=${sunDecDeg}`);
    }

    const tanProduct = Math.tan(sunDecDeg * DEG) * Math.tan(lat * DEG);
    const ad = Math.asin(clampUnit(tanProduct)) * RAD;
    const nocturnalSemiarc = 90 - ad;
    const diurnalSemiarc = 90 + ad;
    const nightThird = nocturnalSemiarc / 3;
    const dayThird = diurnalSemiarc / 3;

    const southern = lat < 0;
    const workingArmc = southern ? mod360(ramc + 180) : ramc;
    const outputRotation = southern ? 180 : 0;

    const cusps = new Array<number>(12);
    cusps[0] = asc;
    cusps[6] = mod360(asc + 180);
    cusps[9] = mc;
    cusps[3] = mod360(mc + 180);

    const offsets: ReadonlyArray<readonly [MakranskyIntermediateIndex, number]> = [
        [2, -2 * nightThird],
        [3, -nightThird],
        [5, nightThird],
        [6, 2 * nightThird],
        [8, -2 * dayThird],
        [9, -dayThird],
        [11, dayThird],
        [12, 2 * dayThird],
    ];

    for (const [house, offset] of offsets) {
        const lon = makranskyIntermediateCusp(house, offset, workingArmc, lat, sunDecDeg, eps);
        cusps[house - 1] = mod360(lon + outputRotation);
    }

    return cusps;
}
