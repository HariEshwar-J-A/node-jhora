import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = process.env.NJH_WEB_SCREENSHOTS ?? '/opt/cursor/artifacts/screenshots';

test('Calculate renders every tab without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (/favicon|404.*favicon/i.test(text)) return;
            consoleErrors.push(text);
        }
    });

    await page.goto('./#/app');
    await page.getByLabel('Custom varga divisor (optional)').fill('150');
    const calculate = page.getByTestId('calculate-btn');
    await expect(calculate).toBeEnabled({ timeout: 180_000 });
    await calculate.click();

    await expect(page.getByTestId('planets-table')).toBeVisible({ timeout: 180_000 });
    await expect(page.getByTestId('planets-table')).toContainText('Moon');

    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const capture = async (name: string) => {
        await page.screenshot({
            path: join(SCREENSHOT_DIR, `${name}.webp`),
            type: 'webp',
            fullPage: true,
        });
    };

    await capture('tab-chart-north');

    await page.getByRole('button', { name: 'South Indian' }).click();
    await capture('tab-chart-south');

    const tabs: { id: string; shot: string }[] = [
        { id: 'vargas', shot: 'tab-vargas-d150' },
        { id: 'dashas', shot: 'tab-dashas' },
        { id: 'panchanga', shot: 'tab-panchanga' },
        { id: 'strength', shot: 'tab-strength' },
        { id: 'kp', shot: 'tab-kp' },
        { id: 'matching', shot: 'tab-matching' },
        { id: 'transits', shot: 'tab-transits' },
    ];

    for (const { id, shot } of tabs) {
        await page.getByTestId(`tab-${id}`).click();
        await expect(page.getByTestId(`panel-${id}`)).toBeVisible();
        await capture(shot);
    }

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});

test('UTC offset +05:30 is accepted for Calculate', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    await page.goto('./#/app');
    await page.getByLabel('Time zone (IANA or offset, e.g. Asia/Kolkata or +05:30)').fill('+05:30');
    await page.getByTestId('calculate-btn').click();
    await expect(page.getByTestId('planets-table')).toBeVisible({ timeout: 180_000 });
    expect(consoleErrors.join('\n')).not.toMatch(/Unserializable/);
});
