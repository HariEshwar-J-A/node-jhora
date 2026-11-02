import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { HERO_ASTRO_BG } from '../lib/hero-art';

/** Stylized thin-line constellation paths (Cancer crab + Leo lion silhouettes). */
const CONSTELLATION_PATHS = [
    'M 30 120 Q 45 95 70 105 T 95 130 Q 110 145 90 155 Q 70 165 55 150 Q 40 135 30 120',
    'M 55 150 L 45 175 M 70 158 L 68 182 M 85 152 L 92 178',
    'M 130 75 L 155 68 L 175 82 L 168 105 L 145 112 L 125 98 Z',
    'M 175 82 L 195 70 M 168 105 L 188 115 M 145 112 L 138 132',
    'M 155 68 L 162 52 M 175 82 L 192 78',
];

function useHeroAnimationPaused(rootRef: React.RefObject<HTMLDivElement | null>) {
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;

        const sync = () => {
            if (document.hidden) {
                setPaused(true);
                return;
            }
            const rect = el.getBoundingClientRect();
            setPaused(rect.bottom <= 0 || rect.top >= window.innerHeight);
        };

        const io = new IntersectionObserver(() => sync(), { threshold: 0.01 });
        io.observe(el);
        document.addEventListener('visibilitychange', sync);
        window.addEventListener('scroll', sync, { passive: true });
        sync();

        return () => {
            io.disconnect();
            document.removeEventListener('visibilitychange', sync);
            window.removeEventListener('scroll', sync);
        };
    }, [rootRef]);

    return paused;
}

export function AnimatedHeroBackground() {
    const rootRef = useRef<HTMLDivElement>(null);
    const artRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();
    const paused = useHeroAnimationPaused(rootRef);
    const staticMode = reduceMotion || paused;

    useEffect(() => {
        if (staticMode) return;
        const art = artRef.current;
        if (!art) return;

        let raf = 0;
        let t0 = performance.now();
        let mx = 0;
        let my = 0;
        let targetMx = 0;
        let targetMy = 0;
        const finePointer = window.matchMedia('(pointer: fine)').matches;

        const onMove = (e: MouseEvent) => {
            if (!finePointer) return;
            const nx = (e.clientX / window.innerWidth - 0.5) * 2;
            const ny = (e.clientY / window.innerHeight - 0.5) * 2;
            targetMx = nx * 14;
            targetMy = ny * 10;
        };
        window.addEventListener('mousemove', onMove, { passive: true });

        const tick = (now: number) => {
            const elapsed = (now - t0) / 1000;
            mx += (targetMx - mx) * 0.06;
            my += (targetMy - my) * 0.06;
            const driftX = Math.sin(elapsed * 0.12) * 12 + mx;
            const driftY = Math.cos(elapsed * 0.09) * 8 + my;
            const scale = 1.06 + Math.sin(elapsed * 0.05) * 0.025;
            art.style.transform = `translate3d(${driftX}px, ${driftY}px, 0) scale(${scale})`;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('mousemove', onMove);
        };
    }, [staticMode]);

    const starLayerStyle: CSSProperties | undefined = staticMode
        ? undefined
        : { animationPlayState: paused ? 'paused' : 'running' };

    return (
        <div
            className="hero-bg"
            ref={rootRef}
            aria-hidden="true"
            data-animate={staticMode ? 'off' : 'on'}
        >
            <div className="hero-bg__art-wrap">
                <div
                    ref={artRef}
                    className="hero-bg__image"
                    style={{ backgroundImage: `url(${HERO_ASTRO_BG})` }}
                />
            </div>

            <svg className="hero-bg__constellations" viewBox="0 0 220 200">
                {CONSTELLATION_PATHS.map((d, i) => (
                    <path
                        key={i}
                        d={d}
                        className="hero-bg__constellation-line"
                        style={{
                            animationDelay: `${i * 0.35}s`,
                            animationPlayState: staticMode ? 'paused' : undefined,
                        }}
                    />
                ))}
                {[
                    [45, 108],
                    [72, 125],
                    [148, 88],
                    [165, 102],
                    [182, 72],
                ].map(([cx, cy], i) => (
                    <circle
                        key={i}
                        className="hero-bg__star-node"
                        cx={cx}
                        cy={cy}
                        r={1.2}
                        style={{ animationDelay: `${i * 0.4}s` }}
                    />
                ))}
            </svg>

            <svg
                className={`hero-bg__wheel${staticMode ? ' hero-bg__wheel--static' : ''}`}
                viewBox="0 0 200 200"
            >
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

            <div className="hero-bg__stars" style={starLayerStyle}>
                {Array.from({ length: 24 }, (_, i) => (
                    <span
                        key={i}
                        className="hero-bg__twinkle"
                        style={{
                            left: `${(i * 17 + 7) % 100}%`,
                            top: `${(i * 23 + 11) % 100}%`,
                            animationDelay: `${(i % 7) * 0.55}s`,
                            animationDuration: `${2.5 + (i % 5) * 0.4}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

/** Static fallback export for reduced-motion contexts. */
export { AnimatedHeroBackground as HeroBackground };
