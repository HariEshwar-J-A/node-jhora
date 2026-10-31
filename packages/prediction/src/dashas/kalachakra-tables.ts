/**
 * Kalachakra (Kaal Chakra) nine-sign sequences per Moon nakshatra pada.
 *
 * @provenance BPHS ch. 46 vv. 56–82 (Deha/Jiva and nine-rashi rows);
 *   Phaladeepika ch. 22 vv. 5–7 (pada templates for Ashwini, Bharani, Rohini,
 *   Mrigashira replicated to all 27 nakshatras per vv. 6–7); sign-year lengths
 *   BPHS v. 84 / Phaladeepika v. 3 (7 graha years mapped to rashi lords).
 * @see docs/decisions/0020-extended-dashas-kalachakra-jaimini-tajika.md
 */

/** Sidereal rashi years in Kalachakra (Aries … Pisces). */
export const KALACHAKRA_SIGN_YEARS: readonly number[] = [7, 16, 9, 21, 5, 9, 16, 7, 10, 4, 4, 10];

const PADA_SPAN_DEG = 360 / 108;

export type KalachakraChakra = 'savya' | 'apsavya';

export interface KalachakraPadaRow {
    /** Nine mahadasha rashis (0 = Aries … 11 = Pisces). */
    signs: readonly number[];
    dehaSign: number;
    jivaSign: number;
    chakra: KalachakraChakra;
    paramayusYears: number;
}

/** BPHS v. 89 paramayu by navamsa anchor sign (triplicity of 100/85/83/86). */
export function paramayusForNavamsaSign(navamsaSign: number): number {
    const s = ((navamsaSign % 12) + 12) % 12;
    if (s === 0 || s === 4 || s === 8) return 100;
    if (s === 1 || s === 5 || s === 9) return 85;
    if (s === 2 || s === 6 || s === 10) return 83;
    return 86;
}

/** BPHS vv. 87–88: navamsa sign index 0–11 from nakshatra (1–27) and pada (1–4). */
export function navamsaSignFromNakshatraPada(nakshatraIndex: number, pada: number): number {
    const nakNum = (nakshatraIndex % 27) + 1;
    const rem = nakNum % 3;
    const navamsaFromAries = rem * 4 + pada;
    return (navamsaFromAries - 1) % 12;
}

type TemplateId = 'ashwini' | 'bharani' | 'rohini' | 'mrigashira';

function templateForNakshatra(nakshatraIndex: number): TemplateId {
    const n = nakshatraIndex % 27;
    if (
        n === 0 ||
        n === 2 ||
        n === 6 ||
        n === 8 ||
        n === 12 ||
        n === 14 ||
        n === 18 ||
        n === 20 ||
        n === 24 ||
        n === 26
    ) {
        return 'ashwini';
    }
    if (n === 1 || n === 7 || n === 19 || n === 25) return 'bharani';
    if (n === 3 || n === 9 || n === 15 || n === 21) return 'rohini';
    return 'mrigashira';
}

function chakraForNakshatra(nakshatraIndex: number): KalachakraChakra {
    const n = nakshatraIndex % 27;
    const savya = new Set([0, 1, 2, 6, 7, 8, 12, 13, 14, 18, 19, 20, 24, 25, 26]);
    return savya.has(n) ? 'savya' : 'apsavya';
}

/** Phaladeepika / BPHS replicated templates (four padas each). */
const TEMPLATES: Record<TemplateId, readonly (readonly number[])[]> = {
    ashwini: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [9, 10, 11, 7, 6, 5, 3, 4, 2],
        [1, 0, 11, 10, 9, 8, 0, 1, 2],
        [3, 4, 5, 6, 7, 8, 9, 10, 11],
    ],
    bharani: [
        [7, 6, 5, 3, 4, 2, 1, 0, 11],
        [10, 9, 8, 0, 1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10, 11, 7, 6, 8],
        [3, 4, 2, 1, 0, 11, 10, 9, 8],
    ],
    rohini: [
        [8, 9, 10, 11, 0, 1, 2, 4, 3],
        [5, 6, 7, 11, 10, 9, 8, 7, 6],
        [5, 4, 3, 2, 1, 0, 8, 9, 10],
        [11, 0, 1, 2, 4, 3, 5, 6, 7],
    ],
    mrigashira: [
        [11, 10, 9, 8, 7, 6, 5, 4, 3],
        [2, 1, 0, 8, 9, 10, 11, 0, 1],
        [2, 4, 3, 6, 5, 7, 11, 10, 9],
        [8, 7, 6, 5, 4, 3, 2, 1, 0],
    ],
};

export function kalachakraPadaRow(moonLongitude: number): KalachakraPadaRow {
    const lon = ((moonLongitude % 360) + 360) % 360;
    const padaIndex = Math.floor(lon / PADA_SPAN_DEG);
    const nakshatraIndex = Math.floor(padaIndex / 4);
    const pada = (padaIndex % 4) + 1;
    const template = templateForNakshatra(nakshatraIndex);
    const signs = TEMPLATES[template][pada - 1]!;
    const chakra = chakraForNakshatra(nakshatraIndex);
    const navSign = navamsaSignFromNakshatraPada(nakshatraIndex, pada);
    const paramayusYears = paramayusForNavamsaSign(navSign);
    const dehaSign = chakra === 'savya' ? signs[0]! : signs[8]!;
    const jivaSign = chakra === 'savya' ? signs[8]! : signs[0]!;
    return { signs, dehaSign, jivaSign, chakra, paramayusYears };
}

export function moonPadaFraction(moonLongitude: number): number {
    const lon = ((moonLongitude % 360) + 360) % 360;
    const inPada = lon % PADA_SPAN_DEG;
    return inPada / PADA_SPAN_DEG;
}

export { PADA_SPAN_DEG };
