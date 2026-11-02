import { SIGN_NAMES } from '../../lib/format';
import type { ChartPlanet } from './types';

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
        Ascendant: 'Asc',
        Uranus: 'Ur',
        Neptune: 'Ne',
        Pluto: 'Pl',
    };
    return map[name] ?? name.slice(0, 2);
}

export function wholeSignHouse(planetSign0: number, ascSign0: number): number {
    return ((planetSign0 - ascSign0 + 12) % 12) + 1;
}

export function planetSign0(p: ChartPlanet): number {
    if (p.sign != null) return p.sign - 1;
    return signIndex0(p.longitude);
}

export function degreeInSign(p: ChartPlanet): number {
    if (p.degree != null) return p.degree;
    return ((p.longitude % 30) + 30) % 30;
}

export function isRetrograde(p: ChartPlanet): boolean {
    return p.speed != null && p.speed < 0;
}

export const NORTH_VIEW_BOX = '-4 -4 108 108';

/** Inset frame so non-scaling strokes stay inside the viewBox. */
export const NORTH_FRAME_PATH =
    'M 8 8 H 92 V 92 H 8 Z M 8 8 L 92 92 M 92 8 L 8 92 M 50 8 L 92 50 L 50 92 L 8 50 Z';

/** North Indian house anchors (viewBox −4…108, frame 8–92). */
export const NORTH_HOUSE_ANCHORS: Record<number, { x: number; y: number }> = {
    1: { x: 50, y: 17 },
    2: { x: 16, y: 16 },
    3: { x: 16, y: 38 },
    4: { x: 16, y: 62 },
    5: { x: 16, y: 84 },
    6: { x: 38, y: 84 },
    7: { x: 50, y: 84 },
    8: { x: 62, y: 84 },
    9: { x: 84, y: 84 },
    10: { x: 84, y: 62 },
    11: { x: 84, y: 38 },
    12: { x: 84, y: 16 },
};

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

export const SOUTH_CENTER = { x: 28.5, y: 28.5, w: 41, h: 41 };

export function signLabel(sign0: number): string {
    return String(sign0 + 1);
}

export function signNameShort(sign0: number): string {
    return SIGN_NAMES[sign0]?.slice(0, 3) ?? '';
}

/** Stack planets in a house without overlap; returns y-offset per row. */
export function planetStackLayout(count: number, baseY: number, maxRows = 6): number[] {
    const n = Math.min(count, maxRows);
    const step = count > 4 ? 4.2 : 5.2;
    const start = baseY - ((n - 1) * step) / 2;
    return Array.from({ length: n }, (_, i) => start + i * step);
}

export type PlanetLabelSlot = { x: number; y: number; fontSize: number };

const NORTH_CENTER = { x: 50, y: 50 };

/** Shift label block toward chart centre so text clears diagonals and outer frame. */
function northHouseLabelOrigin(
    house: number,
    anchor: { x: number; y: number },
): { x: number; y: number } {
    const pull: Record<number, number> = {
        1: 0.1,
        2: 0.24,
        3: 0.16,
        4: 0.14,
        5: 0.14,
        6: 0.2,
        7: 0.12,
        8: 0.2,
        9: 0.14,
        10: 0.16,
        11: 0.18,
        12: 0.24,
    };
    const t = pull[house] ?? 0.14;
    return {
        x: anchor.x + (NORTH_CENTER.x - anchor.x) * t,
        y: anchor.y + (NORTH_CENTER.y - anchor.y) * t,
    };
}

/** North Indian: inset labels; 2×2 grid when crowded; always room for "Su 12° R". */
export function northHousePlanetLayout(
    count: number,
    anchor: { x: number; y: number },
    house?: number,
): PlanetLabelSlot[] {
    if (count === 0) return [];
    const origin = house != null ? northHouseLabelOrigin(house, anchor) : anchor;
    const cols = count >= 3 ? 2 : 1;
    const rows = Math.ceil(count / cols);
    let fontSize = 3.85;
    if (count >= 3) fontSize = 3.05;
    if (count >= 4) fontSize = 2.75;
    if (count >= 5) fontSize = 2.55;
    const rowStep = fontSize * 1.32;
    const colStep = count >= 4 ? 7.2 : 8;
    const slots: PlanetLabelSlot[] = [];
    for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const xOff = cols === 1 ? 0 : (col - (cols - 1) / 2) * colStep;
        const blockH = (rows - 1) * rowStep;
        const y = origin.y + 4 - blockH / 2 + row * rowStep;
        slots.push({ x: origin.x + xOff, y, fontSize });
    }
    return slots;
}

/** South Indian: grid labels inside a sign cell (up to 2×2). */
export function southCellPlanetLayout(
    count: number,
    cell: { x: number; y: number; size: number },
): PlanetLabelSlot[] {
    if (count === 0) return [];
    const cols = count > 2 ? 2 : 1;
    const rows = Math.ceil(count / cols);
    const fontSize = count > 3 ? 2.95 : 3.55;
    const rowStep = fontSize * 1.12;
    const colStep = 8.5;
    const startY = cell.y + 9.5;
    const slots: PlanetLabelSlot[] = [];
    for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        slots.push({
            x: cell.x + 3 + col * colStep,
            y: startY + row * rowStep,
            fontSize,
        });
    }
    return slots;
}

export function southCenterMetaLines(meta: { title: string; subtitle?: string }): {
    lines: string[];
    fontSize: number;
} {
    const lines = [meta.title];
    if (meta.subtitle) lines.push(meta.subtitle);
    const longest = Math.max(...lines.map((l) => l.length));
    const fontSize = longest > 10 ? 2.85 : longest > 7 ? 3.15 : 3.45;
    return { lines: lines.slice(0, 2), fontSize };
}
