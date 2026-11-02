import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const webRoot = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT ?? '4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}/node-jhora/`;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    timeout: 180_000,
    reporter: [['list']],
    globalSetup: './scripts/playwright-global-setup.mjs',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'pnpm run preview',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        cwd: webRoot,
    },
});
