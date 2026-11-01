// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * ERFA gst06a — Greenwich apparent sidereal time (IAU 2006 / IAU 2000A).
 *
 * Transcribed from ERFA `era00`, `pfw06`, `obl06`, `nut06a`, `fw2m`, `pnm06a`,
 * `s06`, `eors`, `gst06`, `gst06a` (BSD-3-Clause, NumFOCUS / SOFA).
 *
 * @see IERS Conventions (2010) §5; Wallace & Capitaine (2006), A&A 459, 981
 */
import s06Data from '../generated/gst-s06-series.json' with { type: 'json' };
import { nutationIau2000a } from './nutation-iau2000a.js';

const DJ00 = 2451545.0;
const DJC = 36525.0;
const DAS2R = Math.PI / (180 * 3600);
const TURNAS = 1296000;
const D2PI = 2 * Math.PI;
const RAD2DEG = 180 / Math.PI;

type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];

function anp(a: number): number {
    let w = a % D2PI;
    if (w < 0) w += D2PI;
    return w;
}

/** Earth rotation angle (radians); ERFA era00. */
function era00(uta: number, utb: number): number {
    let d1 = uta;
    let d2 = utb;
    if (d1 > d2) {
        d1 = utb;
        d2 = uta;
    }
    const t = d1 + (d2 - DJ00);
    const f = (d1 % 1) + (d2 % 1);
    return anp(D2PI * (f + 0.779_057_273_264 + 0.002_737_811_911_354_48 * t));
}

function fmodTurnas(a: number): number {
    let x = a % TURNAS;
    if (x < 0) x += TURNAS;
    return x * DAS2R;
}

function fal03(t: number): number {
    return fmodTurnas(
        485_868.249_036 +
            t * (1_717_915_923.2178 + t * (31.8792 + t * (0.051_635 + t * -0.000_244_7))),
    );
}
function falp03(t: number): number {
    return fmodTurnas(
        1_287_104.793_048 +
            t * (129_596_581.0481 + t * (-0.5532 + t * (0.000_136 + t * -0.000_011_49))),
    );
}
function faf03(t: number): number {
    return fmodTurnas(
        335_779.526_232 +
            t * (1_739_527_262.8478 + t * (-12.7512 + t * (-0.001_037 + t * 0.000_004_17))),
    );
}
function fad03(t: number): number {
    return fmodTurnas(
        1_072_260.703_692 +
            t * (1_602_961_601.209 + t * (-6.3706 + t * (0.006_593 + t * -0.000_031_69))),
    );
}
function faom03(t: number): number {
    return fmodTurnas(
        450_160.398_036 +
            t * (-6_962_890.5431 + t * (7.4722 + t * (0.007_702 + t * -0.000_059_39))),
    );
}
function fave03(t: number): number {
    return anp(3.176_146_697 + 1021.328_554_6211 * t);
}
function fae03(t: number): number {
    return anp(1.753_470_314 + 628.307_584_9991 * t);
}
function fapa03(t: number): number {
    return (0.024_381_75 + 0.000_005_386_91 * t) * t;
}

function obl06Rad(date1: number, date2: number): number {
    const t = (date1 - DJ00 + date2) / DJC;
    return (
        (84_381.406 +
            (-46.836_769 +
                (-0.000_1831 + (0.002_003_4 + (-0.000_000_576 + -0.000_000_043_4 * t) * t) * t) *
                    t) *
                t) *
        DAS2R
    );
}

function pfw06(
    date1: number,
    date2: number,
): { gamb: number; phib: number; psib: number; epsa: number } {
    const t = (date1 - DJ00 + date2) / DJC;
    const gamb =
        (-0.052_928 +
            (10.556_378 +
                (0.493_2044 + (-0.000_312_38 + (-0.000_002_788 + 0.000_000_026 * t) * t) * t) * t) *
                t) *
        DAS2R;
    const phib =
        (84_381.412_819 +
            (-46.811_016 +
                (0.051_1268 + (0.000_532_89 + (-0.000_000_44 + -0.000_000_017_6 * t) * t) * t) *
                    t) *
                t) *
        DAS2R;
    const psib =
        (-0.041_775 +
            (5038.481_484 +
                (1.558_4175 + (-0.000_185_22 + (-0.000_026_452 + -0.000_000_014_8 * t) * t) * t) *
                    t) *
                t) *
        DAS2R;
    return { gamb, phib, psib, epsa: obl06Rad(date1, date2) };
}

function identity(): Mat3 {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
}

