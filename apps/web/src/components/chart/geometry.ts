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

/** Chart lives in 0–100 user units. ViewBox width 104 keeps a 2.6-unit glyph ≥ 12px at 480px. */
export const NORTH_CHART_SIZE = 100;
export const NORTH_VIEW_BOX = '-2 -2 104 104';

/** Outer square, both diagonals, inner diamond (mid-edge points). */
export const NORTH_OUTER_SQUARE_PATH = 'M 0 0 H 100 V 100 H 0 Z';
export const NORTH_DIAGONAL_DIAMOND_PATH =
    'M 0 0 L 100 100 M 100 0 L 0 100 M 50 0 L 100 50 L 50 100 L 0 50 Z';
export const NORTH_FRAME_PATH = `${NORTH_OUTER_SQUARE_PATH} ${NORTH_DIAGONAL_DIAMOND_PATH}`;

export type NorthTextRect = { x0: number; y0: number; x1: number; y1: number };

/**
 * Single source for the North Indian chart in 0–100 space.
 * Outer square, both diagonals, inner diamond (50,0)(100,50)(50,100)(0,50).
 * Houses run counter-clockwise from the top diamond.
 */
export const NORTH_HOUSES: {
    house: number;
    poly: [number, number][];
    text: NorthTextRect;
    sign: { x: number; y: number };
}[] = [
    {
        house: 1,
        poly: [
            [50, 0],
            [75, 25],
            [50, 50],
            [25, 25],
        ],
        text: { x0: 36, y0: 17, x1: 64, y1: 33 },
        sign: { x: 50, y: 42 },
    },
    {
        house: 2,
        poly: [
            [0, 0],
            [50, 0],
            [25, 25],
        ],
        text: { x0: 14.85, y0: 2.8, x1: 35.15, y1: 12 },
        sign: { x: 25, y: 17 },
    },
    {
        house: 3,
        poly: [
            [0, 0],
            [25, 25],
            [0, 50],
        ],
        text: { x0: 2.5, y0: 16.4, x1: 13.45, y1: 33.6 },
        sign: { x: 17, y: 25 },
    },
    {
        house: 4,
        poly: [
            [0, 50],
            [25, 25],
            [50, 50],
            [25, 75],
        ],
        text: { x0: 17, y0: 36, x1: 33, y1: 64 },
        sign: { x: 42, y: 50 },
    },
    {
        house: 5,
        poly: [
            [0, 50],
            [25, 75],
            [0, 100],
        ],
        text: { x0: 2.5, y0: 66.4, x1: 13.45, y1: 83.6 },
        sign: { x: 17, y: 75 },
    },
    {
        house: 6,
        poly: [
            [0, 100],
            [25, 75],
            [50, 100],
        ],
        text: { x0: 14.85, y0: 88, x1: 35.15, y1: 97.2 },
        sign: { x: 25, y: 83 },
    },
    {
        house: 7,
        poly: [
            [50, 100],
            [25, 75],
            [50, 50],
            [75, 75],
        ],
        text: { x0: 36, y0: 67, x1: 64, y1: 83 },
        sign: { x: 50, y: 58 },
    },
    {
        house: 8,
        poly: [
            [50, 100],
            [75, 75],
            [100, 100],
        ],
        text: { x0: 64.85, y0: 88, x1: 85.15, y1: 97.2 },
        sign: { x: 75, y: 83 },
    },
    {
        house: 9,
        poly: [
            [100, 100],
            [75, 75],
            [100, 50],
        ],
        text: { x0: 86.55, y0: 66.4, x1: 97.5, y1: 83.6 },
        sign: { x: 83, y: 75 },
    },
    {
        house: 10,
        poly: [
            [100, 50],
            [75, 75],
            [50, 50],
            [75, 25],
        ],
        text: { x0: 67, y0: 36, x1: 83, y1: 64 },
        sign: { x: 58, y: 50 },
    },
    {
        house: 11,
        poly: [
            [100, 50],
            [75, 25],
            [100, 0],
        ],
        text: { x0: 86.55, y0: 16.4, x1: 97.5, y1: 33.6 },
        sign: { x: 83, y: 25 },
    },
    {
        house: 12,
        poly: [
            [100, 0],
            [75, 25],
            [50, 0],
        ],
        text: { x0: 64.85, y0: 2.8, x1: 85.15, y1: 12 },
        sign: { x: 75, y: 17 },
    },
];

