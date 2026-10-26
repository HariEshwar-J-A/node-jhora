import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { EphemerisEngine } from '@node-jhora/core';
import { ChartSession, CHART_SECTION_IDS, type ChartSectionsSnapshot } from '@node-jhora/engine';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const req = createRequire(join(repoRoot, 'packages/core/package.json'));

function loadKernelBytes(): Uint8Array {
    const pkgJson = req.resolve('@node-jhora/ephe/package.json');
    return new Uint8Array(readFileSync(join(dirname(pkgJson), 'de440s.bsp')));
}

export async function computeNodeReference(request: {
    instant: string;
    latitude: number;
    longitude: number;
    settings: 'node-jhora-default';
    include?: readonly string[];
}): Promise<ChartSectionsSnapshot> {
    const { resetSpkCache } = await import('../../../../packages/core/dist/engine/spk.js');
    resetSpkCache();
    const engine = new EphemerisEngine();
    await engine.initialize({ kernel: loadKernelBytes() });
    const session = new ChartSession({
        instant: DateTime.fromISO(request.instant, { zone: 'utc' }),
        location: { latitude: request.latitude, longitude: request.longitude },
        settings: request.settings,
        ephemeris: engine,
    });
    const include = (request.include ?? CHART_SECTION_IDS) as typeof CHART_SECTION_IDS;
    return session.collect(include);
}
