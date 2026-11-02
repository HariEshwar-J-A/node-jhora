import { planetShortName } from '../apps/web/src/components/chart/geometry.ts';
import {
    CHART_PLANET_FONT_SIZE,
    CHART_PLANET_FONT_MIN,
    CHART_SIGN_FONT_SIZE,
    boxesOverlap,
    boxInsideRect,
    labelBox,
    layoutLabelsInRect,
    NORTH_PLANET_RECTS,
    NORTH_SIGN_POSITIONS,
    signLabelBox,
    southPlanetTextRect,
    southSignPosition,
} from '../apps/web/src/components/chart/chartLayout.ts';
import { SOUTH_SIGN_CELLS, southCellRect } from '../apps/web/src/components/chart/geometry.ts';

const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];

function planetLines(count: number, retro = false): { id: string; text: string }[] {
    return bodies.slice(0, count).map((name, i) => ({
        id: name,
        text: `${planetShortName(name)} ${10 + i}°${retro ? ' R' : ''}`,
    }));
}

function assertLayout(
    placed: ReturnType<typeof layoutLabelsInRect>,
    rect: { x0: number; y0: number; x1: number; y1: number },
    signBox: ReturnType<typeof signLabelBox> | null,
    maxCount: number,
    expectFullSize = true,
) {
    expect(placed.length).toBe(maxCount);
    for (const p of placed) {
        expect(p.text).toContain('°');
        if (expectFullSize) {
            expect(p.fontSize).toBeGreaterThanOrEqual(CHART_PLANET_FONT_SIZE - 0.001);
        }
        expect(p.fontSize).toBeGreaterThanOrEqual(CHART_PLANET_FONT_MIN - 0.001);
    }
    const boxes = placed.map((p) => labelBox(p.x, p.y, p.text, p.fontSize, p.textAnchor));
    for (const box of boxes) {
        expect(boxInsideRect(box, rect)).toBe(true);
    }
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
        }
        if (signBox) {
            expect(boxesOverlap(boxes[i]!, signBox)).toBe(false);
        }
    }
}

describe('deterministic chart layout', () => {
    describe('North houses', () => {
        for (let house = 1; house <= 12; house++) {
            for (const count of [1, 4, 6]) {
                it(`house ${house} with ${count} planets`, () => {
                    const rect = NORTH_PLANET_RECTS[house]!;
                    const signPos = NORTH_SIGN_POSITIONS[house]!;
                    const signBox = signLabelBox(signPos.x, signPos.y, '9', CHART_SIGN_FONT_SIZE);
                    let items = planetLines(count);
                    if (house === 1 && count === 6) {
                        items = [{ id: '__asc__', text: 'Asc' }, ...items];
                    }
                    const placed = layoutLabelsInRect(rect, items);
                    const planetOnly = placed.filter((p) => p.id !== '__asc__');
                    const expectFullSize = count <= 6 && !(house === 1 && count === 6);
                    assertLayout(planetOnly, rect, signBox, count, expectFullSize);
                    if (house === 1) {
                        const asc = placed.find((p) => p.id === '__asc__');
                        expect(asc?.text).toBe('Asc');
                        expect(asc && boxInsideRect(labelBox(asc.x, asc.y, asc.text, asc.fontSize, 'middle'), rect)).toBe(true);
                        expect(asc && boxesOverlap(labelBox(asc.x, asc.y, asc.text, asc.fontSize, 'middle'), signBox)).toBe(false);
                    }
                });
            }
        }
    });

    describe('South cells', () => {
        for (const { row, col } of SOUTH_SIGN_CELLS) {
            for (const count of [1, 4, 6]) {
                it(`cell r${row}c${col} with ${count} planets`, () => {
                    const cell = southCellRect(row, col);
                    const rect = southPlanetTextRect(cell);
                    const signPos = southSignPosition(cell);
                    const signBox = signLabelBox(signPos.x, signPos.y, '12', CHART_SIGN_FONT_SIZE, 'start');
                    const placed = layoutLabelsInRect(rect, planetLines(count));
                    assertLayout(placed, rect, signBox, count);
                });
            }
        }
    });
});
