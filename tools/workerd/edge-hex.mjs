/** @typedef {{ benchSunHex: string; deepSunHex: string }} EdgeHexReference */

export function f64Hex(value) {
    const buf = Buffer.alloc(8);
    buf.writeDoubleLE(value);
    return buf.toString('hex');
}

/**
 * Node reference for PR5 edge gate (initialize({ kernel }) + in-memory NJCE window).
 * @param {object} deps
 * @param {() => Uint8Array} deps.loadKernelBytes
 * @param {string} deps.chunk441Dir
 * @param {typeof import('luxon').DateTime} deps.DateTime
 * @param {typeof import('../../packages/core/dist/index.js').EphemerisEngine} deps.EphemerisEngine
 * @param {typeof import('../../packages/core/dist/engine/deltat.js').deltaT} deps.deltaT
 * @param {typeof import('../../packages/core/dist/engine/provider/edge-bootstrap.js').createDe441ChunkStoreFromMemory} deps.createDe441ChunkStoreFromMemory
 * @param {typeof import('../../packages/core/dist/engine/provider/edge-bootstrap.js').de441ChunkKeysForJdTdb} deps.de441ChunkKeysForJdTdb
 * @param {typeof import('../../packages/core/dist/engine/provider/edge-bootstrap.js').njceMapKey} deps.njceMapKey
 * @param {(dir: string, keys: import('../../packages/core/dist/engine/provider/chunk-loader.js').ChunkKey[]) => Map<string, ArrayBuffer>} deps.loadNjceWindow
 * @returns {Promise<EdgeHexReference>}
 */
export async function computeEdgeHexReference(deps) {
    const BENCH_INSTANT = deps.DateTime.fromISO('2000-01-01T12:00:00', {
        zone: 'Asia/Kolkata',
    });
    const BENCH_LOCATION = { latitude: 13.0827, longitude: 80.2707 };
    const DEEP_INSTANT = deps.DateTime.utc(-9999, 6, 15, 12, 0, 0);

    async function sunHexForInstant(instant, chunkDir, needLongRange) {
        const engine = new deps.EphemerisEngine();
        await engine.initialize({ kernel: deps.loadKernelBytes() });
        if (needLongRange) {
            const jdUt = engine.julday(instant);
            const jdTdb = jdUt + deps.deltaT(jdUt) / 86_400;
            const keys = deps.de441ChunkKeysForJdTdb(jdTdb);
            const store = deps.createDe441ChunkStoreFromMemory(deps.loadNjceWindow(chunkDir, keys));
            engine.setDe441ChunkStore(store);
            engine.setEphemerisPolicy('auto');
        }
        const planets = engine.getPlanets(instant, BENCH_LOCATION, {
            zodiac: 'sidereal',
            ayanamsaOrder: 27,
        });
        const sun = planets.find((p) => p.name === 'Sun');
        if (!sun) throw new Error('Sun missing from getPlanets');
        return f64Hex(sun.longitude);
    }

    const benchSunHex = await sunHexForInstant(BENCH_INSTANT, deps.chunk441Dir, false);
    const deepSunHex = await sunHexForInstant(DEEP_INSTANT, deps.chunk441Dir, true);
    return { benchSunHex, deepSunHex };
}
