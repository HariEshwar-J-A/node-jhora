import {
    NORTH_HOUSE_ANCHORS,
    NORTH_HOUSE_POLYGONS,
    SOUTH_SIGN_CELLS,
    planetShortName,
    southCellRect,
} from '../apps/web/src/components/chart/geometry.ts';
import {
    CHART_LABEL_PADDING,
    estimateTextHeight,
    estimateTextWidth,
    fitCornerLabel,
    fitLabels,
    fitSignLabel,
    pointInsideWithPadding,
    rectCellPolygon,
} from '../apps/web/src/components/chart/layoutFit.ts';

function boxesOverlap(
    a: { x0: number; y0: number; x1: number; y1: number },
    b: { x0: number; y0: number; x1: number; y1: number },
): boolean {
    return !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0);
}

function placementBox(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    anchor: 'middle' | 'start',
) {
    const w = estimateTextWidth(text, fontSize);
    const h = estimateTextHeight(fontSize);
    const x0 = anchor === 'middle' ? x - w / 2 : x;
    return { x0, y0: y - h * 0.78, x1: x0 + w, y1: y + h * 0.22 };
}

describe('fitLabels', () => {
    const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];

    it('fits nine planets plus Asc reserved space in North house 1', () => {
        const poly = NORTH_HOUSE_POLYGONS[1]!;
        const anchor = NORTH_HOUSE_ANCHORS[1]!;
        const sign = fitSignLabel(poly, { x: 50, y: 14 }, '12', 4.5);
        const reserved = [
            {
                x: sign.x,
                y: sign.y,
                w: estimateTextWidth('12', sign.fontSize),
                h: estimateTextHeight(sign.fontSize),
                anchor: 'middle' as const,
            },
            {
                x: 50,
                y: 20,
                w: estimateTextWidth('Asc', 3),
                h: estimateTextHeight(3),
                anchor: 'middle' as const,
            },
        ];
        const labels = bodies.map((name, i) => ({
            id: name,
            text: `${planetShortName(name)} ${i}°`,
            compactText: `${planetShortName(name)}${i}°`,
        }));
        const placed = fitLabels(poly, anchor, labels, {
            reserved,
            maxFontSize: 3.55,
            minFontSize: 1.9,
        });
        expect(placed).toHaveLength(9);
        const boxes = placed.map((p) => placementBox(p.x, p.y, p.text, p.fontSize, p.textAnchor));
        for (let i = 0; i < boxes.length; i++) {
            for (const [x, y] of [
                [boxes[i]!.x0, boxes[i]!.y0],
                [boxes[i]!.x1, boxes[i]!.y0],
                [boxes[i]!.x1, boxes[i]!.y1],
                [boxes[i]!.x0, boxes[i]!.y1],
            ] as [number, number][]) {
                expect(pointInsideWithPadding(x, y, poly, CHART_LABEL_PADDING)).toBe(true);
            }
            for (let j = i + 1; j < boxes.length; j++) {
                expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
            }
        }
    });

    it('fits crowded labels in every North house with a synthetic nine-planet stack', () => {
        for (let house = 1; house <= 12; house++) {
            const poly = NORTH_HOUSE_POLYGONS[house]!;
            const anchor = NORTH_HOUSE_ANCHORS[house]!;
            const sign = fitSignLabel(poly, { x: anchor.x, y: anchor.y - 8 }, '9', 4.5);
            const reserved = [
                {
                    x: sign.x,
                    y: sign.y,
                    w: estimateTextWidth('9', sign.fontSize),
                    h: estimateTextHeight(sign.fontSize),
                    anchor: 'middle' as const,
                },
            ];
            const labels = bodies.map((name, i) => ({
                id: `${house}-${name}`,
                text: `${planetShortName(name)} ${20 + i}° R`,
                compactText: `${planetShortName(name)}${20 + i}°R`,
            }));
            const placed = fitLabels(poly, anchor, labels, {
                reserved,
                maxFontSize: 3.4,
                minFontSize: 1.85,
            });
            expect(placed.length).toBe(9);
        }
    });

    it('fits nine planets in every South sign cell', () => {
        for (const { row, col } of SOUTH_SIGN_CELLS) {
            const rect = southCellRect(row, col);
            const poly = rectCellPolygon(rect.x, rect.y, rect.size);
            const sign = fitCornerLabel(poly, rect.x + 3.5, rect.y + 5.5, '12', 4.2);
            const reserved = [
                {
                    x: sign.x,
                    y: sign.y,
                    w: estimateTextWidth('12', sign.fontSize),
                    h: estimateTextHeight(sign.fontSize),
                    anchor: 'start' as const,
                },
            ];
            const labels = bodies.map((name, i) => ({
                id: `${row}-${col}-${name}`,
                text: `${planetShortName(name)} ${i}°`,
                compactText: `${planetShortName(name)}${i}°`,
            }));
            const placed = fitLabels(
                poly,
                { x: rect.x + rect.size / 2, y: rect.y + rect.size * 0.58 },
                labels,
                { reserved, maxFontSize: 3.1, minFontSize: 1.75 },
            );
            expect(placed.length).toBe(9);
        }
    });
});
