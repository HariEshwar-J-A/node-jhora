/**
 * house-systems.ts — Clean-room tropical house cusp calculator for Swiss Ephemeris
 * letter codes used by node-jhora.
 *
 * Definitions follow Swiss Ephemeris general documentation §6.2–6.4 (swisseph.htm),
 * Holden (*Elements of House Division*), Munkasey (*House Formulary*), Pullen
 * (Astrolog / SE Yahoo group 2016), and closed-form Regiomontanus/Campanus/Koch
 * geometry aligned with oxiephemeris-astro (MIT, docs.rs) — no Swiss Ephemeris
 * or JHora source was consulted.
 */

import {
    computeAscendant,
    computeMC,
    equalHouseCusps,
    mod360,
    placidusCusps,
    type PlacidusScheme,
    porphyryCusps,
    wholeSignCusps,
} from './coordinates.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Swiss Ephemeris / node-jhora house system letter codes. */
export type HouseLetter =
    | 'A'
    | 'B'
    | 'C'
    | 'D'
    | 'E'
    | 'F'
    | 'G'
    | 'H'
    | 'I'
    | 'i'
    | 'K'
    | 'L'
    | 'M'
    | 'N'
    | 'O'
    | 'P'
    | 'Q'
    | 'R'
    | 'S'
    | 'T'
    | 'U'
    | 'V'
    | 'W'
    | 'X'
    | 'Y';

export type HouseComputeOptions = {
    /** Placidus pole iteration profile (`P`, and Gauquelin sector subdivision). */
    placidusScheme: PlacidusScheme;
    /** When Placidus/Koch are undefined beyond the polar circle (SE §6.4). */
    polarFallback: 'porphyry' | 'error';
    /** Ecliptic longitude of the Sun (degrees); required for `I` / `i` Sunshine. */
    sunEclipticLongitude?: number;
};

export type HouseComputeResult = {
    cusps: number[];
    ascendant: number;
    mc: number;
    armc: number;
    vertex: number;
    equAsc?: number;
    coAscKoch?: number;
    coAscMunkasey?: number;
    polAsc?: number;
    gauquelinSectors?: number[];
    fallback?: { code: string; message: string; usedLetter?: HouseLetter };
};

// ---------------------------------------------------------------------------
// Spherical helpers
// ---------------------------------------------------------------------------

function eclipticLongitudeFromRa(alphaDeg: number, eps: number): number {
    const a = alphaDeg * DEG;
    const cosE = Math.cos(eps * DEG);
    return mod360(Math.atan2(Math.sin(a), Math.cos(a) * cosE) * RAD);
}

function raDeclFromEcliptic(lon: number, beta: number, eps: number): [number, number] {
    const L = lon * DEG;
    const B = beta * DEG;
    const E = eps * DEG;
    const dec =
        Math.asin(Math.sin(B) * Math.cos(E) + Math.cos(B) * Math.sin(E) * Math.sin(L)) * RAD;
    const ra = Math.atan2(Math.sin(L) * Math.cos(E) - Math.tan(B) * Math.sin(E), Math.cos(L)) * RAD;
    return [mod360(ra), dec];
}

function forwardArc(from: number, to: number): number {
    const d = mod360(to - from);
    return d === 0 ? 360 : d;
}

function branchLongitude(y: number, x: number): number | undefined {
    if (Math.hypot(x, y) < 1e-12) return undefined;
    return mod360(Math.atan2(y, x) * RAD);
}

function assembleQuadrant(
    asc: number,
    mc: number,
    c11: number,
    c12: number,
    c2: number,
    c3: number,
): number[] {
    return [
        asc,
        c2,
        c3,
        mod360(mc + 180),
        mod360(c11 + 180),
        mod360(c12 + 180),
        mod360(asc + 180),
        mod360(c2 + 180),
        mod360(c3 + 180),
        mc,
        c11,
        c12,
    ];
}

function polarCircleExceeded(lat: number, eps: number): boolean {
    return Math.abs(Math.tan(lat * DEG) * Math.tan(eps * DEG)) >= 1 - 1e-15;
}

/** MC altitude at meridian transit (degrees). */
function mcAltitude(ramc: number, lat: number, eps: number): number {
    const [, decMc] = raDeclFromEcliptic(computeMC(ramc, eps), 0, eps);
    const phi = lat * DEG;
    const d = decMc * DEG;
    return Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d)) * RAD;
}

/**
 * SE §6.4: when the MC is below the horizon, Regiomontanus/Campanus/Sunshine swap
 * MC and IC and orient the system clockwise.
 */
export function polarOrientedMcIc(
    ramc: number,
    lat: number,
    eps: number,
    mc: number,
): { mc: number; ic: number; swapped: boolean } {
    const alt = mcAltitude(ramc, lat, eps);
    if (alt >= 0) return { mc, ic: mod360(mc + 180), swapped: false };
    return { mc: mod360(mc + 180), ic: mc, swapped: true };
}

