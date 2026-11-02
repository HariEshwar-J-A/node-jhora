import { planetShortName } from './geometry.js';

export const CHART_INSET = 1.5;
export const CHART_PLANET_FONT_SIZE = 2.4;
export const CHART_PLANET_FONT_MIN = 1.9;
export const CHART_LINE_HEIGHT = 3.2;
export const CHART_SIGN_FONT_SIZE = 4.5;
export const CHART_SIGN_FONT_SIZE_COMPACT = 3.8;

export type TextRect = { x0: number; y0: number; x1: number; y1: number };

/** Planet text area inside each North house (0–100), inset 1.5 from spec rectangles. */
export const NORTH_PLANET_RECTS: Record<number, TextRect> = {
    1: { x0: 39, y0: 14, x1: 61, y1: 35.5 },
    2: { x0: 14, y0: 2, x1: 36, y1: 11 },
    3: { x0: 2, y0: 14, x1: 11, y1: 36 },
    4: { x0: 14, y0: 64, x1: 36, y1: 86 },
    5: { x0: 2, y0: 64, x1: 11, y1: 86 },
    6: { x0: 14, y0: 89, x1: 36, y1: 98 },
    7: { x0: 39, y0: 64.5, x1: 61, y1: 86 },
    8: { x0: 64, y0: 89, x1: 86, y1: 98 },
    9: { x0: 89, y0: 64, x1: 98, y1: 86 },
    10: { x0: 64, y0: 14, x1: 86, y1: 35.5 },
    11: { x0: 89, y0: 14, x1: 98, y1: 36 },
    12: { x0: 64, y0: 2, x1: 86, y1: 11 },
};

/** Sign digit outside the planet rectangle, near inner vertex toward chart centre. */
export const NORTH_SIGN_POSITIONS: Record<number, { x: number; y: number }> = {
    1: { x: 50, y: 45 },
    2: { x: 25, y: 20 },
    3: { x: 20, y: 25 },
    4: { x: 25, y: 55 },
    5: { x: 20, y: 75 },
    6: { x: 25, y: 80 },
    7: { x: 50, y: 55 },
    8: { x: 75, y: 80 },
    9: { x: 80, y: 75 },
    10: { x: 88, y: 11 },
    11: { x: 80, y: 25 },
    12: { x: 75, y: 20 },
};

export type PlacedLabel = {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    textAnchor: 'middle' | 'start' | 'end';
};

export type LabelBox = { x0: number; y0: number; x1: number; y1: number };

export function estimateTextWidth(text: string, fontSize: number): number {
    let w = 0;
    for (const ch of text) {
        if (ch === ' ') w += fontSize * 0.28;
        else if (ch === '°') w += fontSize * 0.42;
        else if (ch === 'R') w += fontSize * 0.48;
        else w += fontSize * 0.62;
    }
    return w;
}

export function estimateTextHeight(fontSize: number): number {
    return fontSize * 1.12;
}

export function labelBox(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    anchor: 'middle' | 'start' | 'end',
): LabelBox {
    const w = estimateTextWidth(text, fontSize);
    const h = estimateTextHeight(fontSize);
    let x0: number;
    if (anchor === 'middle') x0 = x - w / 2;
    else if (anchor === 'end') x0 = x - w;
    else x0 = x;
    return { x0, y0: y - h * 0.78, x1: x0 + w, y1: y + h * 0.22 };
}

export function boxesOverlap(a: LabelBox, b: LabelBox, gap = 0.35): boolean {
    return !(a.x1 + gap < b.x0 || b.x1 + gap < a.x0 || a.y1 + gap < b.y0 || b.y1 + gap < a.y0);
}

export function boxInsideRect(box: LabelBox, rect: TextRect, pad = 0.05): boolean {
    return (
        box.x0 >= rect.x0 + pad &&
        box.x1 <= rect.x1 - pad &&
        box.y0 >= rect.y0 + pad &&
        box.y1 <= rect.y1 - pad
    );
}

export function signLabelBox(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    anchor: 'middle' | 'start' = 'middle',
): LabelBox {
    return labelBox(x, y, text, fontSize, anchor);
}

function maxRowWidth(items: { text: string }[], cols: number, fontSize: number): number {
    const rows = Math.ceil(items.length / cols);
    let max = 0;
    for (let row = 0; row < rows; row++) {
        let w = 0;
        for (let col = 0; col < cols; col++) {
            const i = row * cols + col;
            if (i >= items.length) break;
            w += estimateTextWidth(items[i]!.text, fontSize);
            if (col < cols - 1) w += fontSize * 0.5;
        }
        max = Math.max(max, w);
    }
    return max;
}

