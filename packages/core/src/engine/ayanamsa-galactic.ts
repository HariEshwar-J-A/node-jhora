// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Galactic-equator node on the mean ecliptic of date (IAU 1958 / Liu et al. 2010 poles).
 * Pole ICRS coordinates from the IAU 1958 system (B1950) as given in Malkin 2012
 * and standard references; Liu/Zhu/Zhang 2010 node offset applied for mode 32.
 */

import { deltaT } from './deltat.js';
import { icrfToMeanEclipticOfDate, julianCenturies, toSpherical, type Vec } from './precession.js';

const DEG = Math.PI / 180;
const hms = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
const dms = (d: number, m: number, s: number): number => d + m / 60 + s / 3600;

/** IAU 1958 galactic pole at J2000.0 (ICRS), Malkin 2012 / standard galactic coordinates. */
const POLE_IAU1958_J2000: Vec = (() => {
    const ra = hms(12, 51, 26.282) * DEG;
    const dec = dms(27, 7, 42.01) * DEG;
    return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
})();

/** Liu, Zhu & Zhang 2010: node on the ecliptic shifts +3′11″ vs IAU 1958 (swisseph §2.8.9). */
export const LZ2010_NODE_OFFSET_ARCSEC = 3 * 60 + 11;

function cross(a: Vec, b: Vec): Vec {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec): Vec {
    const n = Math.hypot(v[0], v[1], v[2]);
    return n === 0 ? [0, 0, 1] : [v[0] / n, v[1] / n, v[2] / n];
}

function poleOnMeanEcliptic(jdUT: number, useLz2010: boolean): Vec {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const T = julianCenturies(jdTT);
    let poleEcl = icrfToMeanEclipticOfDate(POLE_IAU1958_J2000, T, jdTT);
    if (useLz2010) {
        const sph = toSpherical(poleEcl);
        const adjLon = sph.lon + LZ2010_NODE_OFFSET_ARCSEC / 3600;
        const ob = sph.lat;
        poleEcl = [
            Math.cos(ob * DEG) * Math.cos(adjLon * DEG),
            Math.cos(ob * DEG) * Math.sin(adjLon * DEG),
            Math.sin(ob * DEG),
        ];
    }
    return poleEcl;
}

/** Tropical longitude of the ascending node of the galactic equator on the mean ecliptic of date. */
export function galacticEquatorNodeLongitude(jdUT: number, useLz2010: boolean): number {
    const poleEcl = poleOnMeanEcliptic(jdUT, useLz2010);
    const eclNorth: Vec = [0, 0, 1];
    const nodeDir = cross(poleEcl, eclNorth);
    return toSpherical(normalize(nodeDir)).lon;
}

/** Mean ayanamsa placing the galactic node at `siderealNodeDeg`. */
export function ayanamsaForGalacticNode(
    jdUT: number,
    siderealNodeDeg: number,
    useLz2010: boolean,
): number {
    const nodeTropical = galacticEquatorNodeLongitude(jdUT, useLz2010) + 180;
    return (((nodeTropical - siderealNodeDeg) % 360) + 360) % 360;
}
