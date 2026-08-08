/**
 * Divisional Charts (Vargas) — Complete Parashara Ruleset
 *
 * Implements all 16 standard Vargas per BPHS (Brihat Parashara Hora Shastra).
 * All internal arithmetic uses Decimal.js to eliminate floating-point drift.
 *
 * PUBLIC API: takes `number` longitude, returns `VargaPoint` with `number` fields.
 * INTERNAL:   uses `Decimal` for all division/modulo operations.
 */

import { Decimal } from 'decimal.js';
import { normalize360D, D, toNum } from '../core/precise.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VargaPoint {
    longitude: number; // 0-360 in the varga chart
    sign:      number; // 1-12 (Aries … Pisces)
    degree:    number; // 0-30 within the sign
    deity?:    string; // Shashtyamsa deity (D60 only)
}

// ---------------------------------------------------------------------------
// Internal Decimal-based computation
// ---------------------------------------------------------------------------

const D30  = new Decimal(30);
const D12  = new Decimal(12);
const D360 = new Decimal(360);

/** Snap a Decimal longitude to { sign: 1-12, degree: 0-30 }. */
function snap(lon: Decimal): { sign: number; degree: number } {
    const norm  = normalize360D(lon);
    const sign  = norm.div(D30).floor().toNumber() + 1; // 1-12
    const degree = toNum(norm.mod(D30));
    return { sign: sign > 12 ? 1 : sign, degree };
}

// ---------------------------------------------------------------------------
// Sign category helpers (0-indexed sign index 0..11)
// ---------------------------------------------------------------------------

/** Returns sign category for Navamsa/Drekkana/Shodasamsa etc. */
function signType(idx: number): 'movable' | 'fixed' | 'dual' {
    const mod = idx % 3;
    if (mod === 0) return 'movable'; // Aries(0), Cancer(3), Libra(6), Capricorn(9)
    if (mod === 1) return 'fixed';   // Taurus(1), Leo(4), Scorpio(7), Aquarius(10)
    return 'dual';                   // Gemini(2), Virgo(5), Sagittarius(8), Pisces(11)
}

/**
 * Generic harmonic Varga: longitude * division (mod 360).
 * Parashara-compliant for D9 (and a reasonable approximation for others
 * as a fallback only — each varga has its own specific function below).
 */
function harmonic(lon: Decimal, division: number): VargaPoint {
    const vLon = normalize360D(lon.times(division));
    const { sign, degree } = snap(vLon);
    return { longitude: toNum(vLon), sign, degree };
}

// ---------------------------------------------------------------------------
// D1 — Rashi (Identity)
// ---------------------------------------------------------------------------
function d1(lon: Decimal): VargaPoint {
    const { sign, degree } = snap(lon);
    return { longitude: toNum(normalize360D(lon)), sign, degree };
}

// ---------------------------------------------------------------------------
// D2 — Hora
//
// BPHS, Shodasavarga chapter, sloka 5-6:
//   "The first half of an odd sign is the Hora ruled by the Sun while the
//    second half is the Hora of the Moon. The reverse is true in the case of
//    an even sign."
//
// Under that rule a D2 position can only ever land in **Leo** (the Sun's own
// sign) or **Cancer** (the Moon's). There are just two possible D2 signs.
//
// The previous implementation did something quite different: it mapped
// `signIdx * 2 + hora` across all twelve signs. That is the Parivritti Dwaya
// scheme, and the comment in the source said plainly where it came from —
// "PyJHora uses __parivritti_even_reverse(dcf=2)". It was ported from another
// program rather than from the text, and it is not what Parashara describes.
//
// Both are offered. `'parashara'` is the default because BPHS is the authority
// for rules; `'parivritti'` reproduces the older behaviour and matches software
// that follows that scheme.
// ---------------------------------------------------------------------------

/** Which Hora (D2) rule to apply. */
export type HoraScheme = 'parashara' | 'parivritti';

/**
 * Default Hora scheme: BPHS. A D2 position therefore falls in Leo or Cancer.
 *
 * Set `'parivritti'` for the twelve-sign Parivritti Dwaya variant.
 */
export const DEFAULT_HORA_SCHEME: HoraScheme = 'parashara';