function polygonCentroid(poly: [number, number][]): { x: number; y: number } {
    const x = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const y = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return { x, y };
}

export const NORTH_HOUSE_POLYGONS: Record<number, [number, number][]> = Object.fromEntries(
    NORTH_HOUSES.map((h) => [h.house, h.poly]),
);

export const NORTH_PLANET_RECTS: Record<number, NorthTextRect> = Object.fromEntries(
    NORTH_HOUSES.map((h) => [h.house, h.text]),
);

export const NORTH_SIGN_POSITIONS: Record<number, { x: number; y: number }> = Object.fromEntries(
    NORTH_HOUSES.map((h) => [h.house, h.sign]),
);

/** House centroids (derived). */
export const NORTH_HOUSE_ANCHORS: Record<number, { x: number; y: number }> = Object.fromEntries(
    NORTH_HOUSES.map((h) => [h.house, polygonCentroid(h.poly)]),
);

/** @deprecated use NORTH_SIGN_POSITIONS */
export const NORTH_SIGN_LABEL_ANCHORS = NORTH_SIGN_POSITIONS;

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

/** 1-based sign number in house h. ascSign0 is 0-based (Aries = 0). */
export function northHouseSignNumber(ascSign0: number, house: number): number {
    return ((ascSign0 + house - 1) % 12) + 1;
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
    const fontSize =
        longest > 22 ? 2.35 : longest > 16 ? 2.55 : longest > 10 ? 2.85 : longest > 7 ? 3.15 : 3.45;
    return { lines: lines.slice(0, 2), fontSize };
}

/**
 * East Indian (Bengali) rashi chart.
 * Equal 3×3 grid. The centre cell is the title. Each corner cell is split
 * by a diagonal into two triangles, giving 12 fixed sign areas.
 * Aries is the top-middle cell. Signs then run Taurus, Gemini, … around the
 * square — the order classical texts call anti-clockwise (Taurus sits on the
 * upper right). Signs do not rotate with the lagna; the lagna is marked.
 */
export const EAST_VIEW_BOX = '-2 -2 104 104';

/** Grid lines. Three equal cells, inset so the stroke stays inside the viewBox. */
export const EAST_GRID = [2, 34.5, 67, 99.5] as const;

export type EastSignCell = {
    sign: number;
    poly: [number, number][];
    text: NorthTextRect;
    signLabel: { x: number; y: number };
    lagnaTick: { x1: number; y1: number; x2: number; y2: number };
};

const EAST_PAD = 1.55;
const EAST_TRI_W = 11.3;
const EAST_TRI_H = 17.05;

function eastTriText(ox: number, oy: number, sx: 1 | -1, sy: 1 | -1): NorthTextRect {
    const x0 = sx === 1 ? ox + EAST_PAD : ox - EAST_PAD - EAST_TRI_W;
    const y0 = sy === 1 ? oy + EAST_PAD : oy - EAST_PAD - EAST_TRI_H;
    return { x0, y0, x1: x0 + EAST_TRI_W, y1: y0 + EAST_TRI_H };
}

function eastQuadText(x0: number, y0: number, x1: number, y1: number): NorthTextRect {
    return { x0: x0 + 3.2, y0: y0 + 7.2, x1: x1 - 3.2, y1: y1 - 3.2 };
}

const [e0, e1, e2, e3] = EAST_GRID;

export const EAST_CENTER = { x: e1, y: e1, w: e2 - e1, h: e2 - e1 };

