import { test, expect } from '@playwright/test';

const BENCH_SUN_SIDEREAL_HEX = '488f2f4bc0bf6c40';

test('worker initialize({ kernel }) bench Sun sidereal IEEE hex', async ({ page }) => {
    await page.goto('/');
    const sunHex = await page.evaluate(async () => {
        const snapshot = (await window.__njhRunHarness({
            instant: '2000-01-01T12:00:00+05:30',
            latitude: 13.0827,
            longitude: 80.2707,
            settings: 'node-jhora-default',
            include: ['planets'],
        })) as { planets?: Array<{ name: string; longitude: number }> };
        const sun = snapshot.planets?.find((p) => p.name === 'Sun');
        if (!sun) throw new Error('Sun missing');
        const buf = new ArrayBuffer(8);
        new DataView(buf).setFloat64(0, sun.longitude, true);
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    });
    expect(sunHex).toBe(BENCH_SUN_SIDEREAL_HEX);
});
