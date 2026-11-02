import { HERO_ASTRO_BG } from '../lib/hero-art';

/** Monochrome celestial layer with optional owner art (grayscale, masked). */
export function HeroBackground() {
    return (
        <div className="hero-bg" aria-hidden="true">
            <div className="hero-bg__image" style={{ backgroundImage: `url(${HERO_ASTRO_BG})` }} />
            <svg className="hero-bg__wheel" viewBox="0 0 200 200">
                <circle
                    cx="100"
                    cy="100"
                    r="92"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                />
                {Array.from({ length: 12 }, (_, i) => {
                    const a = (i * Math.PI) / 6 - Math.PI / 2;
                    const x1 = 100 + Math.cos(a) * 48;
                    const y1 = 100 + Math.sin(a) * 48;
                    const x2 = 100 + Math.cos(a) * 92;
                    const y2 = 100 + Math.sin(a) * 92;
                    return (
                        <line
                            key={i}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="currentColor"
                            strokeWidth="0.35"
                        />
                    );
                })}
                <circle
                    cx="100"
                    cy="100"
                    r="48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.35"
                />
            </svg>
            <div className="hero-bg__stars" />
        </div>
    );
}
