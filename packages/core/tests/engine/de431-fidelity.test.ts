/**
 * DE431 chunk fidelity: NJCE chunks built by packages/ephe-long/scripts/build-chunks.mjs
 * must reproduce the source kernel exactly (coefficients are copied, not re-fitted).
 *
 * Opt-in — needs the 3.4 GB kernel and a chunk build:
 *   DE431_BSP_PATH=/path/de431t.bsp NJCE_DIR=/path/to/chunks pnpm test -- de431-fidelity
 * NJCE_DIR defaults to packages/ephe-long/dist. Skipped when either is missing.
 *
 * The reference side reads DE431 Type-2 records with positional reads (the kernel
 * exceeds Node's 2 GiB readFileSync limit, so SpkFile cannot load it).
 */
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { evalRecord, type Vec3 } from '../../src/engine/chebyshev.js';
import { NAIF } from '../../src/engine/spk.js';
import {
    De431ChunkFile,
    De431LongEphemerisProvider,
    DE431_LONG_JD_TDB_END,
    DE431_LONG_JD_TDB_START,
} from '../../src/engine/provider/de431-chunk.js';
import { jdTdbToEt } from '../../src/engine/provider/time.js';
import { julianDayUt } from '../../src/time/historical.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
    readFileSync(join(here, '../fixtures/de431-sample-points.json'), 'utf8'),
) as {
    toleranceArcsec: number;
};
const de431Path = process.env.DE431_BSP_PATH;
const chunkDir = process.env.NJCE_DIR ?? join(here, '../../../ephe-long/dist');
const enabled = !!de431Path && existsSync(de431Path) && existsSync(join(chunkDir, 'g0-c19.njce'));

interface Seg {
    target: number;
    center: number;
    initAddr: number;
    init: number;
    intlen: number;
    rsize: number;
    n: number;
}

class DirectDe431 {
    private readonly fd: number;
    readonly segs: Seg[] = [];
    constructor(path: string) {
        this.fd = openSync(path, 'r');
        const rec = this.read(0, 1024);
        let next = rec.readInt32LE(76);
        while (next) {
            const s = this.read((next - 1) * 1024, 1024);
            next = Math.round(s.readDoubleLE(0));
            const count = Math.round(s.readDoubleLE(16));
            for (let i = 0; i < count; i++) {
                const o = 24 + i * 40;
                if (s.readInt32LE(o + 28) !== 2) continue;
                const finalAddr = s.readInt32LE(o + 36);
                const meta = this.read((finalAddr - 4) * 8, 32);
                this.segs.push({
                    target: s.readInt32LE(o + 16),
                    center: s.readInt32LE(o + 20),
                    initAddr: s.readInt32LE(o + 32),
                    init: meta.readDoubleLE(0),
                    intlen: meta.readDoubleLE(8),
                    rsize: Math.round(meta.readDoubleLE(16)),
                    n: Math.round(meta.readDoubleLE(24)),
                });
            }
        }
    }
    private read(pos: number, len: number): Buffer {
        const b = Buffer.alloc(len);
        readSync(this.fd, b, 0, len, pos);
        return b;
    }
    state(target: number, center: number, et: number): Vec3 {
        const seg = this.segs.find(
            (s) =>
                s.target === target &&
                s.center === center &&
                et >= s.init &&
                et <= s.init + s.n * s.intlen,
        );
        if (!seg) throw new Error(`no segment ${target}/${center}`);
        const idx = Math.min(seg.n - 1, Math.floor((et - seg.init) / seg.intlen));
        const raw = this.read((seg.initAddr - 1) * 8 + idx * seg.rsize * 8, seg.rsize * 8);
        const rec = new Float64Array(seg.rsize);
        for (let i = 0; i < seg.rsize; i++) rec[i] = raw.readDoubleLE(i * 8);
        return evalRecord(rec, et);
    }
    barycentric(body: number, et: number): Vec3 {
        if (body === NAIF.Moon || body === NAIF.Earth) {
            const emb = this.state(NAIF.EMB, NAIF.SSB, et);
            const rel = this.state(body, NAIF.EMB, et);
            return {
                x: emb.x + rel.x,
                y: emb.y + rel.y,
                z: emb.z + rel.z,
                vx: emb.vx + rel.vx,
                vy: emb.vy + rel.vy,
                vz: emb.vz + rel.vz,
            };
        }
        return this.state(body, NAIF.SSB, et);
    }
    close(): void {
        closeSync(this.fd);
    }
}

function arcsec(a: Vec3, b: Vec3): number {
    return (
        (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / Math.hypot(a.x, a.y, a.z)) *
        206264.80624709636
    );
}

const BODIES = [
    NAIF.Sun,
    NAIF.Mercury,
    NAIF.Venus,
    NAIF.EMB,
    NAIF.Earth,
    NAIF.Moon,
    NAIF.Mars,
    NAIF.Jupiter,
    NAIF.Saturn,
    NAIF.Uranus,
    NAIF.Neptune,
    NAIF.Pluto,
];

(enabled ? describe : describe.skip)('DE431 chunk fidelity (DE431_BSP_PATH + built chunks)', () => {
    const files = new Map<string, De431ChunkFile>();
    const getChunk = (c: number, g: number): De431ChunkFile | undefined => {
        const key = `${g}:${c}`;
        if (!files.has(key)) {
            const p = join(chunkDir, `g${g}-c${c}.njce`);
            if (!existsSync(p)) return undefined;
            files.set(key, new De431ChunkFile(readFileSync(p)));
            if (files.size > 8) files.delete(files.keys().next().value as string);
        }
        return files.get(key);
    };
    const provider = new De431LongEphemerisProvider(getChunk);
    let direct: DirectDe431;
    beforeAll(() => {
        direct = new DirectDe431(de431Path as string);
    });
    afterAll(() => direct?.close());

    test('random instants across -9999..9999 match the kernel', () => {
        let seed = 431;
        const rnd = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        let worst = 0;
        for (let i = 0; i < 400; i++) {
            const jd =
                DE431_LONG_JD_TDB_START + rnd() * (DE431_LONG_JD_TDB_END - DE431_LONG_JD_TDB_START);
            const et = jdTdbToEt(jd);
            for (const body of BODIES) {
                worst = Math.max(
                    worst,
                    arcsec(direct.barycentric(body, et), provider.state(jd, body, 'barycentric')),
                );
            }
        }
        expect(worst).toBeLessThan(fixture.toleranceArcsec);
    });

    test('century boundaries (both sides) resolve and match', () => {
        for (const year of [-9900, -5000, -100, 0, 100, 1500, 1600, 5000, 9900]) {
            const jd0 = julianDayUt({
                astronomicalYear: year,
                month: 1,
                day: 1,
                hour: 0,
                minute: 0,
                second: 0,
            });
            for (const jd of [jd0 - 1e-6, jd0, jd0 + 1e-6]) {
                const et = jdTdbToEt(jd);
                for (const body of [NAIF.Moon, NAIF.Mercury, NAIF.Sun]) {
                    expect(
                        arcsec(
                            direct.barycentric(body, et),
                            provider.state(jd, body, 'barycentric'),
                        ),
                    ).toBeLessThan(fixture.toleranceArcsec);
                }
            }
        }
    });
});