/**
 * Deterministic planet rows inside a fixed rectangle: 1 column, 2 when height overflows;
 * font 2.4 down to 1.9 only when 2 columns still overflow.
 */
export function layoutLabelsInRect(
    rect: TextRect,
    items: { id: string; text: string }[],
): PlacedLabel[] {
    if (items.length === 0) return [];
    const rectW = rect.x1 - rect.x0;
    const rectH = rect.y1 - rect.y0;
    const cx = (rect.x0 + rect.x1) / 2;

    for (let fs = CHART_PLANET_FONT_SIZE; fs >= CHART_PLANET_FONT_MIN - 0.001; fs -= 0.05) {
        const colOrder = items.length >= 3 ? [2, 1] : [1, 2];
        for (const cols of colOrder) {
            const rows = Math.ceil(items.length / cols);
            const rowSpan = (rows - 1) * CHART_LINE_HEIGHT;
            if (rowSpan + fs * 0.92 > rectH + 0.05) continue;
            if (cols === 2) {
                /* two columns pinned to rect edges, text grows inward */
            } else {
                const maxW = maxRowWidth(items, cols, fs);
                if (maxW > rectW + 0.5) continue;
            }

            const cy = (rect.y0 + rect.y1) / 2;
            const blockH = (rows - 1) * CHART_LINE_HEIGHT;
            const startY =
                rectH < 12
                    ? rect.y0 + fs * 0.82
                    : cy - blockH / 2;
            if (startY + blockH + fs * 0.28 > rect.y1 - 0.05) continue;
            const colAnchors: { x: number; anchor: 'middle' | 'start' | 'end' }[] =
                cols === 1
                    ? [{ x: cx, anchor: 'middle' }]
                    : [
                          { x: rect.x0 + 0.35, anchor: 'start' },
                          { x: rect.x1 - 0.35, anchor: 'end' },
                      ];
            const placed: PlacedLabel[] = [];
            const boxes: LabelBox[] = [];
            let ok = true;

            for (let i = 0; i < items.length; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const { x, anchor } = colAnchors[col]!;
                const y = startY + row * CHART_LINE_HEIGHT;
                const item = items[i]!;
                const box = labelBox(x, y, item.text, fs, anchor);
                if (
                    !boxInsideRect(box, rect) ||
                    boxes.some((b) => boxesOverlap(box, b))
                ) {
                    ok = false;
                    break;
                }
                boxes.push(box);
                placed.push({
                    id: item.id,
                    text: item.text,
                    x,
                    y,
                    fontSize: fs,
                    textAnchor: anchor,
                });
            }
            if (ok) return placed;
        }
    }

    const fs = CHART_PLANET_FONT_MIN;
    const cy = (rect.y0 + rect.y1) / 2;
    const cols = 2;
    const rows = Math.ceil(items.length / cols);
    const startY = cy - ((rows - 1) * CHART_LINE_HEIGHT) / 2;
    const colStep = Math.min(rectW * 0.48, 14);
    return items.map((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const anchor = col === 0 ? ('start' as const) : ('end' as const);
        const x = col === 0 ? rect.x0 + 0.35 : rect.x1 - 0.35;
        const y = startY + row * CHART_LINE_HEIGHT;
        return {
            id: item.id,
            text: item.text,
            x,
            y,
            fontSize: fs,
            textAnchor: anchor,
        };
    });
}

export function layoutNorthHousePlanets(
    house: number,
    planetLines: { id: string; text: string }[],
): PlacedLabel[] {
    return layoutLabelsInRect(NORTH_PLANET_RECTS[house]!, planetLines);
}

export function southPlanetTextRect(cell: { x: number; y: number; size: number }): TextRect {
    const { x, y, size } = cell;
    const signStrip = 7;
    return {
        x0: x + CHART_INSET,
        y0: y + CHART_INSET + signStrip,
        x1: x + size - CHART_INSET,
        y1: y + size - CHART_INSET,
    };
}

export function southSignPosition(cell: { x: number; y: number; size: number }): {
    x: number;
    y: number;
} {
    return { x: cell.x + 3.5, y: cell.y + 5.5 };
}

export function formatPlanetLabel(name: string, degree: number, retrograde: boolean): string {
    const d = Math.floor(degree);
    const retro = retrograde ? ' R' : '';
    return `${planetShortName(name)} ${d}°${retro}`;
}