function matRz(r: Mat3, angle: number): Mat3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out: Mat3 = [
        [0, 0, 0],
        [0, 0, 0],
        [r[2][0], r[2][1], r[2][2]],
    ];
    for (let j = 0; j < 3; j++) {
        out[0][j] = c * r[0][j] + s * r[1][j];
        out[1][j] = -s * r[0][j] + c * r[1][j];
    }
    return out;
}

function matRx(r: Mat3, angle: number): Mat3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out: Mat3 = [
        [r[0][0], r[0][1], r[0][2]],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let j = 0; j < 3; j++) {
        out[1][j] = c * r[1][j] + s * r[2][j];
        out[2][j] = -s * r[1][j] + c * r[2][j];
    }
    return out;
}

function fw2m(gamb: number, phib: number, psi: number, eps: number): Mat3 {
    let r = identity();
    r = matRz(r, gamb);
    r = matRx(r, phib);
    r = matRz(r, -psi);
    r = matRx(r, -eps);
    return r;
}

function pnm06a(date1: number, date2: number): Mat3 {
    const { gamb, phib, psib, epsa } = pfw06(date1, date2);
    const T = (date1 - DJ00 + date2) / DJC;
    const { dpsi, deps } = nutationIau2000a(T);
    const dpsiRad = dpsi * (Math.PI / 180);
    const depsRad = deps * (Math.PI / 180);
    return fw2m(gamb, phib, psib + dpsiRad, epsa + depsRad);
}

type S06Term = { nfa: number[]; s: number; c: number };

function evalS06Series(terms: S06Term[], fa: number[], t: number, w: number): number {
    let sum = w;
    for (let i = terms.length - 1; i >= 0; i--) {
        const term = terms[i]!;
        let a = 0;
        for (let j = 0; j < 8; j++) a += term.nfa[j]! * fa[j]!;
        sum += term.s * Math.sin(a) + term.c * Math.cos(a);
    }
    return sum;
}

function s06(date1: number, date2: number, x: number, y: number): number {
    const t = (date1 - DJ00 + date2) / DJC;
    const fa = [fal03(t), falp03(t), faf03(t), fad03(t), faom03(t), fave03(t), fae03(t), fapa03(t)];
    const sp = s06Data.sp as number[];
    const series = s06Data.series as Record<string, S06Term[]>;
    let w0 = sp[0]!;
    let w1 = sp[1]!;
    let w2 = sp[2]!;
    let w3 = sp[3]!;
    let w4 = sp[4]!;
    const w5 = sp[5]!;
    w0 = evalS06Series(series.s0!, fa, t, w0);
    w1 = evalS06Series(series.s1!, fa, t, w1);
    w2 = evalS06Series(series.s2!, fa, t, w2);
    w3 = evalS06Series(series.s3!, fa, t, w3);
    w4 = evalS06Series(series.s4!, fa, t, w4);
    const s = (w0 + (w1 + (w2 + (w3 + (w4 + w5 * t) * t) * t) * t) * t) * DAS2R - (x * y) / 2;
    return s;
}

function eors(rnpb: Mat3, s: number): number {
    const x = rnpb[2][0];
    const ax = x / (1 + rnpb[2][2]);
    const xs = 1 - ax * x;
    const ys = -ax * rnpb[2][1];
    const zs = -x;
    const p = rnpb[0][0] * xs + rnpb[0][1] * ys + rnpb[0][2] * zs;
    const q = rnpb[1][0] * xs + rnpb[1][1] * ys + rnpb[1][2] * zs;
    return p !== 0 || q !== 0 ? s - Math.atan2(q, p) : s;
}

function gst06(uta: number, utb: number, tta: number, ttb: number, rnpb: Mat3): number {
    const x = rnpb[2][0];
    const y = rnpb[2][1];
    const s = s06(tta, ttb, x, y);
    const era = era00(uta, utb);
    const eo = eors(rnpb, s);
    return anp(era - eo);
}

/** @internal Cross-check vs pyerfa in unit tests only. */
export function s06Radians(date1: number, date2: number, x: number, y: number): number {
    return s06(date1, date2, x, y);
}

/** Greenwich apparent sidereal time in degrees (truth profile). */
export function gast06aDegrees(jdUt1: number, jdTT: number): number {
    const uta = DJ00;
    const utb = jdUt1 - DJ00;
    const tta = DJ00;
    const ttb = jdTT - DJ00;
    const rnpb = pnm06a(tta, ttb);
    return anp(gst06(uta, utb, tta, ttb, rnpb)) * RAD2DEG;
}
