import {
    NORTH_FRAME_PATH,
    NORTH_HOUSE_ANCHORS,
    NORTH_HOUSE_POLYGONS,
    NORTH_OUTER_SQUARE_PATH,
    SOUTH_SIGN_CELLS,
    pointInPolygon,
    signLabel,
} from '../apps/web/src/components/chart/geometry.ts';

describe('South Indian sign grid', () => {
    const expected: { row: number; col: number; sign: number }[] = [
        { row: 0, col: 0, sign: 12 },
        { row: 0, col: 1, sign: 1 },
        { row: 0, col: 2, sign: 2 },
        { row: 0, col: 3, sign: 3 },
        { row: 1, col: 0, sign: 11 },
        { row: 1, col: 3, sign: 4 },
        { row: 2, col: 0, sign: 10 },
        { row: 2, col: 3, sign: 5 },
        { row: 3, col: 0, sign: 9 },
        { row: 3, col: 1, sign: 8 },
        { row: 3, col: 2, sign: 7 },
        { row: 3, col: 3, sign: 6 },
    ];

    it('maps fixed signs clockwise from top-left on the 4×4 rim', () => {
        expect(SOUTH_SIGN_CELLS).toHaveLength(12);
        for (const exp of expected) {
            const cell = SOUTH_SIGN_CELLS.find((c) => c.row === exp.row && c.col === exp.col);
            expect(cell).toBeDefined();
            expect(signLabel(cell!.sign)).toBe(String(exp.sign));
        }
    });
});

describe('North Indian geometry', () => {
    it('includes a closed outer square with all four edges', () => {
        expect(NORTH_OUTER_SQUARE_PATH).toContain('M 0 0 H 100 V 100 H 0 Z');
        expect(NORTH_FRAME_PATH).toContain(NORTH_OUTER_SQUARE_PATH);
        expect(NORTH_FRAME_PATH).toMatch(/M 0 0 L 100 100/);
        expect(NORTH_FRAME_PATH).toMatch(/M 100 0 L 0 100/);
        expect(NORTH_FRAME_PATH).toMatch(/M 50 0 L 100 50 L 50 100 L 0 50 Z/);
    });

    it('places each house anchor inside its polygon', () => {
        for (let house = 1; house <= 12; house++) {
            const { x, y } = NORTH_HOUSE_ANCHORS[house]!;
            const poly = NORTH_HOUSE_POLYGONS[house]!;
            expect(pointInPolygon(x, y, poly)).toBe(true);
        }
    });
});
