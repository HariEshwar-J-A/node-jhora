import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('production preview: kernel load, Calculate, North/South charts', async ({ page }) => {
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
    await expect(calculate).toHaveText('Calculate', { timeout: 180_000 });
    await calculate.click();

    await expect(page.getByTestId('planets-table')).toBeVisible({ timeout: 180_000 });
    await expect(page.getByTestId('planets-table')).toContainText('Moon');
    await expect(page.getByTestId('panel-chart')).toBeVisible();

    await page.getByTestId('chart-style-south').click();
    await expect(page.getByRole('img', { name: 'South Indian chart' })).toBeVisible();
    await page.getByTestId('chart-style-north').click();
    await expect(page.getByRole('img', { name: 'North Indian chart' })).toBeVisible();

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});
