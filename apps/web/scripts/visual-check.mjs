/**
 * Local visual regression harness (NOT run in CI).
 * Usage: pnpm --filter @node-jhora/web build && pnpm --filter @node-jhora/web preview --host 127.0.0.1 --port 4173
 *        node apps/web/scripts/visual-check.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/node-jhora/';
const OUT = join(process.cwd(), '../../njapp/visual-check');

const VIEWPORTS = [
    { name: '1280', width: 1280, height: 900 },
    { name: '390', width: 390, height: 844 },
];

const failures = [];

function fail(msg) {
    failures.push(msg);
    console.error('FAIL:', msg);
}

async function assertNoFilledConstellationPaths(page) {
    const bad = await page.evaluate(() => {
        const paths = Array.from(
            document.querySelectorAll('.hero-bg__constellation-line, .constellation-line'),
        );
        return paths
            .filter((p) => {
                const fill = window.getComputedStyle(p).fill;
                return fill && fill !== 'none' && !fill.includes('rgba(0, 0, 0, 0)');
            })
            .map((p) => p.getAttribute('d')?.slice(0, 40));
    });
    if (bad.length) fail(`Filled constellation paths: ${bad.join('; ')}`);
}

async function assertChartTextNoOverlap(page) {
    const overlaps = await page.evaluate(() => {
        const svg = document.querySelector('.chart-canvas__svg');
        if (!svg) return [];
        const texts = Array.from(svg.querySelectorAll('text.chart-planet')).filter((t) =>
            t.textContent?.trim(),
        );
        const boxes = texts.map((t) => {
            const b = t.getBoundingClientRect();
            return { t: t.textContent, b };
        });
        const hits = [];
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i].b;
                const b = boxes[j].b;
                const overlap =
                    a.left < b.right &&
                    b.left < a.right &&
                    a.top < b.bottom &&
                    b.top < a.bottom &&
                    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
                if (overlap) hits.push(`${boxes[i].t} × ${boxes[j].t}`);
            }
        }
        return hits;
    });
    if (overlaps.length) fail(`Overlapping chart labels: ${overlaps.slice(0, 6).join(' | ')}`);
}

async function assertNoTextClipped(page) {
    const clipped = await page.evaluate(() => {
        const wrap = document.querySelector('.grid-2--chart-table .data-table-wrap');
        const tableOverflow =
            wrap instanceof HTMLElement && wrap.scrollWidth > wrap.clientWidth + 2;
        const nodes = Array.from(
            document.querySelectorAll(
                'table.data td.col-nak, table.data th.col-nak, .hero h1, .hero p, .hero-actions .btn',
            ),
        );
        const cellClip = nodes
            .filter((el) => {
                const h = el instanceof HTMLElement ? el : null;
                if (!h) return false;
                return h.scrollWidth > h.clientWidth + 1;
            })
            .map((el) => `${el.tagName}.${el.className}:${(el.textContent ?? '').slice(0, 40)}`);
        return { tableOverflow, cellClip };
    });
    if (clipped.tableOverflow) fail('Planets table overflows its card horizontally');
    if (clipped.cellClip.length)
        fail(`Clipped text nodes: ${clipped.cellClip.slice(0, 8).join('; ')}`);
}

async function assertHeroVisible(page) {
    const ok = await page.evaluate(() => {
        const h1 = document.querySelector('.landing-sky-hero .hero h1');
        if (!h1) return 'missing h1';
        const r = h1.getBoundingClientRect();
        if (r.height < 8) return 'zero height h1';
        const style = window.getComputedStyle(h1);
        if (parseFloat(style.opacity) < 0.2) return 'h1 opacity low';
        if (style.visibility === 'hidden' || style.display === 'none') return 'h1 hidden';
        return null;
    });
    if (ok) fail(`Hero not visible: ${ok}`);
}

async function setTheme(page, light) {
    const btn = page.getByRole('button', { name: /Switch to (light|dark) theme/i });
    const label = await btn.getAttribute('title');
    const isDark = label?.includes('light');
    if (light && isDark) await btn.click();
    if (!light && !isDark) await btn.click();
    await page.waitForTimeout(300);
}

async function skipLandingIntro(page) {
    const skip = page.getByRole('button', { name: 'Skip intro' });
    if (await skip.isVisible().catch(() => false)) {
        await skip.click();
        await page.waitForTimeout(400);
    }
    await page.waitForTimeout(800);
}

async function snap(page, name) {
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

async function initAppChartTab(page) {
    await page.goto(`${BASE}#/app`);
    await page.getByTestId('calculate-btn').click({ timeout: 180_000 });
    const table = page.getByTestId('planets-table');
    await table.waitFor({ state: 'visible', timeout: 180_000 });
    await assertChartTextNoOverlap(page);
    await assertNoTextClipped(page);
    await page.getByTestId('chart-style-south').click();
    await assertChartTextNoOverlap(page);
    await page.getByTestId('chart-style-north').click();
}

async function runVarga(page, varga) {
    await page.getByRole('tab', { name: 'Vargas' }).click();
    const sel = page.locator('.varga-board__picker select');
    await sel.selectOption(String(varga));
    await page.waitForTimeout(350);
    await assertChartTextNoOverlap(page);
    await page.getByTestId('chart-style-south').click();
    await assertChartTextNoOverlap(page);
    await page.getByTestId('chart-style-north').click();
}

async function main() {
    await mkdir(OUT, { recursive: true });
    const browser = await chromium.launch();
    const report = [];

    for (const vp of VIEWPORTS) {
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();

        for (const light of [false, true]) {
            await page.goto(`${BASE}#/`);
            await setTheme(page, light);
            await skipLandingIntro(page);
            await assertHeroVisible(page);
            await assertNoFilledConstellationPaths(page);
            await snap(page, `landing-hero-${light ? 'light' : 'dark'}-${vp.name}`);
            report.push(`landing-hero-${light ? 'light' : 'dark'}-${vp.name}`);

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(400);
            await assertNoFilledConstellationPaths(page);
            const cards = await page.locator('.feature-card').count();
            if (cards < 4)
                fail(
                    `Why section cards missing (${cards}) at ${vp.name} ${light ? 'light' : 'dark'}`,
                );
            await snap(page, `landing-why-${light ? 'light' : 'dark'}-${vp.name}`);
            report.push(`landing-why-${light ? 'light' : 'dark'}-${vp.name}`);
        }

        await page.goto(`${BASE}#/docs/settings`);
        await page.waitForTimeout(400);
        const docScroll = await page.evaluate(() => {
            const article = document.querySelector('.doc-article');
            return (
                (article?.scrollHeight ?? 0) > 280 ||
                document.body.scrollHeight > window.innerHeight + 40
            );
        });
        if (!docScroll) fail(`Docs page not scrollable at ${vp.name}`);
        const navCount = await page.locator('.docs-link').count();
        if (navCount < 8) fail(`Docs nav links missing (${navCount})`);
        await snap(page, `docs-settings-${vp.name}`);
        report.push(`docs-settings-${vp.name}`);

        if (vp.name !== '390') {
            await initAppChartTab(page);
            await snap(page, `app-chart-d1-${vp.name}`);
            report.push(`app-chart-d1-${vp.name}`);
            for (const varga of [9, 60, 150]) {
                await runVarga(page, varga);
                await snap(page, `app-varga-d${varga}-north-${vp.name}`);
                report.push(`app-varga-d${varga}-${vp.name}`);
            }
        }

        await context.close();
    }

    await browser.close();
    await writeFile(
        join(OUT, 'report.json'),
        JSON.stringify({ failures, inspected: report }, null, 2),
    );
    if (failures.length) {
        console.error(`\n${failures.length} visual check failure(s)`);
        process.exit(1);
    }
    console.log('Visual check passed. Inspected:', report.join(', '));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