/** 0-indexed: Cancer = 3 (Moon's sign), Leo = 4 (Sun's sign). */
const CANCER = 3;
const LEO    = 4;

function d2Parashara(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const firstHalf = degInSign.lt(new Decimal(15));

    // signIdx is 0-based, so an even signIdx is an *odd* sign (Aries = 1st).
    const oddSign = signIdx % 2 === 0;
    const targetIdx = oddSign
        ? (firstHalf ? LEO : CANCER)      // odd:  Sun's hora then Moon's
        : (firstHalf ? CANCER : LEO);     // even: reversed

    const vDeg = degInSign.mod(new Decimal(15)).times(2);
    const vLon = new Decimal(targetIdx).times(D30).plus(vDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vDeg) };
}

function d2Parivritti(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const hora      = degInSign.lt(new Decimal(15)) ? 0 : 1;

    const targetIdx = signIdx % 2 === 0
        ? (signIdx * 2 + hora) % 12
        : (signIdx * 2 + (1 - hora)) % 12;

    const vDeg = degInSign.times(2).mod(D30);
    const vLon = new Decimal(targetIdx).times(D30).plus(vDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vDeg) };
}

function d2(lon: Decimal, scheme: HoraScheme = DEFAULT_HORA_SCHEME): VargaPoint {
    return scheme === 'parivritti' ? d2Parivritti(lon) : d2Parashara(lon);
}

// ---------------------------------------------------------------------------
// D3 — Drekkana
// 0-10°:  same sign
// 10-20°: 5th from sign (trine 1)
// 20-30°: 9th from sign (trine 2)
// ---------------------------------------------------------------------------
function d3(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);

    const part       = degInSign.div(10).floor().toNumber(); // 0, 1, 2
    const offsets    = [0, 4, 8]; // +0, +4 (5th), +8 (9th) in 0-indexed
    const targetIdx  = (signIdx + offsets[part]) % 12;

    const vargaDeg = degInSign.mod(10).times(3);
    const vLon     = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D4 — Chaturthamsa
// Sequence of 4 quadrants: sign, 4th, 7th, 10th (Kendra signs from given sign)
// ---------------------------------------------------------------------------
function d4(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);

    const part      = degInSign.div(new Decimal(7.5)).floor().toNumber(); // 0-3
    const offsets   = [0, 3, 6, 9]; // 1st, 4th, 7th, 10th
    const targetIdx = (signIdx + offsets[part]) % 12;

    const vargaDeg  = degInSign.mod(new Decimal(7.5)).times(4);
    const vLon      = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D7 — Saptamsa
// Odd signs: start from sign itself
// Even signs: start from 7th from sign
// 7 parts of 30/7° each
// ---------------------------------------------------------------------------
function d7(lon: Decimal): VargaPoint {
    const norm         = normalize360D(lon);
    const signIdx      = norm.div(D30).floor().toNumber();
    const degInSign    = norm.mod(D30);
    const partSpan     = D30.div(7); // 30/7 ≈ 4.2857°

    const part         = degInSign.div(partSpan).floor().toNumber(); // 0-6
    const startOffset  = (signIdx % 2 === 0) ? 0 : 6;               // odd(0-idx)=0, even=6
    const targetIdx    = (signIdx + startOffset + part) % 12;

    const vargaDeg     = degInSign.mod(partSpan).times(7);
    const vLon         = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D9 — Navamsa (harmonic formula matches Parashara for all sign types)
// Movable: start Aries (+0 offset)
// Fixed:   start Capricorn (+9 offset from sign)
// Dual:    start Libra/Cancer? — harmonic: lon*9%360 is proven to match BPHS
//
// Mathematical equivalence proof:
//   Movable Aries: 0° * 9 = 0 (Aries) ✓
//   Fixed Taurus:  30° * 9 = 270 (Capricorn, 9th from Taurus) ✓
//   Dual Gemini:   60° * 9 = 540 % 360 = 180 (Libra, 5th from Gemini) ✓
// ---------------------------------------------------------------------------
function d9(lon: Decimal): VargaPoint {
    return harmonic(lon, 9);
}

// ---------------------------------------------------------------------------
// D10 — Dasamsa
//
// Two schemes are supported; they agree for odd signs and differ for even ones.
// See {@link DasamsaScheme}.
// ---------------------------------------------------------------------------

/** 30° / 10 parts = 3° per Dasamsa. */
const DASAMSA_SPAN = new Decimal(3);

/** Assemble a VargaPoint from a target sign index and a degree within it. */
function vargaPoint(targetIdx: number, vargaDeg: Decimal): VargaPoint {
    // A reversed degree of exactly 30° lands on a sign boundary; carry it into
    // the next sign so sign, degree and longitude stay mutually consistent.
    let idx = ((targetIdx % 12) + 12) % 12;
    let deg = vargaDeg;
    if (deg.gte(D30)) { deg = deg.minus(D30); idx = (idx + 1) % 12; }

    const vLon = new Decimal(idx).times(D30).plus(deg);
    return { longitude: toNum(normalize360D(vLon)), sign: idx + 1, degree: toNum(deg) };
}

/**
 * Classical Parashara Dasamsa (BPHS).
 *   Odd  signs: ten parts counted forward from the sign itself.
 *   Even signs: ten parts counted forward from the 9th sign from it.
 */
function d10Parashara(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);

    const part      = degInSign.div(DASAMSA_SPAN).floor().toNumber();
    // signIdx is 0-based, so an even signIdx is an odd sign.
    const startOff  = (signIdx % 2 === 0) ? 0 : 8;

    return vargaPoint(signIdx + startOff + part, degInSign.mod(DASAMSA_SPAN).times(10));
}

