/** Deterministic ink-star field for light-theme landing (viewBox 0–1). */

export type InkStar = {
    x: number;
    y: number;
    r: number;
    rot: number;
    delay: number;
};

function mulberry32(seed: number) {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function buildLightInkStars(count = 140, seed = 0x7a3c): InkStar[] {
    const rnd = mulberry32(seed);
    const stars: InkStar[] = [];
    for (let i = 0; i < count; i++) {
        stars.push({
            x: rnd(),
            y: rnd(),
            r: 0.0014 + rnd() * 0.0028,
            rot: rnd() * Math.PI,
            delay: rnd() * 4,
        });
    }
    return stars;
}

export const LIGHT_INK_STARS = buildLightInkStars();