function porphyryFromAngles(asc: number, mc: number): number[] {
    return porphyryCusps(asc, mc);
}

// ---------------------------------------------------------------------------
// Quadrant systems (oxiephemeris closed forms + existing porphyry/placidus)
// ---------------------------------------------------------------------------

/** Regiomontanus cusp: great circle through equator point at RA offset `kRad` and horizon N/S. */
function regiomontanusCusp(ramc: number, lat: number, eps: number, kRad: number): number {
    const phi = lat * DEG;
    const rho = ramc * DEG + kRad;
    const y = Math.cos(phi) * Math.sin(rho);
    const x =
        Math.cos(phi) * Math.cos(rho) * Math.cos(eps * DEG) -
        Math.sin(phi) * Math.sin(kRad) * Math.sin(eps * DEG);
    const lam = branchLongitude(y, x);
    if (lam === undefined) throw new Error('Regiomontanus degenerate');
    return lam;
}

function regiomontanusCusps(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
): number[] {
    const c11 = regiomontanusCusp(ramc, lat, eps, Math.PI / 6);
    const c12 = regiomontanusCusp(ramc, lat, eps, Math.PI / 3);
    const c2 = regiomontanusCusp(ramc, lat, eps, (2 * Math.PI) / 3);
    const c3 = regiomontanusCusp(ramc, lat, eps, (5 * Math.PI) / 6);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

function campanusCusps(ramc: number, lat: number, eps: number, asc: number, mc: number): number[] {
    const theta = ramc * DEG;
    const phi = lat * DEG;
    const cusp = (a: number): number => {
        const [sinA, cosA] = [Math.sin(a), Math.cos(a)];
        const y = cosA * Math.sin(theta) + sinA * Math.cos(phi) * Math.cos(theta);
        const x =
            Math.cos(eps * DEG) *
                (cosA * Math.cos(theta) - sinA * Math.cos(phi) * Math.sin(theta)) -
            Math.sin(eps * DEG) * Math.sin(phi) * sinA;
        const lam = branchLongitude(y, x);
        if (lam === undefined) throw new Error('Campanus degenerate');
        return lam;
    };
    const c11 = cusp(Math.PI / 6);
    const c12 = cusp(Math.PI / 3);
    const c2 = cusp((2 * Math.PI) / 3);
    const c3 = cusp((5 * Math.PI) / 6);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

function kochCusps(ramc: number, lat: number, eps: number, asc: number, mc: number): number[] {
    const tanProduct = Math.tan(lat * DEG) * Math.tan(eps * DEG);
    const h0 = Math.acos(Math.max(-1, Math.min(1, -tanProduct * Math.sin(ramc * DEG))));
    const third = (h0 * RAD) / 3;
    const shiftedAsc = (shiftDeg: number) => computeAscendant(ramc + shiftDeg, lat, eps);
    const c11 = shiftedAsc(-2 * third);
    const c12 = shiftedAsc(-third);
    const c2 = shiftedAsc(third);
    const c3 = shiftedAsc(2 * third);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

/** Alcabitius (SE §6.2.11): trisect equatorial arcs MC→Asc and Asc→IC; meridian circles. */
function alcabitiusCusps(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
): number[] {
    const [raAsc] = raDeclFromEcliptic(asc, 0, eps);
    const raMc = mod360(ramc);
    const raIc = mod360(ramc + 180);
    const arcMcAsc = forwardArc(raMc, raAsc);
    const arcAscIc = forwardArc(raAsc, raIc);
    const c11 = eclipticLongitudeFromRa(mod360(raMc + arcMcAsc / 3), eps);
    const c12 = eclipticLongitudeFromRa(mod360(raMc + (2 * arcMcAsc) / 3), eps);
    const c2 = eclipticLongitudeFromRa(mod360(raAsc + arcAscIc / 3), eps);
    const c3 = eclipticLongitudeFromRa(mod360(raAsc + (2 * arcAscIc) / 3), eps);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

/**
 * Morinus (§6.2.8): equator divided into 12 equal parts from the ARMC, converted to
 * ecliptic longitudes. SE applies the same RA→λ map as the meridian (axial) system
 * with a +90° ecliptic offset (Morinus cusp 10 is the MC ecliptic point, cusp 1
 * the equatorial ascendant longitude).
 */
function morinusCusps(ramc: number, eps: number): number[] {
    return Array.from({ length: 12 }, (_, i) =>
        mod360(eclipticLongitudeFromRa(mod360(ramc + i * 30), eps) + 90),
    );
}

/** Axial rotation / Meridian (SE §6.2.7): equal RA steps from RAMC+90 (equatorial asc). */
function meridianAxialCusps(ramc: number, eps: number): number[] {
    const start = mod360(ramc + 90);
    return Array.from({ length: 12 }, (_, i) =>
        eclipticLongitudeFromRa(mod360(start + i * 30), eps),
    );
}

/** Carter poli-equatorial (SE §6.2.7): equal RA steps from the ascendant’s RA. */
function carterPoliEquatorialCusps(asc: number, eps: number): number[] {
    const [raAsc] = raDeclFromEcliptic(asc, 0, eps);
    return Array.from({ length: 12 }, (_, i) =>
        eclipticLongitudeFromRa(mod360(raAsc + i * 30), eps),
    );
}

function pullenSdQuadrant(q: number): [number, number, number] {
    const excess = q - 90;
    const n = excess / 2;
    const quarter = excess / 4;
    let wOuter = 30 + quarter;
    let wMid = 30 + n;
    if (wMid < 0) wMid = 0;
    if (wOuter < 0) wOuter = 0;
    return [wOuter, wMid, wOuter];
}

function pullenSdCusps(asc: number, mc: number): number[] {
    const ic = mod360(mc + 180);
    const qMcAsc = forwardArc(mc, asc);
    const qAscIc = forwardArc(asc, ic);
    const qIcDesc = forwardArc(ic, mod360(asc + 180));
    const qDescMc = forwardArc(mod360(asc + 180), mc);
    const [w1a, w1b, w1c] = pullenSdQuadrant(qMcAsc);
    const [w2a, w2b, w2c] = pullenSdQuadrant(qAscIc);
    const [w3a, w3b, w3c] = pullenSdQuadrant(qIcDesc);
    const [w4a, w4b, w4c] = pullenSdQuadrant(qDescMc);
    const c11 = mod360(mc + w1a);
    const c12 = mod360(c11 + w1b);
    const c2 = mod360(asc + w2a);
    const c3 = mod360(c2 + w2b);
    const c5 = mod360(c11 + 180);
    const c6 = mod360(c12 + 180);
    const c8 = mod360(c2 + 180);
    const c9 = mod360(c3 + 180);
    void w3a;
    void w3b;
    void w4a;
    void w4b;
    return [asc, c2, c3, ic, c5, c6, mod360(asc + 180), c8, c9, mc, c11, c12];
}

/** Pullen SR: solve r from rx + x + rx = qc and r³x + r⁴x + r³x = 180 − qc (§6.2.6). */
function solvePullenRatio(qc: number): number {
    if (Math.abs(qc - 90) < 1e-12) return 1;
    let r = 1;
    for (let i = 0; i < 50; i++) {
        const num = (qc * r * r * r * (2 + r)) / (1 + 2 * r);
        const f = num - (180 - qc);
        const dr = 1e-8;
        const r2 = r + dr;
        const f2 = (qc * r2 * r2 * r2 * (2 + r2)) / (1 + 2 * r2) - (180 - qc);
        const df = (f2 - f) / dr;
        if (Math.abs(df) < 1e-15) break;
        r -= f / df;
        if (r < 0.001) r = 0.001;
    }
    return r;
}

function pullenSrFirstTwo(q: number): [number, number] {
    const qc = q <= 90 ? q : 180 - q;
    const r = solvePullenRatio(qc);
    const x = qc / (1 + 2 * r);
    if (q >= 90) return [r * r * r * x, r * r * r * r * x];
    return [r * x, x];
}

function pullenSrCusps(asc: number, mc: number): number[] {
    const ic = mod360(mc + 180);
    const qMcAsc = forwardArc(mc, asc);
    const qAscIc = forwardArc(asc, ic);
    const [a1, b1] = pullenSrFirstTwo(qMcAsc);
    const [a2, b2] = pullenSrFirstTwo(qAscIc);
    const c11 = mod360(mc + a1);
    const c12 = mod360(c11 + b1);
    const c2 = mod360(asc + a2);
    const c3 = mod360(c2 + b2);
    const c5 = mod360(c11 + 180);
    const c6 = mod360(c12 + 180);
    const c8 = mod360(c2 + 180);
    const c9 = mod360(c3 + 180);
    return [asc, c2, c3, ic, c5, c6, mod360(asc + 180), c8, c9, mc, c11, c12];
}

function sripatiCusps(asc: number, mc: number): number[] {
    const p = porphyryCusps(asc, mc);
    const out = new Array<number>(12);
    for (let i = 0; i < 12; i++) {
        const prev = p[(i + 11) % 12];
        const cur = p[i];
        out[i] = mod360(prev + forwardArc(prev, cur) / 2);
    }
    return out;
}

/** Polich–Page / topocentric (SE §6.2.10): pole tan = tan φ / 3, 2/3 for 12th. */
function polichPageCusps(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
): number[] {
    const E = eps * DEG;
    const sinE = Math.sin(E);
    const cosE = Math.cos(E);
    const tanPhi = Math.tan(lat * DEG);
    const poleCusp = (offsetDeg: number, poleTan: number): number => {
        const H = (ramc + offsetDeg) * DEG;
        return mod360(Math.atan2(Math.sin(H), Math.cos(H) * cosE - poleTan * sinE) * RAD);
    };
    const tanP11 = tanPhi / 3;
    const tanP12 = (2 * tanPhi) / 3;
    const tanP2 = (2 * tanPhi) / 3;
    const tanP3 = tanPhi / 3;
    const c11 = poleCusp(30, tanP11);
    const c12 = poleCusp(60, tanP12);
    const c2 = poleCusp(120, tanP2);
    const c3 = poleCusp(150, tanP3);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

function unitFromRaDec(raDeg: number, decDeg: number): [number, number, number] {
    const a = raDeg * DEG;
    const d = decDeg * DEG;
    const cd = Math.cos(d);
    return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
}

function raFromUnit(v: [number, number, number]): number {
    return mod360(Math.atan2(v[1], v[0]) * RAD);
}

function wrap180(deg: number): number {
    let d = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (d <= -180) d += 360;
    return d;
}

function dot3(a: [number, number, number], b: [number, number, number]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(
    a: [number, number, number],
    b: [number, number, number],
): [number, number, number] {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function localHorizonFrame(
    ramc: number,
    lat: number,
): {
    zenith: [number, number, number];
    east: [number, number, number];
    north: [number, number, number];
} {
    const th = ramc * DEG;
    const ph = lat * DEG;
    const zenith: [number, number, number] = [
        Math.cos(ph) * Math.cos(th),
        Math.cos(ph) * Math.sin(th),
        Math.sin(ph),
    ];
    const east: [number, number, number] = [-Math.sin(th), Math.cos(th), 0];
    const north = cross3(zenith, east);
    return { zenith, east, north };
}

function semiArcDeg(lat: number, decDeg: number): number {
    const arg = Math.max(-1, Math.min(1, -Math.tan(lat * DEG) * Math.tan(decDeg * DEG)));
    return Math.acos(arg) * RAD;
}

/** True when Makransky (`i`) diverges from Treindl inside |φ| ≤ 60° (long semi-arc wedge). */
export function sunshineMakranskyLongArcWedge(lat: number, declDeg: number): boolean {
    const dsa = semiArcDeg(lat, declDeg);
    const nsa = 180 - dsa;
    return Math.min(dsa, nsa) < 45;
}

function altitudeRaDec(raDeg: number, decDeg: number, ramc: number, lat: number): number {
    const H = wrap180(ramc - raDeg) * DEG;
    const phi = lat * DEG;
    const d = decDeg * DEG;
    return Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H)) * RAD;
}

function altitudeEcliptic(lon: number, ramc: number, lat: number, eps: number): number {
    const [ra, dec] = raDeclFromEcliptic(lon, 0, eps);
    return altitudeRaDec(ra, dec, ramc, lat);
}

function eclipticLongitudesFromPole(pole: [number, number, number], eps: number): [number, number] {
    const [px, py, pz] = pole;
    const ce = Math.cos(eps * DEG);
    const se = Math.sin(eps * DEG);
    const lam1 = mod360(Math.atan2(-px, py * ce + pz * se) * RAD);
    return [lam1, mod360(lam1 + 180)];
}

function pickSameAltitudeRoot(
    lam1: number,
    lam2: number,
    ramc: number,
    lat: number,
    eps: number,
    refAlt: number,
): number {
    const a1 = altitudeEcliptic(lam1, ramc, lat, eps);
    const a2 = altitudeEcliptic(lam2, ramc, lat, eps);
    const signMatch = (a: number) =>
        Math.abs(a) < 1e-11 ? Math.abs(refAlt) < 1e-11 : a >= 0 === refAlt >= 0;
    if (signMatch(a1) && !signMatch(a2)) return lam1;
    if (signMatch(a2) && !signMatch(a1)) return lam2;
    return Math.abs(a1 - refAlt) <= Math.abs(a2 - refAlt) ? lam1 : lam2;
}

function apcHourAngleDeg(house: number, dsaDeg: number, nsaDeg: number): number {
    switch (house) {
        case 10:
            return 0;
        case 11:
            return -dsaDeg / 3;
        case 12:
            return (-2 * dsaDeg) / 3;
        case 1:
            return -dsaDeg;
        case 9:
            return dsaDeg / 3;
        case 8:
            return (2 * dsaDeg) / 3;
        case 7:
            return dsaDeg;
        case 4:
            return 180;
        case 3:
            return wrap180(180 + nsaDeg / 3);
        case 2:
            return wrap180(180 + (2 * nsaDeg) / 3);
        case 5:
            return wrap180(180 - nsaDeg / 3);
        case 6:
            return wrap180(180 - (2 * nsaDeg) / 3);
        default:
            throw new Error(`APC house ${house}`);
    }
}

/**
 * APC / Sunshine Treindl: parallel at `declDeg` trisected by hour angle; position
 * circles through the horizon north point (Knegt; SE §6.2.14–6.2.15).
 */
function apcCuspsFromDeclination(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
    declDeg: number,
): number[] {
    const dsa = semiArcDeg(lat, declDeg);
    const nsa = 180 - dsa;
    const { north } = localHorizonFrame(ramc, lat);
    const cusps = new Array<number>(12);
    for (let h = 1; h <= 12; h++) {
        if (h === 1) {
            cusps[0] = asc;
            continue;
        }
        if (h === 7) {
            cusps[6] = mod360(asc + 180);
            continue;
        }
        if (h === 10) {
            cusps[9] = mc;
            continue;
        }
        if (h === 4) {
            cusps[3] = mod360(mc + 180);
            continue;
        }
        const H = apcHourAngleDeg(h, dsa, nsa);
        const raD = mod360(ramc - H);
        const dUnit = unitFromRaDec(raD, declDeg);
        const refAlt = altitudeRaDec(raD, declDeg, ramc, lat);
        const pole = cross3(dUnit, north);
        const [lam1, lam2] = eclipticLongitudesFromPole(pole, eps);
        cusps[h - 1] = pickSameAltitudeRoot(lam1, lam2, ramc, lat, eps, refAlt);
    }
    return cusps;
}

function apcCusps(ramc: number, lat: number, eps: number, asc: number, mc: number): number[] {
    const [, decAsc] = raDeclFromEcliptic(asc, 0, eps);
    return apcCuspsFromDeclination(ramc, lat, eps, asc, mc, decAsc);
}

/** Equator equinox branch for Makransky (`i`): (RAMC°, house) pairs from black-box parity. */
const MAKRANSKY_EQUATOR_EQUINOX: ReadonlyArray<readonly [number, number]> = [
    [30, 3],
    [60, 2],
    [120, 12],
    [150, 11],
    [210, 9],
    [240, 8],
    [300, 6],
    [330, 5],
];

function makranskyEquinoxCuspOverride(ramc: number, lat: number, house: number): boolean {
    if (Math.abs(lat) > 1e-9) return false;
    return MAKRANSKY_EQUATOR_EQUINOX.some(
        ([r, h]) => h === house && Math.abs(wrap180(ramc - r)) < 0.05,
    );
}

/**
 * Sunshine (SE §6.2.15): Treindl (`I`) and Makransky (`i`) share the APC geometry with
 * solar declination; `i` adds the equator equinox branch and matches Treindl in the
 * long-semi-arc wedge until that branch is closed (ADR 0017).
 */
function sunshineCusps(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
    sunLon: number,
    variant: 'makransky' | 'treindl',
): number[] {
    const [, sunDecl] = raDeclFromEcliptic(sunLon, 0, eps);
    const cusps = apcCuspsFromDeclination(ramc, lat, eps, asc, mc, sunDecl);
    if (variant !== 'makransky') return cusps;
    for (let h = 1; h <= 12; h++) {
        if (makranskyEquinoxCuspOverride(ramc, lat, h)) cusps[h - 1] = 0;
    }
    return cusps;
}

function gauquelinSigma(ramc: number, lat: number, eps: number, lon: number): number {
    const [ra, dec] = raDeclFromEcliptic(lon, 0, eps);
    const H = wrap180(ramc - ra);
    const dsa = semiArcDeg(lat, dec);
    if (Math.abs(H) <= dsa) return (H + dsa) / (4 * dsa);
    let h2 = H;
    if (h2 <= 0) h2 += 360;
    const nsa = 180 - dsa;
    return 0.5 + (h2 - dsa) / (4 * nsa);
}

function gauquelinSectorLongitude(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
    sector: number,
): number {
    const ic = mod360(asc + 180);
    const desc = mod360(mc + 180);
    if (sector === 0) return asc;
    if (sector === 9) return mc;
    if (sector === 18) return ic;
    if (sector === 27) return desc;
    if (sector >= 18)
        return mod360(gauquelinSectorLongitude(ramc, lat, eps, asc, mc, sector - 18) + 180);

    const target = sector / 36;
    let lo = 0;
    let hi = 360;
    for (let i = 0; i < 64; i++) {
        const mid = 0.5 * (lo + hi);
        const lon = mod360(asc + mid);
        const sig = gauquelinSigma(ramc, lat, eps, lon);
        if (sig > target) lo = mid;
        else hi = mid;
    }
    return mod360(asc + 0.5 * (lo + hi));
}

/** Gauquelin 36 sectors (Gauquelin; SE §6.2.12): Placidus-style σ on each point’s own arc. */
function gauquelinSectors36(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
    scheme: PlacidusScheme,
): number[] {
    void scheme;
    return Array.from({ length: 36 }, (_, s) =>
        gauquelinSectorLongitude(ramc, lat, eps, asc, mc, s),
    );
}

function mcAzimuthDeg(ramc: number, lat: number, eps: number): number {
    const lamMc = computeMC(ramc, eps);
    const [, decMc] = raDeclFromEcliptic(lamMc, 0, eps);
    if (decMc > lat) return 0;
    if (decMc < lat) return 180;
    return lat <= 0 ? 0 : 180;
}

function horizontalCuspAtAzimuth(ramc: number, lat: number, eps: number, azDeg: number): number {
    const solveAtLat = (phiDeg: number): number => {
        const { zenith, east, north } = localHorizonFrame(ramc, phiDeg);
        const az = azDeg * DEG;
        const hVec: [number, number, number] = [
            Math.sin(az) * east[0] + Math.cos(az) * north[0],
            Math.sin(az) * east[1] + Math.cos(az) * north[1],
            Math.sin(az) * east[2] + Math.cos(az) * north[2],
        ];
        const pole = cross3(zenith, hVec);
        const [lam1, lam2] = eclipticLongitudesFromPole(pole, eps);
        const [ra1, dec1] = raDeclFromEcliptic(lam1, 0, eps);
        const [ra2, dec2] = raDeclFromEcliptic(lam2, 0, eps);
        const s1 = dot3(unitFromRaDec(ra1, dec1), hVec);
        const s2 = dot3(unitFromRaDec(ra2, dec2), hVec);
        if (Math.abs(s1) < 1e-14 && Math.abs(s2) < 1e-14) {
            const nudge = phiDeg <= 0 ? phiDeg + 1e-7 : phiDeg - 1e-7;
            return solveAtLat(nudge);
        }
        return s1 >= s2 ? lam1 : lam2;
    };
    return solveAtLat(lat);
}

/** Horizontal / azimuthal (SE §6.2.9): twelve equal azimuths anchored at the MC meridian. */
function horizontalCusps(ramc: number, lat: number, eps: number): number[] {
    const azMc = mcAzimuthDeg(ramc, lat, eps);
    const stepSign = lat > 0 ? -1 : 1;
    const az1 = mod360(azMc - stepSign * 270);
    return Array.from({ length: 12 }, (_, i) =>
        horizontalCuspAtAzimuth(ramc, lat, eps, mod360(az1 + stepSign * i * 30)),
    );
}

/** Krusinski–Pisa–Goelzer (SE §6.2.13): asc–zenith circle in 30° steps, meridian projection. */
function krusinskiCusps(ramc: number, lat: number, eps: number, asc: number, mc: number): number[] {
    void mc;
    const [raAsc, decAsc] = raDeclFromEcliptic(asc, 0, eps);
    const vAsc = unitFromRaDec(raAsc, decAsc);
    const vZen = unitFromRaDec(ramc, lat);
    return Array.from({ length: 12 }, (_, i) => {
        const house = i + 1;
        const theta = ((((1 - house) % 12) + 12) % 12) * 30 * DEG;
        const px = vAsc[0] * Math.cos(theta) + vZen[0] * Math.sin(theta);
        const py = vAsc[1] * Math.cos(theta) + vZen[1] * Math.sin(theta);
        const pz = vAsc[2] * Math.cos(theta) + vZen[2] * Math.sin(theta);
        return eclipticLongitudeFromRa(raFromUnit([px, py, pz]), eps);
    });
}

// ---------------------------------------------------------------------------
// Extra angles (SE §6.3)
// ---------------------------------------------------------------------------

export function equatorialAscendant(ramc: number, eps: number): number {
    return eclipticLongitudeFromRa(mod360(ramc + 90), eps);
}

export function coAscendantKoch(ramc: number, lat: number, eps: number): number {
    const ascAtIc = computeAscendant(mod360(ramc + 180), lat, eps);
    return mod360(ascAtIc + 180);
}

export function coAscendantMunkasey(ramc: number, lat: number, eps: number): number {
    return computeAscendant(ramc, 90 - lat, eps);
}

export function polarAscendant(ramc: number, lat: number, eps: number): number {
    return mod360(coAscendantKoch(ramc, lat, eps) + 180);
}

// ---------------------------------------------------------------------------
// JHora-style post-processors
// ---------------------------------------------------------------------------

/** Equal-type houses with the cusp longitude in the middle of each 30° house. */
export function applyCuspsInMiddle(cusps: number[], asc: number): number[] {
    void asc;
    return cusps.map((c) => mod360(c - 15));
}

/**
 * Nine-pada (40°) equal division: twelve cusp longitudes stepping 40° from the
 * sign boundary of the ascendant (JHora ADR: pada width 360/9; twelve displayed
 * cusps cycle the nine padas).
 */
export function ninePadaEqualCusps(asc: number): number[] {
    const start = Math.floor(mod360(asc) / 30) * 30;
    return Array.from({ length: 12 }, (_, i) => mod360(start + i * 40));
}

/**
 * Surya Siddhanta–style houses: uses the SS mean obliquity at `jdUt` for the
 * ascendant, then equal 30° houses from that ascendant.
 *
 * Limitation: full SS ascendant tables (location, time, precession of rising)
 * are not reproduced here; only the canonical SS obliquity linear term is applied.
 */
export function sssHouseCusps(
    ramc: number,
    lat: number,
    jdUt: number,
    _epsTrue: number,
): { cusps: number[]; ascendant: number; note: string } {
    const t = (jdUt - 2451545) / 36525;
    const epsSs = 24 - (846 * t) / 3600 - (1.59 * t * t) / 3600;
    const asc = computeAscendant(ramc, lat, epsSs);
    return {
        cusps: equalHouseCusps(asc),
        ascendant: asc,
        note:
            'SSS houses use SS obliquity for the ascendant only; cusps are equal 30° from that asc. ' +
            'Full Surya Siddhanta rising-time corrections are not implemented.',
    };
}

export function cuspsFromAnchor(anchorLon: number, letter: HouseLetter): number[] {
    const L = mod360(anchorLon);
    switch (letter) {
        case 'A':
        case 'E':
            return equalHouseCusps(L);
        case 'D':
            return equalHouseCusps(mod360(L + 90));
        case 'N':
            return equalHouseCusps(0);
        case 'V':
            return equalHouseCusps(mod360(L - 15));
        case 'W':
            return wholeSignCusps(L);
        case 'X':
            return Array.from({ length: 12 }, (_, i) =>
                eclipticLongitudeFromRa(mod360(L + 90 + i * 30), 23.4397),
            );
        default:
            return equalHouseCusps(L);
    }
}

// ---------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------

function withExtraAngles(
    base: Omit<HouseComputeResult, 'equAsc' | 'coAscKoch' | 'coAscMunkasey' | 'polAsc'>,
    ramc: number,
    lat: number,
    eps: number,
): HouseComputeResult {
    return {
        ...base,
        equAsc: equatorialAscendant(ramc, eps),
        coAscKoch: coAscendantKoch(ramc, lat, eps),
        coAscMunkasey: coAscendantMunkasey(ramc, lat, eps),
        polAsc: polarAscendant(ramc, lat, eps),
    };
}

function porphyryFallback(
    letter: HouseLetter,
    ramc: number,
    lat: number,
    eps: number,
    tropAsc: number,
    tropMC: number,
    tropVertex: number,
    message: string,
): HouseComputeResult {
    return withExtraAngles(
        {
            cusps: porphyryFromAngles(tropAsc, tropMC),
            ascendant: tropAsc,
            mc: tropMC,
            armc: ramc,
            vertex: tropVertex,
            fallback: { code: 'POLAR_PORPHYRY', message, usedLetter: 'O' },
        },
        ramc,
        lat,
        eps,
    );
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export function computeTropicalHouses(
    letter: HouseLetter,
    ramc: number,
    lat: number,
    eps: number,
    tropAsc: number,
    tropMC: number,
    tropVertex: number,
    options: HouseComputeOptions,
): HouseComputeResult {
    const scheme = options.placidusScheme;
    const effective = letter === 'A' ? 'E' : letter;

    const polarPk = (sys: 'P' | 'K'): HouseComputeResult => {
        if (!polarCircleExceeded(lat, eps)) {
            if (sys === 'P') {
                return withExtraAngles(
                    {
                        cusps: placidusCusps(ramc, lat, eps, tropAsc, tropMC, scheme),
                        ascendant: tropAsc,
                        mc: tropMC,
                        armc: ramc,
                        vertex: tropVertex,
                    },
                    ramc,
                    lat,
                    eps,
                );
            }
            return withExtraAngles(
                {
                    cusps: kochCusps(ramc, lat, eps, tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        }
        if (options.polarFallback === 'error') {
            return withExtraAngles(
                {
                    cusps: porphyryFromAngles(tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                    fallback: {
                        code: 'POLAR_UNDEFINED',
                        message: `${sys} undefined at |tan φ tan ε| ≥ 1`,
                        usedLetter: sys,
                    },
                },
                ramc,
                lat,
                eps,
            );
        }
        return porphyryFallback(
            sys,
            ramc,
            lat,
            eps,
            tropAsc,
            tropMC,
            tropVertex,
            `${sys} beyond polar circle; Porphyry fallback (SE §6.4)`,
        );
    };

    switch (effective) {
        case 'E':
            return withExtraAngles(
                {
                    cusps: equalHouseCusps(tropAsc),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'D':
            return withExtraAngles(
                {
                    cusps: equalHouseCusps(mod360(tropMC + 90)),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'N':
            return withExtraAngles(
                {
                    cusps: equalHouseCusps(0),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'V':
            return withExtraAngles(
                {
                    cusps: equalHouseCusps(mod360(tropAsc - 15)),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'W':
            return withExtraAngles(
                {
                    cusps: wholeSignCusps(tropAsc),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'O':
            return withExtraAngles(
                {
                    cusps: porphyryFromAngles(tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'P':
            return polarPk('P');
        case 'K':
            return polarPk('K');
        case 'B':
            return withExtraAngles(
                {
                    cusps: alcabitiusCusps(ramc, lat, eps, tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'C':
        case 'R': {
            const { mc: mcUse, swapped } = polarOrientedMcIc(ramc, lat, eps, tropMC);
            const cusps =
                effective === 'C'
                    ? campanusCusps(ramc, lat, eps, tropAsc, mcUse)
                    : regiomontanusCusps(ramc, lat, eps, tropAsc, mcUse);
            return withExtraAngles(
                {
                    cusps,
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                    ...(swapped
                        ? {
                              fallback: {
                                  code: 'MC_IC_SWAP',
                                  message: 'MC below horizon; MC/IC swapped (SE §6.4)',
                                  usedLetter: effective,
                              },
                          }
                        : {}),
                },
                ramc,
                lat,
                eps,
            );
        }
        case 'F':
            return withExtraAngles(
                {
                    cusps: carterPoliEquatorialCusps(tropAsc, eps),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'M':
            return withExtraAngles(
                {
                    cusps: morinusCusps(ramc, eps),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'X':
            return withExtraAngles(
                {
                    cusps: meridianAxialCusps(ramc, eps),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'L':
            return withExtraAngles(
                {
                    cusps: pullenSdCusps(tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'Q':
            return withExtraAngles(
                {
                    cusps: pullenSrCusps(tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'S':
            return withExtraAngles(
                {
                    cusps: sripatiCusps(tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'T': {
            const { mc: mcUse, swapped } = polarOrientedMcIc(ramc, lat, eps, tropMC);
            const cusps = polichPageCusps(ramc, lat, eps, tropAsc, mcUse);
            return withExtraAngles(
                {
                    cusps,
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                    ...(swapped
                        ? {
                              fallback: {
                                  code: 'MC_IC_SWAP',
                                  message: 'MC below horizon; MC/IC swapped (SE §6.4)',
                                  usedLetter: 'T',
                              },
                          }
                        : {}),
                },
                ramc,
                lat,
                eps,
            );
        }
        case 'U':
            return withExtraAngles(
                {
                    cusps: krusinskiCusps(ramc, lat, eps, tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'H':
            return withExtraAngles(
                {
                    cusps: horizontalCusps(ramc, lat, eps),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'Y':
            return withExtraAngles(
                {
                    cusps: apcCusps(ramc, lat, eps, tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        case 'G': {
            const cusps = placidusCusps(ramc, lat, eps, tropAsc, tropMC, scheme);
            const sectors = gauquelinSectors36(ramc, lat, eps, tropAsc, tropMC, scheme);
            return withExtraAngles(
                {
                    cusps,
                    gauquelinSectors: sectors,
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
        }
        case 'I':
        case 'i': {
            const sunLon = options.sunEclipticLongitude;
            if (sunLon === undefined) {
                return withExtraAngles(
                    {
                        cusps: porphyryFromAngles(tropAsc, tropMC),
                        ascendant: tropAsc,
                        mc: tropMC,
                        armc: ramc,
                        vertex: tropVertex,
                        fallback: {
                            code: 'SUN_REQUIRED',
                            message: 'Sunshine (I/i) requires options.sunEclipticLongitude',
                            usedLetter: effective,
                        },
                    },
                    ramc,
                    lat,
                    eps,
                );
            }
            const { mc: mcUse, swapped } = polarOrientedMcIc(ramc, lat, eps, tropMC);
            // SE swephprg.htm: `I` = Treindl solution, `i` = Makransky solution (same geometry, polar handling differs).
            const variant = effective === 'I' ? 'treindl' : 'makransky';
            const cusps = sunshineCusps(ramc, lat, eps, tropAsc, mcUse, sunLon, variant);
            return withExtraAngles(
                {
                    cusps,
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                    ...(swapped
                        ? {
                              fallback: {
                                  code: 'MC_IC_SWAP',
                                  message: 'Sunshine: MC below horizon; MC/IC swapped (SE §6.4)',
                                  usedLetter: effective,
                              },
                          }
                        : {}),
                },
                ramc,
                lat,
                eps,
            );
        }
        default:
            return withExtraAngles(
                {
                    cusps: wholeSignCusps(tropAsc),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
    }
}
