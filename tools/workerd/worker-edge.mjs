/**
 * Workerd worker entry (bundled). Fetches DE440s + window NJCE from the local asset server.
 */
import { EphemerisEngine, createDe441ChunkStoreFromMemory } from '@node-jhora/core';
import { DateTime } from 'luxon';

/** @type {string} */
const ASSET_ORIGIN = __NJH_EDGE_ASSET_ORIGIN__;

function f64Hex(n) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, n, true);
    return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function loadKernel() {
    const kernelRes = await fetch(`${ASSET_ORIGIN}/de440s.bsp`);
    if (!kernelRes.ok) throw new Error('kernel fetch failed');
    return new Uint8Array(await kernelRes.arrayBuffer());
}

async function loadChunkMap(manifest) {
    const map = {};
    for (const entry of manifest) {
        const res = await fetch(`${ASSET_ORIGIN}/chunks/${entry.file}`);
        if (!res.ok) throw new Error(`chunk fetch failed: ${entry.file}`);
        map[entry.id] = await res.arrayBuffer();
    }
    return map;
}

async function sunHex(instant, chunkMap, useLongRange) {
    const engine = new EphemerisEngine();
    await engine.initialize({ kernel: await loadKernel() });
    if (useLongRange) {
        engine.setDe441ChunkStore(createDe441ChunkStoreFromMemory(chunkMap));
        engine.setEphemerisPolicy('auto');
    }
    const planets = engine.getPlanets(
        instant,
        { latitude: 13.0827, longitude: 80.2707 },
        { zodiac: 'sidereal', ayanamsaOrder: 27 },
    );
    const sun = planets.find((p) => p.name === 'Sun');
    if (!sun) throw new Error('Sun missing');
    return f64Hex(sun.longitude);
}

export default {
    async fetch() {
        try {
            const manifestRes = await fetch(`${ASSET_ORIGIN}/chunks/manifest.json`);
            if (!manifestRes.ok) throw new Error(`manifest fetch failed: ${manifestRes.status}`);
            const manifest = await manifestRes.json();
            const chunkMap = await loadChunkMap(manifest);
            const benchInstant = DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' });
            const deepInstant = DateTime.utc(-9999, 6, 15, 12, 0, 0);
            const benchSunHex = await sunHex(benchInstant, chunkMap, false);
            const deepSunHex = await sunHex(deepInstant, chunkMap, true);
            return Response.json({ benchSunHex, deepSunHex });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            return Response.json({ error: message, stack }, { status: 500 });
        }
    },
};
