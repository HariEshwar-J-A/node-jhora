/** Simplified IAU-inspired stick figures (hand-authored geometry, not GPL catalog data). */
export type ConstellationFigure = {
    name: string;
    /** Normalized 0–1 coordinates. The third value is a relative magnitude (1 = brightest). */
    segments: [number, number, number, number][];
    stars: [number, number, number][];
};

export const SKY_CONSTELLATIONS: ConstellationFigure[] = [
    {
        name: 'Orion',
        stars: [
            [0.52, 0.38, 0.96],
            [0.48, 0.42, 0.84],
            [0.56, 0.42, 0.8],
            [0.5, 0.48, 0.62],
            [0.54, 0.48, 0.58],
            [0.46, 0.55, 0.9],
            [0.58, 0.55, 0.74],
        ],
        segments: [
            [0.48, 0.42, 0.56, 0.42],
            [0.5, 0.48, 0.54, 0.48],
            [0.52, 0.38, 0.5, 0.48],
            [0.52, 0.38, 0.54, 0.48],
            [0.46, 0.55, 0.5, 0.48],
            [0.58, 0.55, 0.54, 0.48],
        ],
    },
    {
        name: 'Leo',
        stars: [
            [0.22, 0.28, 0.92],
            [0.28, 0.26, 0.7],
            [0.34, 0.3, 0.55],
            [0.38, 0.36, 0.48],
            [0.32, 0.42, 0.4],
            [0.24, 0.4, 0.36],
        ],
        segments: [
            [0.22, 0.28, 0.28, 0.26],
            [0.28, 0.26, 0.34, 0.3],
            [0.34, 0.3, 0.38, 0.36],
            [0.38, 0.36, 0.32, 0.42],
            [0.32, 0.42, 0.24, 0.4],
            [0.24, 0.4, 0.22, 0.28],
        ],
    },
    {
        name: 'Cancer',
        stars: [
            [0.72, 0.22, 0.46],
            [0.76, 0.26, 0.34],
            [0.74, 0.32, 0.3],
            [0.7, 0.3, 0.28],
            [0.68, 0.26, 0.4],
        ],
        segments: [
            [0.72, 0.22, 0.76, 0.26],
            [0.76, 0.26, 0.74, 0.32],
            [0.74, 0.32, 0.7, 0.3],
            [0.7, 0.3, 0.68, 0.26],
            [0.68, 0.26, 0.72, 0.22],
        ],
    },
];
