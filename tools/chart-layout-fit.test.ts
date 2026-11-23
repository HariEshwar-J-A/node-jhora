import {
    boxesOverlap,
    boxInsideRect,
    CHART_PLANET_FONT_SIZE,
    CHART_SIGN_FONT_SIZE,
    labelBox,
    layoutLabelsInRect,
    signLabelBox,
    southPlanetTextRect,
} from '../apps/web/src/components/chart/chartLayout.ts';
import {
    EAST_GRID,
    EAST_SIGNS,
    NORTH_HOUSES,
    northHouseSignNumber,
    pointInPolygon,
    southCellRect,
    wholeSignHouse,
} from '../apps/web/src/components/chart/geometry.ts';

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

    it('keeps every text-rectangle corner inside its polygon and 2 units from every edge', () => {
        for (const house of NORTH_HOUSES) {
            const { x0, y0, x1, y1 } = house.text;
            const cx = (x0 + x1) / 2;
            const cy = (y0 + y1) / 2;
            let ax = 0;
            let ay = 0;
            for (const [px, py] of house.poly) {
                ax += px;
                ay += py;
            }
            ax /= house.poly.length;
            ay /= house.poly.length;
            expect(Math.hypot(cx - ax, cy - ay)).toBeLessThan(1.5);
            for (const [x, y] of [
                [x0, y0],
                [x1, y0],
                [x1, y1],
                [x0, y1],
            ] as [number, number][]) {
                expect(pointInPolygon(x, y, house.poly)).toBe(true);
                expect(minEdgeDistance(x, y, house.poly)).toBeGreaterThanOrEqual(2);
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

    it('places 1, 2 and 4 planet labels inside the text rectangle at the primary size', () => {
        const samples = [1, 2, 4];
        for (const house of NORTH_HOUSES) {
            for (const count of samples) {
                const items = Array.from({ length: count }, (_, i) => ({
                    id: `${house.house}-${i}`,
                    text: count === 4 ? `Ma ${20 + i}°` : `P${i} ${i + 1}°`,
                }));
                const placed = layoutLabelsInRect(house.text, items);
                expect(placed).toHaveLength(count);
                const boxes = placed.map((p) =>
                    labelBox(p.x, p.y, p.text, p.fontSize, p.textAnchor),
                );
                const sign = signLabelBox(house.sign.x, house.sign.y, '12', CHART_SIGN_FONT_SIZE);
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

    it('centres the South planet block on the cell', () => {
        const cell = southCellRect(0, 0);
        const rect = southPlanetTextRect(cell);
        const cellCx = cell.x + cell.size / 2;
        const cellCy = cell.y + cell.size / 2;
        expect((rect.x0 + rect.x1) / 2).toBeCloseTo(cellCx, 5);
        expect((rect.y0 + rect.y1) / 2).toBeCloseTo(cellCy, 5);
        expect(rect.x0 - cell.x).toBeGreaterThanOrEqual(2);
        expect(cell.x + cell.size - rect.x1).toBeGreaterThanOrEqual(2);
        const placed = layoutLabelsInRect(
            rect,
            [0, 1, 2, 3].map((i) => ({ id: String(i), text: `Ma ${20 + i}°` })),
        );
        expect(placed.every((p) => p.fontSize === CHART_PLANET_FONT_SIZE)).toBe(true);
        const ys = placed.map((p) => p.y);
        const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
        expect(Math.abs(mid - cellCy)).toBeLessThan(1.5);
    });
});

describe('East Indian sign chart', () => {
    it('places Aries in the top-middle cell and the other signs counter-clockwise', () => {
        expect(EAST_SIGNS.map((cell) => cell.sign)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        const aries = EAST_SIGNS[0]!;
        const taurus = EAST_SIGNS[1]!;
        const pisces = EAST_SIGNS[11]!;
        const ariesCx = aries.poly.reduce((s, p) => s + p[0], 0) / aries.poly.length;
        const ariesCy = aries.poly.reduce((s, p) => s + p[1], 0) / aries.poly.length;
        expect(ariesCx).toBeGreaterThan(40);
        expect(ariesCx).toBeLessThan(62);
        expect(ariesCy).toBeLessThan(30);
        const taurusCx = taurus.poly.reduce((s, p) => s + p[0], 0) / taurus.poly.length;
        const piscesCx = pisces.poly.reduce((s, p) => s + p[0], 0) / pisces.poly.length;
        expect(taurusCx).toBeLessThan(ariesCx);
        expect(piscesCx).toBeGreaterThan(ariesCx);
        const centroid = (sign: number) => {
            const cell = EAST_SIGNS[sign]!;
            const n = cell.poly.length;
            return {
                x: cell.poly.reduce((s, p) => s + p[0], 0) / n,
                y: cell.poly.reduce((s, p) => s + p[1], 0) / n,
            };
        };
        const c = (sign: number) => centroid(sign);
        expect(c(1).y).toBeLessThan(c(2).y);
        expect(c(1).x).toBeLessThan(40);
        expect(c(2).x).toBeLessThan(40);
        expect(c(3).x).toBeLessThan(30);
        expect(c(3).y).toBeGreaterThan(40);
        expect(c(3).y).toBeLessThan(62);
        expect(c(4).y).toBeLessThan(c(5).y);
        expect(c(4).x).toBeLessThan(40);
        expect(c(5).x).toBeLessThan(40);
        expect(c(6).y).toBeGreaterThan(70);
        expect(c(6).x).toBeGreaterThan(40);
        expect(c(6).x).toBeLessThan(62);
        expect(c(7).y).toBeGreaterThan(c(8).y);
        expect(c(7).x).toBeGreaterThan(70);
        expect(c(8).x).toBeGreaterThan(70);
        expect(c(9).x).toBeGreaterThan(70);
        expect(c(9).y).toBeGreaterThan(40);
        expect(c(9).y).toBeLessThan(62);
        expect(c(10).y).toBeGreaterThan(c(11).y);
        expect(c(10).x).toBeGreaterThan(70);
        expect(c(11).x).toBeGreaterThan(70);
        const [g0, g1, g2, g3] = EAST_GRID;
        const shares = (sign: number, x: number, y: number) =>
            EAST_SIGNS[sign]!.poly.some((p) => p[0] === x && p[1] === y);
        expect(shares(1, g0, g0) && shares(1, g1, g1)).toBe(true);
        expect(shares(2, g0, g0) && shares(2, g1, g1)).toBe(true);
        expect(shares(4, g0, g3) && shares(4, g1, g2)).toBe(true);
        expect(shares(5, g0, g3) && shares(5, g1, g2)).toBe(true);
        expect(shares(7, g3, g3) && shares(7, g2, g2)).toBe(true);
        expect(shares(8, g3, g3) && shares(8, g2, g2)).toBe(true);
        expect(shares(10, g3, g0) && shares(10, g2, g1)).toBe(true);
        expect(shares(11, g3, g0) && shares(11, g2, g1)).toBe(true);
        for (const cell of EAST_SIGNS) {
            expect(cell.poly.length === 3 || cell.poly.length === 4).toBe(true);
        }
        const triangles = EAST_SIGNS.filter((cell) => cell.poly.length === 3);
        expect(triangles).toHaveLength(8);
    });

    it('keeps sign numbers and up to four planet labels inside each sign, clear of the edges', () => {
        for (const cell of EAST_SIGNS) {
            expect(pointInPolygon(cell.signLabel.x, cell.signLabel.y, cell.poly)).toBe(true);
            expect(
                minEdgeDistance(cell.signLabel.x, cell.signLabel.y, cell.poly),
            ).toBeGreaterThanOrEqual(2.4);
            const sign = signLabelBox(
                cell.signLabel.x,
                cell.signLabel.y,
                '12',
                CHART_SIGN_FONT_SIZE,
            );
            for (const count of [1, 2, 4]) {
                const items = Array.from({ length: count }, (_, i) => ({
                    id: `${cell.sign}-${i}`,
                    text: `Ma ${20 + i}°`,
                }));
                const placed = layoutLabelsInRect(cell.text, items);
                expect(placed).toHaveLength(count);
                const boxes = placed.map((p) =>
                    labelBox(p.x, p.y, p.text, p.fontSize, p.textAnchor),
                );
                for (const p of placed) {
                    expect(p.text).toContain('°');
                    expect(p.fontSize).toBe(CHART_PLANET_FONT_SIZE);
                }
                for (let i = 0; i < boxes.length; i++) {
                    const box = boxes[i]!;
                    for (const [x, y] of [
                        [box.x0, box.y0],
                        [box.x1, box.y0],
                        [box.x1, box.y1],
                        [box.x0, box.y1],
                    ] as [number, number][]) {
                        expect({
                            sign: cell.sign,
                            count,
                            text: placed[i]!.text,
                            x,
                            y,
                            inside: pointInPolygon(x, y, cell.poly),
                        }).toEqual({
                            sign: cell.sign,
                            count,
                            text: placed[i]!.text,
                            x,
                            y,
                            inside: true,
                        });
                        expect(minEdgeDistance(x, y, cell.poly)).toBeGreaterThan(0.6);
                    }
                    expect(boxesOverlap(box, sign, 0.15)).toBe(false);
                    for (let j = i + 1; j < boxes.length; j++) {
                        expect(boxesOverlap(box, boxes[j]!, 0.1)).toBe(false);
                    }
                }
            }
        }
    });
});
