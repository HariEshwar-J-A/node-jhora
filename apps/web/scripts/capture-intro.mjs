/**
 * Local intro frames (not CI).
 * Preview must already be on PREVIEW_URL (default http://127.0.0.1:4173/node-jhora/).
 *
 * Writes PNGs and a desktop webm under INTRO_OUT
 * (default /opt/cursor/artifacts/screenshots).
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/node-jhora/';
const OUT = process.env.INTRO_OUT ?? '/opt/cursor/artifacts/screenshots';

const MARKS = [
    { name: '0s', at: 0.02 },
    { name: '2s', at: 2 / 7.5 },
    { name: '4s', at: 4 / 7.5 },
    { name: '5_5s', at: 5.5 / 7.5 },
    { name: 'end', at: 1 },
];

async function waitIntro(page, min, timeout = 20000) {
    await page.waitForFunction(
        (threshold) => {
            const canvas = document.querySelector('.landing-sky-hero__canvas');
            if (!canvas) return false;
            const t = Number(canvas.dataset.intro);
            return Number.isFinite(t) && t >= threshold;
        },
        min,
        { timeout, polling: 50 },
    );
}

async function glInfo(page) {
    return page.evaluate(() => {
        const canvas = document.querySelector('.landing-sky-hero__canvas');
        const ctx = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
        if (!ctx) return null;
        const info = ctx.getExtension('WEBGL_debug_renderer_info');
        return info
            ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL)
            : ctx.getParameter(ctx.RENDERER);
    });
}

async function captureViewport(browser, vp) {
    const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
    });
    await context.addInitScript(() => {
        const samples = [];
        let last = 0;
        const orig = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) =>
            orig((t) => {
                const canvas = document.querySelector('.landing-sky-hero__canvas');
                const intro = canvas ? Number(canvas.dataset.intro) : -1;
                if (last && intro >= 0 && intro < 1) samples.push(t - last);
                last = t;
                cb(t);
            });
        window.__introFrames = samples;
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.landing-sky-hero__canvas');
    await page.evaluate((t) => {
        document.querySelector('.landing-sky-hero__canvas').dataset.hold = String(t);
    }, 0.02);
    await waitIntro(page, 0, 20000);
    for (const mark of MARKS) {
        await page.evaluate((t) => {
            document.querySelector('.landing-sky-hero__canvas').dataset.hold = String(t);
        }, mark.at);
        await page.waitForFunction(
            (t) => {
                const intro = Number(
                    document.querySelector('.landing-sky-hero__canvas')?.dataset.intro,
                );
                return Number.isFinite(intro) && (t >= 1 ? intro >= 1 : Math.abs(intro - t) < 0.03);
            },
            mark.at,
            { timeout: 10000 },
        );
        if (mark.name === 'end') await page.waitForTimeout(900);
        else await page.waitForTimeout(180);
        await page.screenshot({
            path: `${OUT}/intro-${mark.name}-${vp.name}.png`,
        });
        console.log(`captured intro-${mark.name}-${vp.name}.png`);
    }
    const fps = await page.evaluate(() => {
        const samples = window.__introFrames || [];
        const mid = samples.slice(8, -2);
        if (!mid.length) return { fps: 0, frames: samples.length };
        const avg = mid.reduce((a, b) => a + b, 0) / mid.length;
        return { fps: 1000 / avg, frames: mid.length, avgMs: avg };
    });
    console.log(`fps ${vp.name}`, JSON.stringify(fps), 'gl', await glInfo(page), 'errors', errors);
    await context.close();
}

async function recordFlight(browser) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitIntro(page, 1, 20000);
    await page.waitForTimeout(700);
    const video = page.video();
    await context.close();
    if (video) {
        const dest = `${OUT}/intro-flight-1280.webm`;
        await video.saveAs(dest);
        console.log('video', dest);
    }
}

const browser = await chromium.launch({ headless: true });
await mkdir(OUT, { recursive: true });
try {
    await captureViewport(browser, { name: '1280', width: 1280, height: 800 });
    await captureViewport(browser, { name: '390', width: 390, height: 844 });
    await recordFlight(browser);
} finally {
    await browser.close();
}
