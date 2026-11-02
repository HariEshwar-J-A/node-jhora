/**
 * Local visual regression harness (NOT run in CI).
 * Usage: pnpm --filter @node-jhora/web build && pnpm --filter @node-jhora/web preview --host 127.0.0.1 --port 4173
 *        node apps/web/scripts/visual-check.mjs
 *
 * Output: apps/web/.visual-check/ (override with VISUAL_CHECK_OUT)
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/node-jhora/';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.VISUAL_CHECK_OUT ?? join(SCRIPT_DIR, '..', '.visual-check');

const VIEWPORTS = [
    { name: '1280', width: 1280, height: 900 },
    { name: '390', width: 390, height: 844 },
];

const failures = [];

function fail(msg) {
    failures.push(msg);
    console.error('FAIL:', msg);
}

function relLuminance(r, g, b) {
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg, bg) {
    const L1 = relLuminance(fg.r, fg.g, fg.b);
    const L2 = relLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(color) {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255 };
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

async function assertChartPlanetFontMin(page, minPx = 12, minChartWidth = 480) {
    const small = await page.evaluate(
        ({ min, minChartW }) => {
            const svg = document.querySelector('.chart-canvas__svg');
            if (!svg) return [];
            const svgRect = svg.getBoundingClientRect();
            if (svgRect.width < minChartW) return [];
            const vb = svg.viewBox.baseVal;
            const scale = vb.width > 0 ? svgRect.width / vb.width : 1;
            return Array.from(svg.querySelectorAll('text.chart-planet'))
                .filter((t) => t.textContent?.trim())
                .map((t) => {
                    const attr = parseFloat(
                        t.getAttribute('font-size') ?? t.getAttribute('fontSize') ?? '0',
                    );
                    const fsPx = attr * scale;
                    const hPx = t.getBoundingClientRect().height;
                    const effective = Math.max(fsPx, hPx * 0.92);
                    return { text: t.textContent, fs: effective };
                })
                .filter((x) => !Number.isFinite(x.fs) || x.fs < min);
        },
        { min: minPx, minChartW: minChartWidth },
    );
    if (small.length)
        fail(
            `Chart planet font below ${minPx}px: ${small
                .slice(0, 8)
                .map((s) => `${s.text}=${s.fs.toFixed(1)}`)
                .join(', ')}`,
        );
}

async function assertChartPlanetDegrees(page) {
    const bad = await page.evaluate(() => {
        const svg = document.querySelector('.chart-canvas__svg');
        if (!svg) return [];
        return Array.from(svg.querySelectorAll('text.chart-planet'))
            .filter((t) => t.textContent?.trim())
            .filter((t) => !t.textContent?.includes('\u00b0'))
            .map((t) => t.textContent);
    });
    if (bad.length) fail(`Planet labels missing degrees: ${bad.slice(0, 8).join(', ')}`);
}

async function assertChartTextNoOverlap(page) {
    const overlaps = await page.evaluate(() => {
        const svg = document.querySelector('.chart-canvas__svg');
        if (!svg) return [];
        const hits = [];
        const houses = svg.querySelectorAll('g.chart-house');
        const groups = houses.length ? Array.from(houses) : [svg];
        for (const g of groups) {
            const texts = Array.from(
                g.querySelectorAll('text.chart-planet, text.chart-sign-num, text.chart-lagna-tag'),
            ).filter((t) => t.textContent?.trim());
            const boxes = texts.map((t) => {
                const b = t.getBoundingClientRect();
                return { t: t.textContent, cls: t.className.baseVal, b };
            });
            for (let i = 0; i < boxes.length; i++) {
                for (let j = i + 1; j < boxes.length; j++) {
                    const a = boxes[i].b;
                    const b = boxes[j].b;
                    const overlap =
                        a.left < b.right &&
                        b.left < a.right &&
                        a.top < b.bottom &&
                        b.top < a.bottom &&
                        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
                        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
                    if (overlap)
                        hits.push(`${boxes[i].cls}:${boxes[i].t} × ${boxes[j].cls}:${boxes[j].t}`);
                }
            }
        }
        return hits;
    });
    if (overlaps.length) fail(`Overlapping chart labels: ${overlaps.slice(0, 8).join(' | ')}`);
}

async function assertNoHorizontalOverflow(page, label) {
    const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    if (!ok) {
        const w = await page.evaluate(() => ({
            sw: document.documentElement.scrollWidth,
            iw: window.innerWidth,
        }));
        fail(`${label}: document scrollWidth ${w.sw} > innerWidth ${w.iw}`);
    }
}

async function assertNoTextClipped(page) {
    const clipped = await page.evaluate(() => {
        const wrap = document.querySelector('.grid-2--chart-table .data-table-wrap');
        const tableOverflow =
            wrap instanceof HTMLElement && wrap.scrollWidth > wrap.clientWidth + 2;
        const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
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
        return { tableOverflow, docOverflow, cellClip };
    });
    if (clipped.docOverflow) fail('Planets panel expands document wider than viewport');
    if (clipped.tableOverflow && clipped.docOverflow)
        fail('Planets table overflows viewport (not contained in card)');
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

async function assertHeroClearsHeader(page, vpName) {
    const bad = await page.evaluate(() => {
        const header = document.querySelector('.site-header');
        const h1 = document.querySelector('.landing-sky-hero .hero h1');
        if (!header || !h1) return 'missing header or h1';
        const hb = header.getBoundingClientRect();
        const rb = h1.getBoundingClientRect();
        const intersects =
            rb.top < hb.bottom && rb.bottom > hb.top && rb.left < hb.right && rb.right > hb.left;
        return intersects ? `h1 top ${rb.top} under header bottom ${hb.bottom}` : null;
    });
    if (bad) fail(`Hero H1 intersects sticky header at ${vpName}: ${bad}`);
}

async function assertLandingSectionsVisible(page, theme, vpName) {
    await page.evaluate(() => {
        document.querySelector('#licensing')?.scrollIntoView({ block: 'center' });
        document.querySelector('.section-motif__inner h2')?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(350);

    const result = await page.evaluate(() => {
        function parseRgb(color) {
            const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!m) return null;
            return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255 };
        }
        function relLuminance(r, g, b) {
            const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        }
        function contrastRatio(fg, bg) {
            const L1 = relLuminance(fg.r, fg.g, fg.b);
            const L2 = relLuminance(bg.r, bg.g, bg.b);
            const lighter = Math.max(L1, L2);
            const darker = Math.min(L1, L2);
            return (lighter + 0.05) / (darker + 0.05);
        }

        const checks = [];
        const selectors = [
            { sel: '.section-motif__inner h2', name: 'Why heading' },
            { sel: '.feature-card', name: 'feature-card', min: 4 },
            { sel: '#licensing h2', name: 'Licensing heading' },
            { sel: '#licensing .pricing-grid .card', name: 'tier card', min: 4 },
        ];
        for (const item of selectors) {
            const nodes =
                item.min != null
                    ? Array.from(document.querySelectorAll(item.sel))
                    : [document.querySelector(item.sel)].filter(Boolean);
            if (item.min != null && nodes.length < item.min) {
                checks.push(`${item.name}: count ${nodes.length} < ${item.min}`);
                continue;
            }
            for (const el of nodes) {
                if (!(el instanceof HTMLElement)) continue;
                const style = window.getComputedStyle(el);
                const opacity = parseFloat(style.opacity);
                if (opacity < 0.95) checks.push(`${item.name}: opacity ${opacity}`);
                const fg = parseRgb(style.color);
                let bgEl = el;
                let bgColor = 'transparent';
                while (bgEl && bgEl !== document.documentElement) {
                    const bg = window.getComputedStyle(bgEl).backgroundColor;
                    if (bg && !bg.includes('rgba(0, 0, 0, 0)') && bg !== 'transparent') {
                        bgColor = bg;
                        break;
                    }
                    bgEl = bgEl.parentElement;
                }
                const bg = parseRgb(bgColor);
                if (fg && bg) {
                    const ratio = contrastRatio(fg, bg);
                    if (ratio < 4.5)
                        checks.push(
                            `${item.name}: contrast ${ratio.toFixed(2)} (${el.textContent?.slice(0, 30)})`,
                        );
                }
                const r = el.getBoundingClientRect();
                if (r.height < 4 && r.width < 4) checks.push(`${item.name}: zero box`);
            }
        }
        return checks;
    });

    if (result.length) {
        fail(`Landing sections ${theme} ${vpName}: ${result.slice(0, 6).join('; ')}`);
    }
}

async function assertLicensingTierCards(page) {
    await page.evaluate(() =>
        document.querySelector('#licensing')?.scrollIntoView({ block: 'center' }),
    );
    await page.waitForTimeout(300);
    const bad = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#licensing .pricing-grid .card'));
        return cards
            .map((card) => {
                const title = card.querySelector('h3')?.textContent?.trim() ?? '';
                const note = card.querySelector('p.mono')?.textContent?.trim() ?? '';
                const detail = card.querySelector('p:not(.mono)')?.textContent?.trim() ?? '';
                const btn = card.querySelector('a.btn')?.textContent?.trim() ?? '';
                if (!note || !detail || !btn)
                    return `${title}: missing body (note=${note.length}, detail=${detail.length})`;
                const r = card.getBoundingClientRect();
                if (r.height < 80) return `${title}: card too short (${r.height}px)`;
                return null;
            })
            .filter(Boolean);
    });
    if (bad.length) fail(`Licensing tier cards: ${bad.join('; ')}`);
}

async function assertDocsScrollWheel(page, path, vpName) {
    await page.goto(`${BASE}#${path}`);
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => ({
        y: window.scrollY,
        tall: document.body.scrollHeight > window.innerHeight + 80,
    }));
    if (!before.tall) return;
    await page.mouse.move(640, 450);
    for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(80);
    }
    const after = await page.evaluate(() => window.scrollY);
    if (after <= before.y + 40) {
        fail(`Docs wheel scroll stuck at ${vpName} ${path} (${before.y} → ${after})`);
    }
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

async function assertPlaceCombobox(page, vpName) {
    const input = page.getByTestId('place-input');
    await input.click();
    await input.fill('zzzzqqqq');
    const empty = page.getByTestId('place-empty');
    await empty.waitFor({ state: 'visible', timeout: 120_000 });
    await input.fill('');
    await input.fill('chen');
    const chennai = page.getByRole('option', { name: /Chennai,/ });
    await chennai.waitFor({ state: 'visible', timeout: 30_000 });
    const box = await page.evaluate(() => {
        const list = document.querySelector('.place-combo__list');
        if (!list) return { missing: true };
        const r = list.getBoundingClientRect();
        return {
            missing: false,
            left: r.left,
            right: r.right,
            width: r.width,
            inner: window.innerWidth,
            scroll: document.documentElement.scrollWidth,
        };
    });
    if (box.missing) fail(`Place dropdown missing at ${vpName}`);
    else if (box.left < -1 || box.right > box.inner + 1 || box.scroll > box.inner + 1) {
        fail(
            `Place dropdown overflow at ${vpName}: left ${box.left?.toFixed?.(1) ?? box.left} right ${box.right?.toFixed?.(1) ?? box.right} viewport ${box.inner} scroll ${box.scroll}`,
        );
    }
    await snap(page, `app-place-dropdown-${vpName}`);
    await chennai.click();
    const lat = await page.locator('#lat').inputValue();
    const lon = await page.locator('#lon').inputValue();
    const tz = await page.locator('#tz').inputValue();
    if (!lat.startsWith('13.')) fail(`Chennai latitude not filled (${lat})`);
    if (!lon.startsWith('80.')) fail(`Chennai longitude not filled (${lon})`);
    if (tz !== 'Asia/Kolkata') fail(`Chennai timezone not filled (${tz})`);
    await assertNoHorizontalOverflow(page, `place selected ${vpName}`);
}

async function initAppChartTab(page, vpName) {
    await page.goto(`${BASE}#/app`);
    await assertPlaceCombobox(page, vpName);
    await page.getByTestId('calculate-btn').click({ timeout: 180_000 });
    const table = page.getByTestId('planets-table');
    await table.waitFor({ state: 'visible', timeout: 180_000 });
    await assertChartPlanetFontMin(page);
    await assertChartPlanetDegrees(page);
    await assertChartTextNoOverlap(page);
    await assertNoTextClipped(page);
    await assertNoHorizontalOverflow(page, 'app chart tab');
    await page.getByTestId('chart-style-south').click();
    await assertChartPlanetFontMin(page);
    await assertChartPlanetDegrees(page);
    await assertChartTextNoOverlap(page);
    await page.getByTestId('chart-style-north').click();
}

async function runVarga(page, varga) {
    await page.getByRole('tab', { name: 'Vargas' }).click();
    const sel = page.locator('.varga-board__picker select');
    await sel.selectOption(String(varga));
    await page.waitForTimeout(350);
    await assertChartPlanetDegrees(page);
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
            await assertHeroClearsHeader(page, vp.name);
            await assertNoHorizontalOverflow(
                page,
                `landing ${light ? 'light' : 'dark'} ${vp.name}`,
            );
            await assertNoFilledConstellationPaths(page);
            await snap(page, `landing-hero-${light ? 'light' : 'dark'}-${vp.name}`);
            report.push(`landing-hero-${light ? 'light' : 'dark'}-${vp.name}`);

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(400);
            await assertLandingSectionsVisible(page, light ? 'light' : 'dark', vp.name);
            if (light) await assertLicensingTierCards(page);
            await assertNoFilledConstellationPaths(page);
            await snap(page, `landing-why-${light ? 'light' : 'dark'}-${vp.name}`);
            report.push(`landing-why-${light ? 'light' : 'dark'}-${vp.name}`);
        }

        if (vp.name === '1280') {
            await assertDocsScrollWheel(page, '/docs', vp.name);
            await assertDocsScrollWheel(page, '/docs/dashas', vp.name);
        }

        await page.goto(`${BASE}#/docs/dashas`);
        await page.waitForTimeout(400);
        await assertNoHorizontalOverflow(page, `docs ${vp.name}`);
        const navCount = await page.locator('.docs-link').count();
        if (navCount < 8) fail(`Docs nav links missing (${navCount})`);
        await snap(page, `docs-dashas-${vp.name}`);
        report.push(`docs-dashas-${vp.name}`);

        await initAppChartTab(page, vp.name);
        await snap(page, `app-chart-d1-${vp.name}`);
        report.push(`app-chart-d1-${vp.name}`);
        if (vp.name === '1280') {
            await assertChartPlanetFontMin(page, 12, 480);
        }
        for (const varga of [9, 60, 150]) {
            await runVarga(page, varga);
            if (vp.name === '1280') {
                await assertChartPlanetFontMin(page, 12, 480);
            }
            await snap(page, `app-varga-d${varga}-north-${vp.name}`);
            report.push(`app-varga-d${varga}-${vp.name}`);
        }

        await context.close();
    }

    await browser.close();
    await writeFile(
        join(OUT, 'report.json'),
        JSON.stringify({ failures, inspected: report, outDir: OUT }, null, 2),
    );
    if (failures.length) {
        console.error(`\n${failures.length} visual check failure(s). Screenshots: ${OUT}`);
        process.exit(1);
    }
    console.log('Visual check passed. Output:', OUT);
    console.log('Inspected:', report.join(', '));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
