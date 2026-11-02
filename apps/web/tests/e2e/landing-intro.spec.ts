import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = process.env.NJH_WEB_SCREENSHOTS ?? '/opt/cursor/artifacts/screenshots';

test('Landing intro can be skipped and hero HTML stays visible', async ({ page }) => {
    await page.addInitScript(() => {
        sessionStorage.removeItem('njh-space-intro');
    });
    await page.goto('./#/');
    const skip = page.getByRole('button', { name: 'Skip intro' });
    await expect(skip).toBeVisible({ timeout: 30_000 });
    await skip.click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vedic chart engine');
    await expect(page.getByRole('link', { name: 'Open chart app' })).toBeVisible();
});

test('Landing hero screenshots (desktop light/dark)', async ({ page }) => {
    await page.addInitScript(() => {
        sessionStorage.setItem('njh-space-intro', '1');
    });

    const capture = async (name: string, theme: 'light' | 'dark') => {
        await page.goto(`./#/?theme=${theme}`);
        await page.evaluate((t) => {
            document.documentElement.dataset.theme = t;
            localStorage.setItem('njh-theme', t);
        }, theme);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
        await page.screenshot({
            path: join(SCREENSHOT_DIR, `${name}.webp`),
            type: 'webp',
            fullPage: false,
        });
    };

    await capture('landing-sky-light', 'light');
    await capture('landing-sky-dark', 'dark');
});

test('Intro sequence frames (start → skip → sky)', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.removeItem('njh-space-intro'));
    await page.goto('./#/');
    await page.waitForTimeout(400);
    await page.screenshot({
        path: join(SCREENSHOT_DIR, 'intro-01-start.webp'),
        type: 'webp',
    });
    await page.waitForTimeout(2500);
    await page.screenshot({
        path: join(SCREENSHOT_DIR, 'intro-02-mid.webp'),
        type: 'webp',
    });
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await expect(page.locator('.landing-sky-hero__content--visible')).toBeVisible({ timeout: 5000 });
    await page.screenshot({
        path: join(SCREENSHOT_DIR, 'intro-03-sky-content.webp'),
        type: 'webp',
        fullPage: false,
    });
});
