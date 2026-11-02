import { pointInPolygon } from '../apps/web/src/components/chart/geometry.ts';
import {
    NORTH_HOUSES,
    northHouseSignNumber,
    wholeSignHouse,
} from '../apps/web/src/components/chart/geometry.ts';
import {
    CHART_PLANET_FONT_SIZE,
    boxesOverlap,
    boxInsideRect,
    labelBox,
    layoutLabelsInRect,
    signLabelBox,
} from '../apps/web/src/components/chart/chartLayout.ts';

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

function minEdgeDistance(x: number, y: number, poly: [number, number][]): number {
    let min = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i]!;
        const [x2, y2] = poly[(i + 1) % poly.length]!;
        min = Math.min(min, distToSegment(x, y, x1, y1, x2, y2));
    }
    return min;
}

function pointInRect(
    x: number,
    y: number,
    rect: { x0: number; y0: number; x1: number; y1: number },
): boolean {
    return x > rect.x0 && x < rect.x1 && y > rect.y0 && y < rect.y1;
}

describe('North house table', () => {
    it('keeps every sign anchor inside its polygon, 3 units from every edge, outside the text rectangle', () => {
        for (const house of NORTH_HOUSES) {
            expect(pointInPolygon(house.sign.x, house.sign.y, house.poly)).toBe(true);
            expect(minEdgeDistance(house.sign.x, house.sign.y, house.poly)).toBeGreaterThanOrEqual(
                3,
            );
            expect(pointInRect(house.sign.x, house.sign.y, house.text)).toBe(false);
        }
    });

    it('keeps every text-rectangle corner inside its polygon', () => {
        for (const house of NORTH_HOUSES) {
            const { x0, y0, x1, y1 } = house.text;
            for (const [x, y] of [
                [x0, y0],
                [x1, y0],
                [x1, y1],
                [x0, y1],
            ] as [number, number][]) {
                expect(pointInPolygon(x, y, house.poly)).toBe(true);
            }
        }
    });

    it('maps the fictional Pisces-ascendant chart into the stated houses', () => {
        const asc = 11; // Pisces
        const expectHouse: Record<string, number> = {
            Jupiter: 2,
            Saturn: 2,
            Rahu: 5,
            Moon: 8,
            Venus: 9,
            Mercury: 10,
            Sun: 10,
            Ketu: 11,
            Mars: 12,
        };
        const sign0: Record<string, number> = {
            Jupiter: 0,
            Saturn: 0,
            Rahu: 3,
            Moon: 6,
            Venus: 7,
            Mercury: 8,
            Sun: 8,
            Ketu: 9,
            Mars: 10,
        };
        for (const [name, house] of Object.entries(expectHouse)) {
            expect(wholeSignHouse(sign0[name]!, asc)).toBe(house);
        }
        expect(northHouseSignNumber(asc, 1)).toBe(12);
        expect(northHouseSignNumber(asc, 2)).toBe(1);
        expect(northHouseSignNumber(asc, 10)).toBe(9);
    });

    it('places 1, 2 and 4 planet labels inside the text rectangle without overlap at 2.4 units', () => {
        const samples = [1, 2, 4];
        for (const house of NORTH_HOUSES) {
            for (const count of samples) {
                const items = Array.from({ length: count }, (_, i) => ({
                    id: `${house.house}-${i}`,
                    text: `P${i} ${i + 1}°`,
                }));
                const placed = layoutLabelsInRect(house.text, items);
                expect(placed).toHaveLength(count);
                const boxes = placed.map((p) =>
                    labelBox(p.x, p.y, p.text, p.fontSize, p.textAnchor),
                );
                const sign = signLabelBox(house.sign.x, house.sign.y, '12', 4.5);
                for (const p of placed) {
                    expect(p.text).toContain('°');
                    expect(p.fontSize).toBe(CHART_PLANET_FONT_SIZE);
                }
                for (let i = 0; i < boxes.length; i++) {
                    expect(boxInsideRect(boxes[i]!, house.text, 0)).toBe(true);
                    expect(boxesOverlap(boxes[i]!, sign, 0.2)).toBe(false);
                    for (let j = i + 1; j < boxes.length; j++) {
                        expect(boxesOverlap(boxes[i]!, boxes[j]!, 0.1)).toBe(false);
                    }
                }
            }
        }
    });
});
