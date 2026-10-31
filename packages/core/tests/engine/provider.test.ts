import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { loadSpkFromBytes, NAIF, resetSpkCache } from '../../src/engine/spk.js';
import {
    CompositeEphemerisProvider,
    De431ChunkFile,
    De440sEphemerisProvider,
    DE440S_JD_TDB_END,
    DE440S_JD_TDB_START,
    NJCE_MAGIC,
    NJCE_VERSION,
    BODY_GROUP_PLANETS,
    centuryIndex,
} from '../../src/engine/provider/index.js';
import { jdTdbToEt } from '../../src/engine/provider/time.js';

const root = join(fileURLToPath(import.meta.url), '../../../../..');

function resolveBsp(): string {
    try {
        const req = createRequire(import.meta.url);
        const pkg = req.resolve('@node-jhora/ephe/package.json');
        return join(pkg, '..', 'de440s.bsp');
    } catch {
        return join(root, 'packages/ephe/de440s.bsp');
    }
}

const loadSpk = (path: string): ReturnType<typeof loadSpkFromBytes> =>
    loadSpkFromBytes(readFileSync(path));

function encodeChunkFromSpk(
    spk: ReturnType<typeof loadSpk>,
    century: number,
    groupId: number,
): ArrayBuffer {
    const etStart = jdTdbToEt(DE440S_JD_TDB_START);
    const etEnd = jdTdbToEt(DE440S_JD_TDB_END);
    const targets: Array<[number, number]> =
        groupId === BODY_GROUP_PLANETS
            ? [
                  [NAIF.Sun, NAIF.SSB],
                  [NAIF.Mercury, NAIF.SSB],
              ]
            : [
                  [NAIF.EMB, NAIF.SSB],
                  [NAIF.Moon, NAIF.EMB],
                  [NAIF.Earth, NAIF.EMB],
              ];

    const payloads: Array<ReturnType<typeof spk.readType2SegmentPayload>> = [];
    for (const [target, center] of targets) {
        for (const seg of spk.segmentList) {
            if (seg.target !== target || seg.center !== center) continue;
            if (seg.endET < etStart || seg.startET > etEnd) continue;
            payloads.push(spk.readType2SegmentPayload(seg));
        }
    }

    let size = 18;
    for (const p of payloads) size = ((size + 32 + 7) & ~7) + p.data.byteLength;
    const buf = new ArrayBuffer(size);
    const view = new DataView(buf);
    let off = 0;
    view.setUint32(off, NJCE_MAGIC, true);
    off += 4;
    view.setUint16(off, NJCE_VERSION, true);
    off += 2;
    view.setInt32(off, century, true);
    off += 4;
    view.setUint8(off, groupId);
    off += 1;
    off += 3;
    view.setUint32(off, payloads.length, true);
    off += 4;
    for (const p of payloads) {
        view.setInt32(off, p.target, true);
        off += 4;
        view.setInt32(off, p.center, true);
        off += 4;
        view.setFloat64(off, p.init, true);
        off += 8;
        view.setFloat64(off, p.intlen, true);
        off += 8;
        view.setUint32(off, p.rsize, true);
        off += 4;
        view.setUint32(off, p.n, true);
        off += 4;
        off = (off + 7) & ~7;
        new Float64Array(buf, off, p.data.length).set(p.data);
        off += p.data.byteLength;
    }
    return buf;
}

describe('EphemerisProvider', () => {
    let bspPath: string;

    beforeAll(async () => {
        bspPath = resolveBsp();
        if (!readFileSync) return;
        try {
            readFileSync(bspPath);
        } catch {
            throw new Error('de440s.bsp required for provider tests');
        }
    });

    beforeEach(() => resetSpkCache());

    test('DE440s provider matches SpkFile.getBarycentric at J2000', () => {
        const spk = loadSpk(bspPath);
        const de440 = new De440sEphemerisProvider(spk);
        const jd = 2451545.0;
        const et = jdTdbToEt(jd);
        const direct = spk.getBarycentric(NAIF.Mars, et);
        const via = de440.state(jd, NAIF.Mars, 'barycentric');
        expect(via.x).toBe(direct.x);
        expect(via.y).toBe(direct.y);
        expect(via.z).toBe(direct.z);
    });

    test('auto policy uses DE440s inside overlap (byte-identical path)', () => {
        const spk = loadSpk(bspPath);
        const composite = new CompositeEphemerisProvider(spk, { policy: 'auto' });
        const jd = 2451545.0;
        const et = jdTdbToEt(jd);
        expect(composite.getBarycentric(NAIF.Jupiter, et)).toEqual(
            spk.getBarycentric(NAIF.Jupiter, et),
        );
    });

    test('chunk round-trip matches SPK within float64', () => {
        const spk = loadSpk(bspPath);
        const cent = centuryIndex(1998);
        const buf = encodeChunkFromSpk(spk, cent, BODY_GROUP_PLANETS);
        const chunk = new De431ChunkFile(buf);
        const et = jdTdbToEt(2451545.0);
        const a = spk.getBarycentric(NAIF.Sun, et);
        const b = chunk.getBarycentric(NAIF.Sun, et);
        const errKm = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        expect(errKm).toBeLessThan(1e-6);
    });

    test('auto policy keeps the whole de440s span (1849-12-26..2150-01-22) on DE440s', () => {
        const spk = loadSpk(bspPath);
        const composite = new CompositeEphemerisProvider(spk, { policy: 'auto' });
        // 1849-12-27, 2100-06-21 and 2150-01-21 (TDB) — inside the kernel's segment span
        for (const jd of [2396753.5, 2488241.0, 2506351.5]) {
            const et = jdTdbToEt(jd);
            expect(composite.getBarycentric(NAIF.Moon, et)).toEqual(
                spk.getBarycentric(NAIF.Moon, et),
            );
        }
        for (const seg of spk.segmentList) {
            expect(seg.startET).toBeLessThanOrEqual(jdTdbToEt(DE440S_JD_TDB_START));
            expect(seg.endET).toBeGreaterThanOrEqual(jdTdbToEt(DE440S_JD_TDB_END));
        }
    });

    test('routing throws outside DE440s without long-range chunks', () => {
        const spk = loadSpk(bspPath);
        const composite = new CompositeEphemerisProvider(spk, { policy: 'auto' });
        const jd = DE440S_JD_TDB_START - 10;
        expect(() => composite.state(jd, NAIF.Sun, 'barycentric')).toThrow(/outside DE440s/);
    });

    test('de441_long policy throws when DE441 chunks are not attached', () => {
        const spk = loadSpk(bspPath);
        const composite = new CompositeEphemerisProvider(spk, { policy: 'de441_long' });
        const jd = DE440S_JD_TDB_START - 10;
        expect(() => composite.state(jd, NAIF.Sun, 'barycentric')).toThrow(/DE441 long-range/);
    });

    test('chunk boundaries at DE440s edges', () => {
        const spk = loadSpk(bspPath);
        const composite = new CompositeEphemerisProvider(spk, { policy: 'de440s' });
        for (const jd of [DE440S_JD_TDB_START, DE440S_JD_TDB_END]) {
            const et = jdTdbToEt(jd);
            expect(() => composite.getBarycentric(NAIF.Sun, et)).not.toThrow();
        }
    });
});

describe('EphemerisEngine integration', () => {
    test('provenance reports de440s at J2000', async () => {
        const engine = EphemerisEngine.getInstance();
        await engine.initialize();
        const prov = engine.getEphemerisProvenance(2451545.0);
        expect(prov.kernelId).toBe('de440s');
        expect(prov.policy).toBe('auto');
    });
});
