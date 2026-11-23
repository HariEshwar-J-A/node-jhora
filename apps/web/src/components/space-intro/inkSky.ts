/**
 * Light-theme hero sky. Canvas 2D, no three.js: a near-black field, white
 * stars, and a few streaks. The dark theme still uses the WebGL Earth intro.
 */

export type InkSkyHandle = {
    setParallax: (scrollY: number) => void;
    dispose: () => void;
};

type Star = { x: number; y: number; z: number; mag: number; phase: number };

function mulberry32(seed: number) {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function mountInkSky(
    canvas: HTMLCanvasElement,
    opts: { mobile: boolean; reducedMotion: boolean },
): InkSkyHandle {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
        canvas.dataset.intro = '1';
        return { setParallax() {}, dispose() {} };
    }
    canvas.dataset.intro = '1';

    const rnd = mulberry32(0x51a7);
    const count = opts.mobile ? 1100 : 1700;
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
        const roll = rnd();
        stars.push({
            x: rnd(),
            y: rnd(),
            z: rnd(),
            mag: roll > 0.992 ? 0.9 + rnd() * 0.1 : Math.pow(roll, 1.05) * 0.7,
            phase: rnd() * Math.PI * 2,
        });
    }

    let parallax = 0;
    let raf = 0;
    let running = true;
    const streaks: { x: number; y: number; life: number; speed: number }[] = [];

    const frame = (now: number) => {
        if (!running) return;
        const dpr = Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.25 : 1.5);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
            canvas.width = Math.max(1, Math.floor(w * dpr));
            canvas.height = Math.max(1, Math.floor(h * dpr));
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#060606';
        ctx.fillRect(0, 0, w, h);

        const drift = opts.reducedMotion ? 0 : now * 0.000008;
        const shift = Math.max(-1.4, Math.min(1.4, parallax * 0.00032));
        for (const star of stars) {
            const tw = opts.reducedMotion
                ? 1
                : 0.72 + 0.28 * Math.sin(now * 0.001 * (0.8 + star.mag * 2.2) + star.phase);
            const x = ((star.x + drift + shift * 0.02 + star.z * 0.01) % 1) * w;
            const y = ((star.y + shift * 0.01) % 1) * h;
            const radius = star.mag > 0.86 ? 1.35 : star.mag > 0.55 ? 0.9 : 0.55;
            ctx.globalAlpha = 0.35 + star.mag * 0.65 * tw;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (!opts.reducedMotion && streaks.length < 2 && rnd() < 0.004) {
            streaks.push({ x: rnd() * w, y: rnd() * h * 0.45, life: 1, speed: 7 + rnd() * 6 });
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        for (let i = streaks.length - 1; i >= 0; i--) {
            const s = streaks[i]!;
            s.life -= 0.012;
            s.x -= s.speed;
            s.y += s.speed * 0.35;
            if (s.life <= 0) {
                streaks.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = s.life;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x + 28, s.y - 10);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return {
        setParallax(scrollY: number) {
            parallax = scrollY;
        },
        dispose() {
            running = false;
            cancelAnimationFrame(raf);
        },
    };
}