/**
 * The Dasamsa scheme JHora labels **"D-10 (5-8)"**.
 *
 *   Odd  signs: identical to Parashara — forward from the sign itself.
 *   Even signs: ten parts counted **backward** from the 5th sign from it, with
 *               the degree **reversed** within each part.
 *
 * The label names the range the parts sweep: starting at the 5th sign and
 * running backward through ten signs ends on the 8th, hence "5-8".
 *
 * Derived from a JHora natal export rather than from a text: for that chart all
 * five bodies in odd signs already agreed, and all five in even signs matched
 * this rule to 0.05″ — including the reversal, where engine degree and JHora
 * degree sum to exactly 30.000 in every case.
 */
function d10Jhora58(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);

    const part = degInSign.div(DASAMSA_SPAN).floor().toNumber();
    const frac = degInSign.mod(DASAMSA_SPAN).times(10);

    if (signIdx % 2 === 0) return vargaPoint(signIdx + part, frac);   // odd sign

    return vargaPoint(signIdx + 4 - part, D30.minus(frac));           // even sign
}

/**
 * Which Dasamsa (D10) rule to use for even signs.
 *
 * - `'parashara'` — classical BPHS: forward from the 9th sign.
 * - `'jhora_5_8'` — the scheme JHora prints as "D-10 (5-8)": backward from the
 *   5th sign, degree reversed within the part.
 *
 * Odd signs are identical under both. Only D10 is affected; every other varga
 * has a single unambiguous rule.
 */
export type DasamsaScheme = 'parashara' | 'jhora_5_8';

/**
 * Default Dasamsa scheme: **classical Parashara**.
 *
 * This is the one place where the project deliberately does *not* follow JHora.
 * BPHS states the rule plainly — ten parts from the sign itself for odd signs,
 * from the ninth sign for even ones — and that is what `'parashara'` implements.
 * JHora's `(5-8)` variant has no basis in BPHS.
 *
 * The distinction matters because the layers have different authorities:
 * planetary positions are settled by astronomy, but *rules* are settled by the
 * text. Pass `{ dasamsaScheme: 'jhora_5_8' }` to reproduce JHora's D10 exactly.
 */
export const DEFAULT_DASAMSA_SCHEME: DasamsaScheme = 'parashara';

/** Options accepted by {@link calculateVarga}. */
export interface VargaOptions {
    dasamsaScheme?: DasamsaScheme;
    horaScheme?: HoraScheme;
}

function d10(lon: Decimal, scheme: DasamsaScheme = DEFAULT_DASAMSA_SCHEME): VargaPoint {
    return scheme === 'parashara' ? d10Parashara(lon) : d10Jhora58(lon);
}

