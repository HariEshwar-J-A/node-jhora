import { pointInPolygon } from './geometry.js';

export const CHART_LABEL_PADDING = 2;

/** Planet label size in SVG user units (~11 CSS px at 520px chart width, viewBox 110 wide). */
export const CHART_PLANET_FONT_SIZE = 2.33;
export const CHART_PLANET_FONT_SIZE_COMPACT = 2.33;

export type LabelInput = {
    id: string;
    text: string;
    /** Shorter text if layout is tight (e.g. drop spaces / abbreviate). */
    compactText?: string;
    /** Symbol only — last resort when the house is crowded. */
    symbolText?: string;
};

export type PlacedLabel = {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    textAnchor: 'middle' | 'start';
};

export type ReservedBox = {
    x: number;
    y: number;
    w: number;
    h: number;
    anchor: 'middle' | 'start';
};

/** Estimate SVG sans text width in user units (viewBox space). */
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

function distToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function pointInsideWithPadding(
    x: number,
    y: number,
    poly: [number, number][],
    padding: number,
): boolean {
    if (!pointInPolygon(x, y, poly)) return false;
    for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i]!;
        const [x2, y2] = poly[(i + 1) % poly.length]!;
        if (distToSegment(x, y, x1, y1, x2, y2) < padding) return false;
    }
    return true;
}

function labelBox(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    anchor: 'middle' | 'start',
): { x0: number; y0: number; x1: number; y1: number } {
    const w = estimateTextWidth(text, fontSize);
    const h = estimateTextHeight(fontSize);
    const x0 = anchor === 'middle' ? x - w / 2 : x;
    return { x0, y0: y - h * 0.78, x1: x0 + w, y1: y + h * 0.22 };
}

function boxCorners(box: { x0: number; y0: number; x1: number; y1: number }): [number, number][] {
    return [
        [box.x0, box.y0],
        [box.x1, box.y0],
        [box.x1, box.y1],
        [box.x0, box.y1],
    ];
}

function boxesOverlap(
    a: ReturnType<typeof labelBox>,
    b: ReturnType<typeof labelBox>,
    gap = 0.55,
): boolean {
    return !(a.x1 + gap < b.x0 || b.x1 + gap < a.x0 || a.y1 + gap < b.y0 || b.y1 + gap < a.y0);
}

function reservedOverlaps(box: ReturnType<typeof labelBox>, reserved: ReservedBox[]): boolean {
    for (const r of reserved) {
        const rb = labelBox(r.x, r.y, '0'.repeat(Math.max(1, Math.ceil(r.w))), r.h, r.anchor);
        rb.x0 = r.anchor === 'middle' ? r.x - r.w / 2 : r.x;
        rb.x1 = rb.x0 + r.w;
        rb.y0 = r.y - r.h * 0.78;
        rb.y1 = r.y + r.h * 0.22;
        if (boxesOverlap(box, rb, 0.25)) return true;
    }
    return false;
}

function boxFitsPoly(
    box: ReturnType<typeof labelBox>,
    poly: [number, number][],
    padding: number,
): boolean {
    return boxCorners(box).every(([x, y]) => pointInsideWithPadding(x, y, poly, padding));
}

function polygonCentroid(poly: [number, number][]): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const p of poly) {
        x += p[0];
        y += p[1];
    }
    return { x: x / poly.length, y: y / poly.length };
}

type TextTier = 'full' | 'compact' | 'symbol';

function textForLabel(label: LabelInput, tier: TextTier): string {
    if (tier === 'symbol' && label.symbolText) return label.symbolText;
    if (tier === 'compact' && label.compactText) return label.compactText;
    if (tier === 'symbol') return label.compactText ?? label.text.slice(0, 2);
    return label.text;
}

function tryPlaceGrid(
    poly: [number, number][],
    centroid: { x: number; y: number },
    labels: LabelInput[],
    tier: TextTier,
    fs: number,
    textAnchor: 'middle' | 'start',
    padding: number,
    reserved: ReservedBox[],
): PlacedLabel[] | null {
    const colOptions =
        labels.length >= 6 ? [3, 2, 1] : labels.length >= 3 ? [2, 1] : [1, 2];
    for (const cols of colOptions) {
        const rows = Math.ceil(labels.length / cols);
        const rowStep = fs * 1.38;
        const colStep = fs * (cols >= 3 ? 2.65 : 3.15);
        for (let pull = 0; pull <= 0.35; pull += 0.05) {
            const cx = centroid.x + (50 - centroid.x) * pull * 0.15;
            const cy = centroid.y + (50 - centroid.y) * pull * 0.15;
            const placed: PlacedLabel[] = [];
            const boxes: ReturnType<typeof labelBox>[] = [];
            let ok = true;
            for (let i = 0; i < labels.length; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const xOff = cols === 1 ? 0 : (col - (cols - 1) / 2) * colStep;
                const blockH = (rows - 1) * rowStep;
                const x = cx + xOff;
                const y = cy - blockH / 2 + row * rowStep;
                const label = labels[i]!;
                const text = textForLabel(label, tier);
                const box = labelBox(x, y, text, fs, textAnchor);
                if (
                    !boxFitsPoly(box, poly, padding) ||
                    reservedOverlaps(box, reserved) ||
                    boxes.some((b) => boxesOverlap(box, b, 0.75))
                ) {
                    ok = false;
                    break;
                }
                boxes.push(box);
                placed.push({ id: label.id, text, x, y, fontSize: fs, textAnchor });
            }
            if (ok) return placed;
        }
    }
    return null;
}

