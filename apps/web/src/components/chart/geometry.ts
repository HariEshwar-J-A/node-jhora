import type { ChartPlanet } from './types';

const SIGN_NAMES_SHORT = [
    'Ari',
    'Tau',
    'Gem',
    'Can',
    'Leo',
    'Vir',
    'Lib',
    'Sco',
    'Sag',
    'Cap',
    'Aqu',
    'Pis',
] as const;

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

/** Chart lives in 0–100 user units; viewBox adds margin for strokes. */
export const NORTH_CHART_SIZE = 100;
export const NORTH_VIEW_BOX = '-5 -5 110 110';

/** Outer square, both diagonals, inner diamond (mid-edge points). */
export const NORTH_OUTER_SQUARE_PATH = 'M 0 0 H 100 V 100 H 0 Z';
export const NORTH_DIAGONAL_DIAMOND_PATH =
    'M 0 0 L 100 100 M 100 0 L 0 100 M 50 0 L 100 50 L 50 100 L 0 50 Z';
export const NORTH_FRAME_PATH = `${NORTH_OUTER_SQUARE_PATH} ${NORTH_DIAGONAL_DIAMOND_PATH}`;

/** House centroids for planet stacks (counter-clockwise from top centre). */
export const NORTH_HOUSE_ANCHORS: Record<number, { x: number; y: number }> = {
    1: { x: 50, y: 25 },
    2: { x: 25, y: 8 },
    3: { x: 8, y: 25 },
    4: { x: 25, y: 50 },
    5: { x: 8, y: 75 },
    6: { x: 25, y: 92 },
    7: { x: 50, y: 75 },
    8: { x: 75, y: 92 },
    9: { x: 92, y: 75 },
    10: { x: 75, y: 50 },
    11: { x: 92, y: 25 },
    12: { x: 75, y: 8 },
};

/** Sign digit near inner vertex, shifted toward chart centre (50, 50). */
export const NORTH_SIGN_LABEL_ANCHORS: Record<number, { x: number; y: number }> = {
    1: { x: 50, y: 14 },
    2: { x: 32, y: 14 },
    3: { x: 14, y: 32 },
    4: { x: 14, y: 50 },
    5: { x: 14, y: 68 },
    6: { x: 32, y: 86 },
    7: { x: 50, y: 86 },
    8: { x: 68, y: 86 },
    9: { x: 86, y: 68 },
    10: { x: 86, y: 50 },
    11: { x: 86, y: 32 },
    12: { x: 68, y: 14 },
};

/** House polygons in 0–100 space (for layout tests). */
export const NORTH_HOUSE_POLYGONS: Record<number, [number, number][]> = {
    1: [
        [50, 0],
        [100, 50],
        [50, 50],
        [0, 50],
    ],
    2: [
        [0, 0],
        [50, 0],
        [0, 50],
    ],
    3: [
        [0, 0],
        [0, 50],
        [50, 50],
    ],
    4: [
        [0, 50],
        [50, 50],
        [50, 100],
        [0, 100],
    ],
    5: [
        [0, 50],
        [0, 100],
        [50, 50],
    ],
    6: [
        [0, 100],
        [50, 100],
        [50, 50],
    ],
    7: [
        [50, 100],
        [100, 50],
        [50, 50],
        [0, 50],
    ],
    8: [
        [100, 100],
        [50, 100],
        [50, 50],
    ],
    9: [
        [100, 50],
        [100, 100],
        [50, 50],
    ],
    10: [
        [100, 50],
        [50, 50],
        [50, 0],
        [100, 0],
    ],
    11: [
        [100, 0],
        [100, 50],
        [50, 50],
    ],
    12: [
        [50, 0],
        [100, 0],
        [100, 50],
    ],
};

/** Closed outer square only (for tests). */

export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
    const eps = 1e-6;
    for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i]!;
        const [x2, y2] = poly[(i + 1) % poly.length]!;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 < eps) continue;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
        const px = x1 + t * dx;
        const py = y1 + t * dy;
        if ((x - px) ** 2 + (y - py) ** 2 <= eps) return true;
    }
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]!;
        const [xj, yj] = poly[j]!;
        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