// ---------------------------------------------------------------------------
// D12 — Dvadasamsa
// 12 parts of 2.5° each, sequential starting from the same sign
// ---------------------------------------------------------------------------
function d12(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const partSpan  = new Decimal(2.5);

    const part      = degInSign.div(partSpan).floor().toNumber();
    const targetIdx = (signIdx + part) % 12;

    const vargaDeg  = degInSign.mod(partSpan).times(12);
    const vLon      = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D16 — Shodasamsa
// 4 groups of 4 Navamsa-sized parts (each 1°52'30"):
// Movable: group starts at Aries (0)
// Fixed:   group starts at Leo (4)
// Dual:    group starts at Sagittarius (8)
// Within each group, sequential from the start sign.
// ---------------------------------------------------------------------------
function d16(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const partSpan  = D30.div(16); // 30/16 = 1.875°

    const part       = degInSign.div(partSpan).floor().toNumber(); // 0-15
    const groupStart = [0, 4, 8][signType(signIdx) === 'movable' ? 0 : signType(signIdx) === 'fixed' ? 1 : 2];
    const targetIdx  = (groupStart + part) % 12;

    const vargaDeg   = degInSign.mod(partSpan).times(16);
    const vLon       = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D20 — Vimsamsa
// Movable: Aries (0), Fixed: Sagittarius (8), Dual: Leo (4)
// 20 parts of 1.5° each
// ---------------------------------------------------------------------------
function d20(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const partSpan  = new Decimal(1.5); // 30/20

    const part       = degInSign.div(partSpan).floor().toNumber();
    const starts     = { movable: 0, fixed: 8, dual: 4 };
    const groupStart = starts[signType(signIdx)];
    const targetIdx  = (groupStart + part) % 12;

    const vargaDeg   = degInSign.mod(partSpan).times(20);
    const vLon       = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D24 — Chaturvimsamsa (Siddhamsa)
// Odd signs: start from Leo (4)
// Even signs: start from Cancer (3)
// 24 parts of 1.25° each
// ---------------------------------------------------------------------------
function d24(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const partSpan  = D30.div(24); // 1.25°

    const part       = degInSign.div(partSpan).floor().toNumber();
    const groupStart = (signIdx % 2 === 0) ? 4 : 3; // odd(0-idx)=Leo(4), even=Cancer(3)
    const targetIdx  = (groupStart + part) % 12;

    const vargaDeg   = degInSign.mod(partSpan).times(24);
    const vLon       = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D27 — Saptavimsamsa (Bhamsa / Nakshatramsa)
// Traditional Parasara (PyJHora chart_method=1):
//   Starting sign by ELEMENT (not modality):
//     Fire (Ar=0,Le=4,Sg=8)  → start from Aries (offset 0)
//     Earth(Ta=1,Vi=5,Cp=9)  → start from Cancer (offset 3)
//     Air  (Ge=2,Li=6,Aq=10) → start from Libra  (offset 6)
//     Water(Cn=3,Sc=7,Pi=11) → start from Capricorn (offset 9)
//   Element determined by: signIdx % 4  (0=fire,1=earth,2=air,3=water)
//   Degree: (degInSign * 27) % 30
// ---------------------------------------------------------------------------
function d27(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const partSpan  = D30.div(27); // 30/27 ≈ 1.1111°

    const part        = degInSign.div(partSpan).floor().toNumber(); // 0-26
    const elementOff  = (signIdx % 4) * 3;  // fire=0, earth=3, air=6, water=9
    const targetIdx   = (elementOff + part) % 12;

    const vargaDeg = degInSign.mod(partSpan).times(27);
    const vLon     = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D30 — Trimsamsa (Traditional Parasara, PyJHora chart_method=1)
//
// Unequal spans per BPHS; target sign assigned directly (not via lord):
//   Odd signs  (signIdx%2===0 = Ar,Ge,Le,Li,Sg,Aq):
//     0°–5°   → Aries(0),  5°–10° → Aquarius(10), 10°–18° → Sagittarius(8)
//     18°–25° → Gemini(2), 25°–30° → Libra(6)
//   Even signs (signIdx%2===1 = Ta,Cn,Vi,Sc,Cp,Pi):
//     0°–5°   → Taurus(1), 5°–12° → Virgo(5),  12°–20° → Pisces(11)
//     20°–25° → Capricorn(9), 25°–30° → Scorpio(7)
//
// Degree within D30 sign: (degInSign * 30) % 30
// ---------------------------------------------------------------------------
// [upperBound, targetSignIdx (0-based)]
const TRIMSAMSA_ODD  = [[5,0],[10,10],[18,8],[25,2],[30,6]] as const;
const TRIMSAMSA_EVEN = [[5,1],[12,5],[20,11],[25,9],[30,7]] as const;

function d30(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = toNum(norm.mod(D30));
    const isOdd     = (signIdx % 2) === 0; // 0-indexed even = traditional odd sign
    const table     = isOdd ? TRIMSAMSA_ODD : TRIMSAMSA_EVEN;

    // Find first range whose upper bound >= degInSign (matches PyJHora first-match)
    let targetIdx = table[table.length - 1][1];
    for (const [ub, si] of table) {
        if (degInSign <= ub) { targetIdx = si; break; }
    }

    const vDeg = (degInSign * 30) % 30;
    const vLon = targetIdx * 30 + vDeg;
    return {
        longitude: toNum(normalize360D(new Decimal(vLon))),
        sign:      targetIdx + 1,
        degree:    vDeg,
    };
}

// ---------------------------------------------------------------------------
// D40 — Khavedamsa
// Odd signs: start from Aries (0)
// Even signs: start from Libra (6)
// 40 parts of 0.75° each
// ---------------------------------------------------------------------------
function d40(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const partSpan  = D30.div(40); // 0.75°

    const part       = degInSign.div(partSpan).floor().toNumber();
    const groupStart = (signIdx % 2 === 0) ? 0 : 6; // odd(0-idx)=Aries, even=Libra
    const targetIdx  = (groupStart + part) % 12;

    const vargaDeg   = degInSign.mod(partSpan).times(40);
    const vLon       = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D45 — Akshavedamsa
// Movable: Aries (0), Fixed: Leo (4), Dual: Sagittarius (8)
// 45 parts of 0.666...° each
// ---------------------------------------------------------------------------
function d45(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    const signIdx   = norm.div(D30).floor().toNumber();
    const degInSign = norm.mod(D30);
    const partSpan  = D30.div(45); // 30/45

    const part       = degInSign.div(partSpan).floor().toNumber();
    const starts     = { movable: 0, fixed: 4, dual: 8 };
    const groupStart = starts[signType(signIdx)];
    const targetIdx  = (groupStart + part) % 12;

    const vargaDeg   = degInSign.mod(partSpan).times(45);
    const vLon       = new Decimal(targetIdx).times(D30).plus(vargaDeg);
    return { longitude: toNum(normalize360D(vLon)), sign: targetIdx + 1, degree: toNum(vargaDeg) };
}

// ---------------------------------------------------------------------------
// D60 — Shashtyamsa
// 60 sequential divisions starting from Aries; each 0.5°.
// Deities assigned to each of the 60 parts.
// ---------------------------------------------------------------------------
const SHASHTYAMSA_DEITIES: string[] = [
    'Ghora','Rakshasa','Deva','Kubera','Yaksha','Kinnara','Bhrashta',
    'Kulaghna','Garala','Vahni','Maya','Purishaka','Apampathi','Marut','Kaala',
    'Sarpa','Amrita','Indu','Mridu','Komala','Heramba','Brahma','Vishnu',
    'Maheshwara','Deva','Ardra','Kalinasha','Kshiteesh','Kamalakara','Gulika',
    'Mrityu','Kaala','Davagni','Ghora','Yama','Kantaka','Sudha','Amrita',
    'Poorna','Chandra','Mridu','Saumya','Mridu','Ati Saumya','Shubha',
    'Shubhakrut','Karaala Vaktra','Chandra Mukhi','Praveena','Kaala Pavaka',
    'Dandayudha','Nirmala','Saumya','Krura','Atisheetala','Amrita','Payodhi',
    'Brahma','Vishnu','Trilochana',
];

function d60(lon: Decimal): VargaPoint {
    const norm      = normalize360D(lon);
    // D1 sign and degree-within-sign
    const signIdx   = norm.div(D30).floor().toNumber();   // 0-11
    const degInSign = norm.mod(D30);
    const partSpan  = new Decimal('0.5');                 // 0.5° per shashtyamsa

    // PyJHora Traditional Parasara (chart_method=1):
    //   l  = floor(degInSign / 0.5)        → 0-59
    //   r  = (sign + l) % 12              → target sign
    //   d_long = (degInSign * 60) % 30
    const l         = degInSign.div(partSpan).floor().toNumber();   // 0-59
    const targetIdx = (signIdx + l) % 12;

    const vargaDeg  = toNum(degInSign.mod(partSpan).times(60));
    const vLon      = new Decimal(targetIdx).times(D30).plus(new Decimal(vargaDeg));
    const deityIdx  = l % SHASHTYAMSA_DEITIES.length;

    return {
        longitude: toNum(normalize360D(vLon)),
        sign:      targetIdx + 1,
        degree:    vargaDeg,
        deity:     SHASHTYAMSA_DEITIES[deityIdx],
    };
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

const VARGA_FNS: Record<number, (lon: Decimal) => VargaPoint> = {
    1:  d1,
    2:  d2,
    3:  d3,
    4:  d4,
    7:  d7,
    9:  d9,
    10: d10,
    12: d12,
    16: d16,
    20: d20,
    24: d24,
    27: d27,
    30: d30,
    40: d40,
    45: d45,
    60: d60,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate a planet's position in a given Divisional Chart.
 *
 * @param longitude  Sidereal longitude in degrees [0, 360)
 * @param division   Chart divisor (1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60)
 * @param options    Per-call overrides; currently only the D10 scheme
 * @returns VargaPoint with sign (1-12), degree (0-30), and longitude
 */
export function calculateVarga(
    longitude: number, division: number, options: VargaOptions = {},
): VargaPoint {
    const lon = new Decimal(longitude);

    // D2 and D10 are the two vargas with competing schemes in circulation.
    if (division === 2) {
        return d2(lon, options.horaScheme ?? DEFAULT_HORA_SCHEME);
    }
    if (division === 10) {
        return d10(lon, options.dasamsaScheme ?? DEFAULT_DASAMSA_SCHEME);
    }

    const fn = VARGA_FNS[division];
    if (!fn) {
        // Unknown division — fall back to harmonic
        return harmonic(lon, division);
    }
    return fn(lon);
}

// Convenience exports for common vargas
export const calculateD1  = (lon: number): VargaPoint => calculateVarga(lon, 1);
export const calculateD2  = (lon: number, options: VargaOptions = {}): VargaPoint => calculateVarga(lon, 2, options);
export const calculateD3  = (lon: number): VargaPoint => calculateVarga(lon, 3);
export const calculateD4  = (lon: number): VargaPoint => calculateVarga(lon, 4);
export const calculateD7  = (lon: number): VargaPoint => calculateVarga(lon, 7);
export const calculateD9  = (lon: number): VargaPoint => calculateVarga(lon, 9);
export const calculateD10 = (lon: number, options: VargaOptions = {}): VargaPoint =>
    calculateVarga(lon, 10, options);
export const calculateD12 = (lon: number): VargaPoint => calculateVarga(lon, 12);
export const calculateD16 = (lon: number): VargaPoint => calculateVarga(lon, 16);
export const calculateD20 = (lon: number): VargaPoint => calculateVarga(lon, 20);
export const calculateD24 = (lon: number): VargaPoint => calculateVarga(lon, 24);
export const calculateD27 = (lon: number): VargaPoint => calculateVarga(lon, 27);
export const calculateD30 = (lon: number): VargaPoint => calculateVarga(lon, 30);
export const calculateD40 = (lon: number): VargaPoint => calculateVarga(lon, 40);
export const calculateD45 = (lon: number): VargaPoint => calculateVarga(lon, 45);
export const calculateD60 = (lon: number): VargaPoint => calculateVarga(lon, 60);
export const calculateShashtyamsa = calculateD60;
