import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        sessionStorage.setItem('njh-space-intro', '1');
    });
});

test('production preview: sample chart Calculate with no console errors', async ({ page }) => {
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
    const calculate = page.getByTestId('calculate-btn');
    await expect(calculate).toBeEnabled({ timeout: 180_000 });
    await calculate.click();

    await expect(page.getByTestId('planets-table')).toBeVisible({ timeout: 180_000 });
    await expect(page.getByTestId('planets-table')).toContainText('Moon');
    await expect(page.getByTestId('panel-chart')).toBeVisible();

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});