/** Fixed South Indian sign grid (0-based sign index), clockwise from top-left. */
export const SOUTH_SIGN_CELLS: { sign: number; row: number; col: number }[] = [
    { sign: 11, row: 0, col: 0 },
    { sign: 0, row: 0, col: 1 },
    { sign: 1, row: 0, col: 2 },
    { sign: 2, row: 0, col: 3 },
    { sign: 10, row: 1, col: 0 },
    { sign: 3, row: 1, col: 3 },
    { sign: 9, row: 2, col: 0 },
    { sign: 4, row: 2, col: 3 },
    { sign: 8, row: 3, col: 0 },
    { sign: 7, row: 3, col: 1 },
    { sign: 6, row: 3, col: 2 },
    { sign: 5, row: 3, col: 3 },
];

export const SOUTH_GRID = {
    origin: 5,
    cell: 22.5,
    gap: 0.5,
};

export function southCellRect(row: number, col: number): { x: number; y: number; size: number } {
    const { origin, cell, gap } = SOUTH_GRID;
    const step = cell + gap;
    return {
        x: origin + col * step,
        y: origin + row * step,
        size: cell,
    };
}

export const SOUTH_CENTER = { x: 28.5, y: 28.5, w: 43, h: 43 };

export function southFramePath(): string {
    return SOUTH_SIGN_CELLS.map(({ row, col }) => {
        const { x, y, size } = southCellRect(row, col);
        const s = size - 0.4;
        return `M ${x} ${y} H ${x + s} V ${y + s} H ${x} Z`;
    }).join(' ');
}

export const SOUTH_FRAME_PATH = southFramePath();

export const SOUTH_VIEW_BOX = '-2 -2 104 104';

/** Inner corner of cell toward chart centre (50, 50). */
export function southSignLabelAnchor(row: number, col: number): { x: number; y: number } {
    const { x, y, size } = southCellRect(row, col);
    const cx = 50;
    const cy = 50;
    const corners = [
        { x: x + 2, y: y + 4 },
        { x: x + size - 2, y: y + 4 },
        { x: x + 2, y: y + size - 2 },
        { x: x + size - 2, y: y + size - 2 },
    ];
    let best = corners[0]!;
    let bestD = Infinity;
    for (const c of corners) {
        const d = (c.x - cx) ** 2 + (c.y - cy) ** 2;
        if (d < bestD) {
            bestD = d;
            best = c;
        }
    }
    return best;
}

export function signLabel(sign0: number): string {
    return String(sign0 + 1);
}

export function signNameShort(sign0: number): string {
    return SIGN_NAMES_SHORT[sign0] ?? '';
}

export type PlanetLabelSlot = { x: number; y: number; fontSize: number };

/** North Indian: 2-column grid when crowded; labels stay near house centroid. */
export function northHousePlanetLayout(
    count: number,
    anchor: { x: number; y: number },
): PlanetLabelSlot[] {
    if (count === 0) return [];
    const pull = count >= 4 ? 0.14 : count >= 3 ? 0.08 : 0;
    const cx = anchor.x + (50 - anchor.x) * pull;
    const cy = anchor.y + (50 - anchor.y) * pull;
    const cols = count >= 3 ? 2 : 1;
    const rows = Math.ceil(count / cols);
    let fontSize = 3.6;
    if (count >= 3) fontSize = 2.95;
    if (count >= 4) fontSize = 2.65;
    if (count >= 5) fontSize = 2.45;
    const rowStep = fontSize * 1.35;
    const colStep = 7;
    const slots: PlanetLabelSlot[] = [];
    for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const xOff = cols === 1 ? 0 : (col - (cols - 1) / 2) * colStep;
        const blockH = (rows - 1) * rowStep;
        const y = cy - blockH / 2 + row * rowStep;
        slots.push({ x: cx + xOff, y, fontSize });
    }
    return slots;
}

/** South Indian: grid inside sign cell. */
export function southCellPlanetLayout(
    count: number,
    cell: { x: number; y: number; size: number },
): PlanetLabelSlot[] {
    if (count === 0) return [];
    const cols = count >= 3 ? 2 : 1;
    const rows = Math.ceil(count / cols);
    const fontSize = count >= 3 ? 2.65 : 3.1;
    const rowStep = fontSize * 1.25;
    const colStep = 7.5;
    const cx = cell.x + cell.size / 2;
    const startY = cell.y + cell.size * 0.42;
    const slots: PlanetLabelSlot[] = [];
    for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const xOff = cols === 1 ? 0 : (col - (cols - 1) / 2) * colStep;
        slots.push({
            x: cx + xOff,
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
