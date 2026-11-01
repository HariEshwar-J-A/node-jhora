import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearBspBytesLoader, setBspBytesLoader } from '../../src/engine/bsp-bytes-provider.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { resetSpkCache } from '../../src/engine/spk.js';

const coreRoot = dirname(fileURLToPath(import.meta.url));
const req = createRequire(join(coreRoot, '../../package.json'));

function resolveBspPath(): string {
    const pkgJson = req.resolve('@node-jhora/ephe/package.json');
    return join(dirname(pkgJson), 'de440s.bsp');
}

describe('SPK bytes provider', () => {
    afterEach(() => {
        clearBspBytesLoader();
        resetSpkCache();
    });

    test('in-memory bytes match filesystem load for Varanasi bench instant', async () => {
        const path = resolveBspPath();
        const bytes = new Uint8Array(readFileSync(path));
        setBspBytesLoader(async () => bytes);
        resetSpkCache();

        const fromBytes = new EphemerisEngine();
        await fromBytes.initialize();

        clearBspBytesLoader();
        resetSpkCache();
        setBspBytesLoader(async () => new Uint8Array(readFileSync(path)));
        const fromDisk = new EphemerisEngine();
        await fromDisk.initialize();

        const { DateTime } = await import('luxon');
        const dt = DateTime.fromISO('2020-12-21T12:50:00', { zone: 'utc' });
        const location = { latitude: 25.3176, longitude: 82.9739 };

        const a = fromBytes.getPlanets(dt, location, {});
        const b = fromDisk.getPlanets(dt, location, {});

        expect(a.length).toBe(b.length);
        for (let i = 0; i < a.length; i++) {
            expect(a[i].longitude).toBe(b[i].longitude);
            expect(a[i].latitude).toBe(b[i].latitude);
            expect(a[i].speed).toBe(b[i].speed);
        }
    }, 120_000);
});