export const EAST_SIGNS: EastSignCell[] = [
    {
        sign: 0,
        poly: [
            [e1, e0],
            [e2, e0],
            [e2, e1],
            [e1, e1],
        ],
        text: eastQuadText(e1, e0, e2, e1),
        signLabel: { x: (e1 + e2) / 2, y: e0 + 4.6 },
        lagnaTick: { x1: e1, y1: e0 + 6.2, x2: e1 + 6.2, y2: e0 },
    },
    {
        sign: 1,
        poly: [
            [e2, e0],
            [e3, e0],
            [e2, e1],
        ],
        text: eastTriText(e2, e0, 1, 1),
        signLabel: { x: e2 + 16.8, y: e0 + 4.6 },
        lagnaTick: { x1: e3 - 5.5, y1: e0, x2: e3, y2: e0 + 5.5 },
    },
    {
        sign: 2,
        poly: [
            [e3, e0],
            [e3, e1],
            [e2, e1],
        ],
        text: eastTriText(e3, e1, -1, -1),
        signLabel: { x: e3 - 16.8, y: e1 - 4.6 },
        lagnaTick: { x1: e3, y1: e1 - 5.5, x2: e3 - 5.5, y2: e1 },
    },
    {
        sign: 3,
        poly: [
            [e2, e1],
            [e3, e1],
            [e3, e2],
            [e2, e2],
        ],
        text: eastQuadText(e2, e1, e3, e2),
        signLabel: { x: e3 - 4.4, y: (e1 + e2) / 2 },
        lagnaTick: { x1: e3, y1: e1 + 6.2, x2: e3 - 6.2, y2: e1 },
    },
    {
        sign: 4,
        poly: [
            [e2, e2],
            [e3, e2],
            [e3, e3],
        ],
        text: eastTriText(e3, e2, -1, 1),
        signLabel: { x: e3 - 16.8, y: e2 + 4.6 },
        lagnaTick: { x1: e3, y1: e2 + 5.5, x2: e3 - 5.5, y2: e2 },
    },
    {
        sign: 5,
        poly: [
            [e2, e2],
            [e3, e3],
            [e2, e3],
        ],
        text: eastTriText(e2, e3, 1, -1),
        signLabel: { x: e2 + 16.8, y: e3 - 4.6 },
        lagnaTick: { x1: e2 + 5.5, y1: e3, x2: e2, y2: e3 - 5.5 },
    },
    {
        sign: 6,
        poly: [
            [e1, e2],
            [e2, e2],
            [e2, e3],
            [e1, e3],
        ],
        text: eastQuadText(e1, e2, e2, e3),
        signLabel: { x: (e1 + e2) / 2, y: e3 - 2.8 },
        lagnaTick: { x1: e2, y1: e3 - 6.2, x2: e2 - 6.2, y2: e3 },
    },
    {
        sign: 7,
        poly: [
            [e1, e2],
            [e1, e3],
            [e0, e3],
        ],
        text: eastTriText(e1, e3, -1, -1),
        signLabel: { x: e1 - 16.8, y: e3 - 4.6 },
        lagnaTick: { x1: e1 - 5.5, y1: e3, x2: e1, y2: e3 - 5.5 },
    },
    {
        sign: 8,
        poly: [
            [e0, e2],
            [e1, e2],
            [e0, e3],
        ],
        text: eastTriText(e0, e2, 1, 1),
        signLabel: { x: e0 + 16.8, y: e2 + 4.6 },
        lagnaTick: { x1: e0 + 5.5, y1: e2, x2: e0, y2: e2 + 5.5 },
    },
    {
        sign: 9,
        poly: [
            [e0, e1],
            [e1, e1],
            [e1, e2],
            [e0, e2],
        ],
        text: eastQuadText(e0, e1, e1, e2),
        signLabel: { x: e0 + 4.6, y: (e1 + e2) / 2 },
        lagnaTick: { x1: e0, y1: e2 - 6.2, x2: e0 + 6.2, y2: e2 },
    },
    {
        sign: 10,
        poly: [
            [e0, e1],
            [e1, e1],
            [e0, e0],
        ],
        text: eastTriText(e0, e1, 1, -1),
        signLabel: { x: e0 + 16.8, y: e1 - 4.6 },
        lagnaTick: { x1: e0, y1: e1 - 5.5, x2: e0 + 5.5, y2: e1 },
    },
    {
        sign: 11,
        poly: [
            [e0, e0],
            [e1, e0],
            [e1, e1],
        ],
        text: eastTriText(e1, e0, -1, 1),
        signLabel: { x: e1 - 16.8, y: e0 + 4.6 },
        lagnaTick: { x1: e1, y1: e0 + 5.5, x2: e1 - 5.5, y2: e0 },
    },
];

export const EAST_FRAME_PATH = [
    `M ${e0} ${e0} H ${e3} V ${e3} H ${e0} Z`,
    `M ${e1} ${e0} V ${e3}`,
    `M ${e2} ${e0} V ${e3}`,
    `M ${e0} ${e1} H ${e3}`,
    `M ${e0} ${e2} H ${e3}`,
    `M ${e3} ${e0} L ${e2} ${e1}`,
    `M ${e0} ${e0} L ${e1} ${e1}`,
    `M ${e2} ${e2} L ${e3} ${e3}`,
    `M ${e1} ${e2} L ${e0} ${e3}`,
].join(' ');
