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

function regiomontanusCusps(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
): number[] {
    const phi = lat * DEG;
    const cusp = (kAngle: number): number => {
        const rho = ramc * DEG + kAngle;
        const y = Math.cos(phi) * Math.sin(rho);
        const x =
            Math.cos(phi) * Math.cos(rho) * Math.cos(eps * DEG) -
            Math.sin(phi) * Math.sin(kAngle) * Math.sin(eps * DEG);
        const lam = branchLongitude(y, x);
        if (lam === undefined) throw new Error('Regiomontanus degenerate');
        return lam;
    };
    const c11 = cusp(Math.PI / 6);
    const c12 = cusp(Math.PI / 3);
    const c2 = cusp((2 * Math.PI) / 3);
    const c3 = cusp((5 * Math.PI) / 6);
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

function morinusCusps(ramc: number, eps: number): number[] {
    return Array.from({ length: 12 }, (_, i) =>
        eclipticLongitudeFromRa(mod360(ramc + i * 30), eps),
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
    const c5 = mod360(mod360(c11 + 180) + w3a);
    const c6 = mod360(c5 + w3b);
    const c8 = mod360(mod360(c2 + 180) + w4a);
    const c9 = mod360(c8 + w4b);
    return [asc, c2, c3, ic, c5, c6, mod360(asc + 180), c8, c9, mc, c11, c12];
}

function solvePullenRatio(q: number): number {
    if (Math.abs(q - 90) < 1e-9) return 1;
    let r = 1;
    for (let i = 0; i < 40; i++) {
        const x = q / (1 + 2 * r);
        const rhs = ((180 - q) / q) * (1 + 2 * r) * (1 + 2 * r);
        const lhs = 2 * r * r * r + r * r * r * r;
        const f = lhs - rhs;
        const df = 6 * r * r + 4 * r * r * r;
        if (Math.abs(df) < 1e-15) break;
        r -= f / df;
        if (r < 0.01) r = 0.01;
    }
    return r;
}

function pullenSrQuadrant(q: number): [number, number, number] {
    const r = solvePullenRatio(q);
    const x = q / (1 + 2 * r);
    return [r * x, x, r * x];
}

function pullenSrCusps(asc: number, mc: number): number[] {
    const ic = mod360(mc + 180);
    const qMcAsc = forwardArc(mc, asc);
    const qAscIc = forwardArc(asc, ic);
    const qIcDesc = forwardArc(ic, mod360(asc + 180));
    const qDescMc = forwardArc(mod360(asc + 180), mc);
    const [a1, b1] = pullenSrQuadrant(qMcAsc);
    const [a2, b2] = pullenSrQuadrant(qAscIc);
    const [a3, b3] = pullenSrQuadrant(qIcDesc);
    const [a4, b4] = pullenSrQuadrant(qDescMc);
    const c11 = mod360(mc + a1);
    const c12 = mod360(c11 + b1);
    const c2 = mod360(asc + a2);
    const c3 = mod360(c2 + b2);
    const c5 = mod360(mod360(c11 + 180) + a3);
    const c6 = mod360(c5 + b3);
    const c8 = mod360(mod360(c2 + 180) + a4);
    const c9 = mod360(c8 + b4);
    void b4;
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
    const tanP12 = (2 * tanPhi) / 9;
    const tanP2 = (4 * tanPhi) / 9;
    const tanP3 = (5 * tanPhi) / 9;
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

/** Krusinski (SE §6.2.13): asc–zenith great circle in 12 parts; project by meridian. */
function krusinskiCusps(ramc: number, lat: number, eps: number, asc: number, mc: number): number[] {
    const [raAsc, decAsc] = raDeclFromEcliptic(asc, 0, eps);
    const vAsc = unitFromRaDec(raAsc, decAsc);
    const vZen = unitFromRaDec(ramc, lat);
    const dot = Math.max(
        -1,
        Math.min(1, vAsc[0] * vZen[0] + vAsc[1] * vZen[1] + vAsc[2] * vZen[2]),
    );
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega) || 1;
    const cuspFromFraction = (f: number): number => {
        const w0 = Math.sin((1 - f) * omega) / sinOmega;
        const w1 = Math.sin(f * omega) / sinOmega;
        const px = vAsc[0] * w0 + vZen[0] * w1;
        const py = vAsc[1] * w0 + vZen[1] * w1;
        const pz = vAsc[2] * w0 + vZen[2] * w1;
        return eclipticLongitudeFromRa(raFromUnit([px, py, pz]), eps);
    };
    const c11 = cuspFromFraction(1 / 12);
    const c12 = cuspFromFraction(2 / 12);
    const c2 = cuspFromFraction(4 / 12);
    const c3 = cuspFromFraction(5 / 12);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

/** Horizontal / azimuthal (SE §6.2.9): 12 azimuth steps from east; cusp 1 at east, not ASC. */
function horizontalCusps(ramc: number, lat: number, eps: number): number[] {
    const phi = lat * DEG;
    const solveAzimuth = (azDeg: number): number => {
        const az = azDeg * DEG;
        let lon = mod360(ramc + 90);
        for (let iter = 0; iter < 32; iter++) {
            const [ra, dec] = raDeclFromEcliptic(lon, 0, eps);
            let H = (ramc - ra) * DEG;
            if (H > Math.PI) H -= 2 * Math.PI;
            if (H < -Math.PI) H += 2 * Math.PI;
            const d = dec * DEG;
            const f =
                Math.sin(az) * Math.cos(d) * Math.sin(H) +
                Math.cos(az) *
                    (Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.sin(phi) * Math.cos(H));
            const dDec = Math.cos(eps * DEG) * Math.cos(lon * DEG);
            const dRa =
                (-Math.cos(lon * DEG) * Math.cos(eps * DEG)) / (Math.cos(d) * Math.cos(d) + 1e-15);
            const dH = -dRa;
            const df =
                Math.sin(az) * Math.cos(d) * Math.cos(H) * dH +
                Math.sin(az) * (-Math.sin(d) * dDec) * Math.sin(H) +
                Math.cos(az) *
                    (Math.cos(d) * dDec * Math.cos(phi) +
                        Math.sin(d) * Math.sin(phi) * Math.sin(H) * dH);
            if (Math.abs(df) < 1e-15) break;
            lon = mod360(lon - (f / df) * RAD);
        }
        return lon;
    };
    return Array.from({ length: 12 }, (_, i) => solveAzimuth(90 + i * 30));
}

/**
 * APC (SE §6.2.14): parallel through the ascendant’s declination divided into six
 * parts above and below the horizon; position circles through horizon N/S.
 *
 * Approximation: meridian spacing of RA on the ascendant parallel at fractions
 * k/12 of its visible arc (clean-room; not bit-identical to SE near high lat).
 */
function apcCusps(ramc: number, lat: number, eps: number, asc: number, mc: number): number[] {
    const [, decAsc] = raDeclFromEcliptic(asc, 0, eps);
    const phi = lat * DEG;
    const d = decAsc * DEG;
    const cosH0 = -Math.tan(phi) * Math.tan(d);
    const visible =
        Math.abs(cosH0) <= 1 ? Math.acos(Math.max(-1, Math.min(1, cosH0))) : Math.PI / 2;
    const cusp = (k: number): number => {
        const H = -visible + (2 * visible * k) / 12;
        const ra = mod360(ramc - H * RAD);
        return eclipticLongitudeFromRa(ra, eps);
    };
    const c11 = cusp(1);
    const c12 = cusp(2);
    const c2 = cusp(4);
    const c3 = cusp(5);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

function sunSemiArcDegrees(
    lat: number,
    sunLon: number,
    eps: number,
): { diurnal: number; nocturnal: number } {
    const [, dec] = raDeclFromEcliptic(sunLon, 0, eps);
    const tp = Math.tan(lat * DEG) * Math.tan(dec * DEG);
    if (Math.abs(tp) >= 1 - 1e-12) {
        return tp > 0 ? { diurnal: 180, nocturnal: 0 } : { diurnal: 0, nocturnal: 180 };
    }
    const da = Math.acos(-tp) * RAD;
    return { diurnal: da, nocturnal: 180 - da };
}

/**
 * Sunshine (SE §6.2.15): trisect the Sun’s diurnal/nocturnal arcs; house circles
 * through horizon N/S. Uses RAMC shifts by thirds of the Sun’s semi-arc (same
 * angular measure as Koch, but keyed to solar declination).
 *
 * `I` — Makransky (Primary Directions, 1988) as documented in SE.
 * `i` — Treindl variant: identical formulas with stricter polar-circle handling
 * (always collapse cusps 2–6 or 8–12 onto the meridian when a solar arc is 0°
 * or 180°, per SE §6.2.15 / §6.4 MC swap notes).
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
    const { diurnal, nocturnal } = sunSemiArcDegrees(lat, sunLon, eps);
    const thirdDay = diurnal / 3;
    const thirdNight = nocturnal / 3;
    const shiftAsc = (deg: number) => computeAscendant(ramc + deg, lat, eps);

    if (variant === 'treindl' && diurnal === 0) {
        const mer = mod360(mc);
        return [
            asc,
            mer,
            mer,
            mer,
            mer,
            mer,
            mod360(asc + 180),
            mod360(mer + 180),
            mod360(mer + 180),
            mc,
            mod360(mer + 180),
            mod360(mer + 180),
        ];
    }
    if (variant === 'treindl' && nocturnal === 0) {
        const mer = mod360(mc);
        return [
            asc,
            mod360(mer + 180),
            mod360(mer + 180),
            mod360(mer + 180),
            mod360(mer + 180),
            mod360(mer + 180),
            mod360(asc + 180),
            mer,
            mer,
            mc,
            mer,
            mer,
        ];
    }

    const c11 = shiftAsc(-2 * thirdDay);
    const c12 = shiftAsc(-thirdDay);
    const c2 = shiftAsc(thirdNight);
    const c3 = shiftAsc(2 * thirdNight);
    return assembleQuadrant(asc, mc, c11, c12, c2, c3);
}

function gauquelinSectors36(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
    scheme: PlacidusScheme,
): number[] {
    const plac = placidusCusps(ramc, lat, eps, asc, mc, scheme);
    const sectors: number[] = new Array(36);
    for (let s = 0; s < 36; s++) {
        const house = Math.floor(s / 3);
        const sub = s % 3;
        const a = plac[house];
        const b = plac[(house + 1) % 12];
        sectors[s] = mod360(a + (forwardArc(a, b) * (sub + 1)) / 4);
    }
    return sectors;
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
        case 'T':
            return withExtraAngles(
                {
                    cusps: polichPageCusps(ramc, lat, eps, tropAsc, tropMC),
                    ascendant: tropAsc,
                    mc: tropMC,
                    armc: ramc,
                    vertex: tropVertex,
                },
                ramc,
                lat,
                eps,
            );
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
            const variant = effective === 'I' ? 'makransky' : 'treindl';
            const cusps = sunshineCusps(ramc, lat, eps, tropAsc, tropMC, sunLon, variant);
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
