import { NORTH_PLANET_RECTS, type NorthTextRect, planetShortName } from './geometry.js';

export const CHART_INSET = 2;
/** 2.7 user units ≈ 13.5px on a 520px chart (viewBox width 104). */
export const CHART_PLANET_FONT_SIZE = 2.7;
/** Narrow charts (≤520px viewport). 2.8 × 373 / 104 ≈ 10.0px. */
export const CHART_NARROW_PLANET_FONT = 2.8;
/** Floor stays ≥ 12px at a 480px chart (2.6 × 480 / 104 = 12). */
export const CHART_PLANET_FONT_MIN = 2.6;
export const CHART_LINE_HEIGHT = 4;
/** ~11px on a 520px chart. Secondary to the planet labels. */
export const CHART_SIGN_FONT_SIZE = 2.2;
export const CHART_SIGN_FONT_SIZE_COMPACT = 1.8;
/** Abbreviations on a ≥240px thumbnail: 3.6 × 240 / 104 ≈ 8.3px. */
export const CHART_COMPACT_PLANET_FONT = 3.6;

export type TextRect = NorthTextRect;

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

function columnXs(rect: TextRect, cols: number): number[] {
    const width = rect.x1 - rect.x0;
    const slot = width / cols;
    return Array.from({ length: cols }, (_, col) => rect.x0 + slot * (col + 0.5));
}

/**
 * Rows top to bottom, centred in the rectangle.
 * 1 column, then 2, then 3. Font stays at the primary size unless there are 7 or
 * more labels, in which case it may drop to the floor. Degrees are never removed.
 */
export function layoutLabelsInRect(
    rect: TextRect,
    items: { id: string; text: string }[],
    options?: { fontSize?: number },
): PlacedLabel[] {
    if (items.length === 0) return [];
    const primary = options?.fontSize ?? CHART_PLANET_FONT_SIZE;
    const fonts =
        items.length >= 7 && options?.fontSize === undefined
            ? Array.from(
                  { length: 11 },
                  (_, i) => Math.round((CHART_PLANET_FONT_SIZE - i * 0.05) * 100) / 100,
              ).filter((fs) => fs >= CHART_PLANET_FONT_MIN - 0.001)
            : [primary];

    for (const fs of fonts) {
        for (const cols of [1, 2, 3]) {
            const rows = Math.ceil(items.length / cols);
            const xs = columnXs(rect, cols);
            const line = (fs / CHART_PLANET_FONT_SIZE) * CHART_LINE_HEIGHT;
            const block = (rows - 1) * line;
            const cy = (rect.y0 + rect.y1) / 2;
            const startY = cy - block / 2;
            const placed: PlacedLabel[] = [];
            const boxes: LabelBox[] = [];
            let ok = true;
            for (let i = 0; i < items.length; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = xs[col]!;
                const y = startY + row * line;
                const item = items[i]!;
                const box = labelBox(x, y, item.text, fs, 'middle');
                if (!boxInsideRect(box, rect, 0) || boxes.some((b) => boxesOverlap(box, b, 0.15))) {
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
                    textAnchor: 'middle',
                });
            }
            if (ok) return placed;
        }
    }

    const fs =
        options?.fontSize ?? (items.length >= 7 ? CHART_PLANET_FONT_MIN : CHART_PLANET_FONT_SIZE);
    const line = (fs / CHART_PLANET_FONT_SIZE) * CHART_LINE_HEIGHT;
    const cols = 3;
    const xs = columnXs(rect, cols);
    const startY = rect.y0 + fs * 0.85;
    return items.map((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
            id: item.id,
            text: item.text,
            x: xs[col]!,
            y: startY + row * line,
            fontSize: fs,
            textAnchor: 'middle' as const,
        };
    });
}

export function layoutNorthHousePlanets(
    house: number,
    planetLines: { id: string; text: string }[],
): PlacedLabel[] {
    return layoutLabelsInRect(NORTH_PLANET_RECTS[house]!, planetLines);
}

/** Full cell interior, inset equally, so the label block centres on the cell. */
export function southPlanetTextRect(cell: { x: number; y: number; size: number }): TextRect {
    const { x, y, size } = cell;
    return {
        x0: x + CHART_INSET,
        y0: y + CHART_INSET,
        x1: x + size - CHART_INSET,
        y1: y + size - CHART_INSET,
    };
}

/** Short diagonal across the top-left corner, about a quarter of the cell. */
export function southLagnaTick(cell: { x: number; y: number; size: number }): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
} {
    const span = cell.size * 0.25;
    return { x1: cell.x, y1: cell.y + span, x2: cell.x + span, y2: cell.y };
}

/** Sign number sits in the top-left corner, clear of the centred planet block. */
export function southSignPosition(
    cell: { x: number; y: number; size: number },
    lagna = false,
): {
    x: number;
    y: number;
} {
    if (lagna) {
        const span = cell.size * 0.25;
        return { x: cell.x + span + 0.7, y: cell.y + 3.2 };
    }
    return { x: cell.x + 1.8, y: cell.y + 3.4 };
}

export function formatPlanetLabel(
    name: string,
    degree: number,
    retrograde: boolean,
    compact = false,
): string {
    const retro = retrograde ? ' R' : '';
    if (compact) return `${planetShortName(name)}${retro}`;
    const d = Math.floor(degree);
    return `${planetShortName(name)} ${d}°${retro}`;
}
