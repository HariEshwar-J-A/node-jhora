import { pointInPolygon } from './geometry.js';

export const CHART_LABEL_PADDING = 2;

export type LabelInput = {
    id: string;
    text: string;
    /** Shorter text if layout is tight (e.g. drop spaces / abbreviate). */
    compactText?: string;
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

/**
 * Place labels inside a house/cell polygon without overlapping each other, reserved zones, or edges.
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
    let maxFs = options?.maxFontSize ?? 3.6;
    const minFs = options?.minFontSize ?? 1.85;

    for (let fs = maxFs; fs >= minFs; fs -= 0.08) {
        for (const cols of [1, 2, 3]) {
            const rows = Math.ceil(labels.length / cols);
            const rowStep = fs * 1.42;
            const colStep = Math.max(fs * 2.05, 7.5);
            for (let pull = 0; pull <= 0.22; pull += 0.04) {
                const cx = anchor.x + (50 - anchor.x) * pull;
                const cy = anchor.y + (50 - anchor.y) * pull;
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
                    const text =
                        fs <= minFs + 0.1 && label.compactText ? label.compactText : label.text;
                    const box = labelBox(x, y, text, fs, textAnchor);
                    if (
                        !boxFitsPoly(box, poly, padding) ||
                        reservedOverlaps(box, reserved) ||
                        boxes.some((b) => boxesOverlap(box, b, 0.65))
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
    }

    // Last resort: single column, minimum font, compact strings — still avoid overlaps
    const fs = minFs;
    const rowStep = fs * 1.35;
    const cx = anchor.x + (50 - anchor.x) * 0.18;
    const cy = anchor.y + (50 - anchor.y) * 0.18;
    const placed: PlacedLabel[] = [];
    const boxes: ReturnType<typeof labelBox>[] = [];
    let y = cy - ((labels.length - 1) * rowStep) / 2;
    for (const label of labels) {
        const text = label.compactText ?? label.text;
        let x = cx;
        let box = labelBox(x, y, text, fs, textAnchor);
        let tries = 0;
        while (
            tries < 8 &&
            (!boxFitsPoly(box, poly, padding) ||
                reservedOverlaps(box, reserved) ||
                boxes.some((b) => boxesOverlap(box, b, 0.5)))
        ) {
            x += textAnchor === 'middle' ? 0 : 0.8;
            y += 0.35;
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
