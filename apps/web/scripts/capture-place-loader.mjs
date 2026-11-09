/**
 * Local screenshots of the place-index loader (not part of CI).
 * Preview must already be serving http://127.0.0.1:4173/astrology/
 *
 * Writes:
 *   /opt/cursor/artifacts/screenshots/place-loader-40-390.png
 *   /opt/cursor/artifacts/screenshots/place-loader-ready-390.png
 *   /opt/cursor/artifacts/screenshots/place-loader-40-1280.png
 *   /opt/cursor/artifacts/screenshots/place-loader-ready-1280.png
 *   /opt/cursor/artifacts/screenshots/place-loader-transfer.json
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { previewOrigin } from '../site.mjs';

const BASE = process.env.PREVIEW_URL ?? previewOrigin();
const OUT = process.env.LOADER_SHOTS ?? '/opt/cursor/artifacts/screenshots';

function trackAtlas(page, bucket) {
    page.on('response', (res) => {
        if (!res.url().includes('/atlas/')) return;
        const len = Number(res.headers()['content-length']);
        bucket.push({
            url: res.url().split('/').pop(),
            bytes: Number.isFinite(len) && len > 0 ? len : null,
            status: res.status(),
        });
    });
}

async function queryBytes(page) {
    return page.evaluate(() =>
        performance
            .getEntriesByType('resource')
            .filter((entry) => entry.name.includes('/atlas/'))
            .map((entry) => ({
                url: entry.name.split('/').pop(),
                transferSize: entry.transferSize,
                encodedBodySize: entry.encodedBodySize,
                decodedBodySize: entry.decodedBodySize,
            })),
    );
}

async function openBirthForm(page) {
    const chip = page.getByTestId('birth-summary-chip');
    if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        await page.getByTestId('place-input').waitFor({ state: 'visible', timeout: 10_000 });
    }
}

async function searchSao(page) {
    await openBirthForm(page);
    const input = page.getByTestId('place-input');
    await input.click();
    await input.fill('sao paulo');
    await page
        .locator('.place-combo__list')
        .getByRole('option')
        .first()
        .waitFor({ state: 'visible', timeout: 120_000 });
}

async function waitForMidLoad(page) {
    await page.getByTestId('place-loading').waitFor({ state: 'visible', timeout: 30_000 });
    const started = Date.now();
    let last = null;
    while (Date.now() - started < 90_000) {
        const text = await page
            .getByTestId('place-loading')
            .textContent()
            .catch(() => null);
        const match = text?.match(/(\d+)%/);
        const percent = match ? Number(match[1]) : null;
        if (percent != null) last = percent;
        if (page.shardStarted && percent != null && percent >= 38 && percent <= 48) {
            return { percent, shard: true };
        }
        if (text == null && page.shardStarted) return { percent: last, shard: true, gone: true };
        await page.waitForTimeout(30);
    }
    return { percent: last, shard: Boolean(page.shardStarted), timeout: true };
}

function assertFits(box, viewport, label) {
    if (!box) throw new Error(`${label} has no box`);
    if (box.x < -1 || box.x + box.width > viewport + 1) {
        throw new Error(
            `${label} overflows ${viewport}px: x ${box.x.toFixed(1)} width ${box.width.toFixed(1)}`,
        );
    }
}

async function shootLoader(browser, viewport) {
    const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 28 * 1024,
        uploadThroughput: 16 * 1024,
        latency: 30,
    });
    page.shardStarted = false;
    page.on('request', (req) => {
        if (req.url().includes('la-sa.json.gz')) page.shardStarted = true;
    });
    await page.goto(`${BASE}#/app`, { waitUntil: 'domcontentloaded' });
    await openBirthForm(page);
    const input = page.getByTestId('place-input');
    await page.evaluate(() => {
        document.getElementById('place')?.scrollIntoView({ block: 'center' });
    });
    await input.click();
    await input.fill('sao paulo');
    const mid = await waitForMidLoad(page);
    if (mid.timeout || mid.gone || mid.percent == null || mid.percent < 38 || mid.percent > 48) {
        throw new Error(`Missed the mid-load frame at ${viewport.name}: ${JSON.stringify(mid)}`);
    }
    const progress = page.getByTestId('place-progress');
    const label = page.getByTestId('place-loading');
    const barBox = await progress.boundingBox();
    const labelBox = await label.boundingBox();
    assertFits(barBox, viewport.width, `progress ${viewport.name}`);
    assertFits(labelBox, viewport.width, `label ${viewport.name}`);
    const valuetext = await progress.getAttribute('aria-valuenow');
    const readOnly = await input.getAttribute('readonly');
    const value = await input.inputValue();
    if (readOnly === null) throw new Error(`Input was editable during load at ${viewport.name}`);
    if (value !== 'sao paulo') throw new Error(`Typed text changed during load: "${value}"`);
    await page.screenshot({ path: join(OUT, `place-loader-40-${viewport.name}.png`) });
    await page
        .locator('.place-combo__list')
        .getByRole('option')
        .first()
        .waitFor({ state: 'visible', timeout: 120_000 });
    await label.waitFor({ state: 'hidden', timeout: 30_000 });
    const after = await input.inputValue();
    const stillReadOnly = await input.getAttribute('readonly');
    if (after !== 'sao paulo') throw new Error(`Typed text lost after load: "${after}"`);
    if (stillReadOnly !== null) throw new Error('Input stayed read-only after load');
    await page.screenshot({ path: join(OUT, `place-loader-ready-${viewport.name}.png`) });
    await context.close();
    return { ...mid, valuetext, value: after };
}

async function measureTransfers(browser) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const first = [];
    trackAtlas(page, first);
    await page.goto(`${BASE}#/app`, { waitUntil: 'domcontentloaded' });
    await searchSao(page);
    await page.waitForTimeout(400);
    const firstResources = await queryBytes(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const second = [];
    trackAtlas(page, second);
    await searchSao(page);
    await page.waitForTimeout(400);
    const secondResources = await queryBytes(page);
    await context.close();
    const sum = (rows) =>
        rows
            .filter((row) => row.url === 'manifest.json' || row.url === 'la-sa.json.gz')
            .reduce((total, row) => total + (row.bytes ?? 0), 0);
    return {
        firstResponses: first,
        firstQueryBytes: sum(first),
        firstResources,
        secondResponses: second,
        secondQueryBytes: sum(second),
        secondResources,
    };
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const transfers = await measureTransfers(browser);
const shots = [];
for (const viewport of [
    { name: '390', width: 390, height: 844 },
    { name: '1280', width: 1280, height: 900 },
]) {
    shots.push({ viewport: viewport.name, ...(await shootLoader(browser, viewport)) });
}
await browser.close();
const report = { transfers, shots };
await writeFile(join(OUT, 'place-loader-transfer.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
