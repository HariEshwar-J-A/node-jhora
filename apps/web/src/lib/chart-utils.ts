import { SIGN_NAMES } from './format';

export interface ChartPlanet {
    name: string;
    longitude: number;
    /** 1–12 sidereal sign index when available */
    sign?: number;
}

export function signIndex0(lon: number): number {
    return Math.floor((((lon % 360) + 360) % 360) / 30);
}

export function planetShortName(name: string): string {
    const map: Record<string, string> = {
        Sun: 'Su',
        Moon: 'Mo',
        Mercury: 'Me',
        Venus: 'Ve',
        Mars: 'Ma',
        Jupiter: 'Ju',
        Saturn: 'Sa',
        Rahu: 'Ra',
        Ketu: 'Ke',
        Uranus: 'Ur',
        Neptune: 'Ne',
        Pluto: 'Pl',
    };
    return map[name] ?? name.slice(0, 2);
}

/** Whole-sign house 1–12 from ascendant sign (0–11) and planet sign (0–11). */
export function wholeSignHouse(planetSign0: number, ascSign0: number): number {
    return ((planetSign0 - ascSign0 + 12) % 12) + 1;
}

export function planetSign0(p: ChartPlanet): number {
    if (p.sign != null) return p.sign - 1;
    return signIndex0(p.longitude);
}

/** North Indian: house index 1–12 → label anchor (viewBox 0–100). */
export const NORTH_HOUSE_ANCHORS: Record<number, { x: number; y: number }> = {
    1: { x: 50, y: 16 },
    2: { x: 14, y: 14 },
    3: { x: 14, y: 36 },
    4: { x: 14, y: 64 },
    5: { x: 14, y: 86 },
    6: { x: 36, y: 86 },
    7: { x: 50, y: 86 },
    8: { x: 64, y: 86 },
    9: { x: 86, y: 86 },
    10: { x: 86, y: 64 },
    11: { x: 86, y: 36 },
    12: { x: 86, y: 14 },
};

/** South Indian fixed sign grid: sign 0–11 → cell row/col in 4×4 (centre empty). */
export const SOUTH_SIGN_CELLS: { sign: number; row: number; col: number }[] = [
    { sign: 11, row: 0, col: 0 },
    { sign: 10, row: 0, col: 1 },
    { sign: 9, row: 0, col: 2 },
    { sign: 8, row: 0, col: 3 },
    { sign: 7, row: 1, col: 0 },
    { sign: 6, row: 1, col: 3 },
    { sign: 5, row: 2, col: 0 },
    { sign: 4, row: 2, col: 3 },
    { sign: 3, row: 3, col: 0 },
    { sign: 2, row: 3, col: 1 },
    { sign: 1, row: 3, col: 2 },
    { sign: 0, row: 3, col: 3 },
];

export const NORTH_FRAME_PATH =
    'M 5 5 H 95 V 95 H 5 Z M 5 5 L 95 95 M 95 5 L 5 95 M 50 5 L 95 50 L 50 95 L 5 50 Z';

const SOUTH_CELL = 21;
const SOUTH_ORIGIN = 7;

function southCellPath(row: number, col: number): string {
    const x = SOUTH_ORIGIN + col * SOUTH_CELL;
    const y = SOUTH_ORIGIN + row * SOUTH_CELL;
    const s = SOUTH_CELL - 1;
    return `M ${x} ${y} H ${x + s} V ${y + s} H ${x} Z`;
}

export const SOUTH_FRAME_PATH = SOUTH_SIGN_CELLS.map(({ row, col }) =>
    southCellPath(row, col),
).join(' ');

export function signLabel(sign0: number): string {
    return String(sign0 + 1);
}

export function signNameShort(sign0: number): string {
    return SIGN_NAMES[sign0]?.slice(0, 3) ?? '';
}