/**
 * Place labels inside a house/cell polygon at a fixed font size; crowded houses use a 2-column grid
 * centered on the polygon centroid, then shorter strings, then symbol-only as a last resort.
 */
export function fitLabels(
    poly: [number, number][],
    anchor: { x: number; y: number },
    labels: LabelInput[],
    options?: {
        padding?: number;
        reserved?: ReservedBox[];
        maxFontSize?: number;
        minFontSize?: number;
        textAnchor?: 'middle' | 'start';
    },
): PlacedLabel[] {
    if (labels.length === 0) return [];
    const padding = options?.padding ?? CHART_LABEL_PADDING;
    const reserved = options?.reserved ?? [];
    const textAnchor = options?.textAnchor ?? 'middle';
    const fs = options?.maxFontSize ?? CHART_PLANET_FONT_SIZE;
    const centroid = polygonCentroid(poly);
    const blend = { x: anchor.x * 0.35 + centroid.x * 0.65, y: anchor.y * 0.35 + centroid.y * 0.65 };

    const tiers: TextTier[] = ['full', 'compact', 'symbol'];
    for (const tier of tiers) {
        const placed = tryPlaceGrid(poly, blend, labels, tier, fs, textAnchor, padding, reserved);
        if (placed) return placed;
    }

    // Last resort: fixed font, single column at centroid, nudge until boxes fit
    const placed: PlacedLabel[] = [];
    const boxes: ReturnType<typeof labelBox>[] = [];
    const rowStep = fs * 1.32;
    let y = blend.y - ((labels.length - 1) * rowStep) / 2;
    for (const label of labels) {
        const text = textForLabel(label, 'symbol');
        let x = blend.x;
        let box = labelBox(x, y, text, fs, textAnchor);
        let tries = 0;
        while (
            tries < 12 &&
            (!boxFitsPoly(box, poly, padding) ||
                reservedOverlaps(box, reserved) ||
                boxes.some((b) => boxesOverlap(box, b, 0.45)))
        ) {
            x += tries % 2 === 0 ? 0.6 : -0.6;
            y += 0.4;
            box = labelBox(x, y, text, fs, textAnchor);
            tries++;
        }
        boxes.push(box);
        placed.push({ id: label.id, text, x, y, fontSize: fs, textAnchor });
        y += rowStep;
    }
    return placed;
}

/** Inset a sign digit toward the polygon centroid until the label box clears edges. */
export function fitSignLabel(
    poly: [number, number][],
    preferred: { x: number; y: number },
    text: string,
    fontSize = 4.5,
): { x: number; y: number; fontSize: number } {
    let cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    let cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    for (let t = 0; t <= 1.001; t += 0.05) {
        const x = preferred.x + (cx - preferred.x) * t * 0.55;
        const y = preferred.y + (cy - preferred.y) * t * 0.55;
        const box = labelBox(x, y, text, fontSize, 'middle');
        if (boxFitsPoly(box, poly, CHART_LABEL_PADDING)) {
            return { x, y, fontSize };
        }
    }
    return { x: preferred.x, y: preferred.y, fontSize };
}

/** Top-left style sign digit inside a rectangular cell. */
export function fitCornerLabel(
    poly: [number, number][],
    x: number,
    y: number,
    text: string,
    fontSize = 4.2,
): { x: number; y: number; fontSize: number } {
    const padding = CHART_LABEL_PADDING;
    for (let fs = fontSize; fs >= 3.2; fs -= 0.2) {
        for (let oy = 0; oy <= 5; oy += 0.45) {
            for (let ox = 0; ox <= 3.5; ox += 0.45) {
                const box = labelBox(x + ox, y + oy, text, fs, 'start');
                if (boxFitsPoly(box, poly, padding)) {
                    return { x: x + ox, y: y + oy, fontSize: fs };
                }
            }
        }
    }
    return { x, y, fontSize };
}

export function rectCellPolygon(x: number, y: number, size: number): [number, number][] {
    return [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
    ];
}
