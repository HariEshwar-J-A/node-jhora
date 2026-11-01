/**
 * Chebyshev direct-index identity (server-grade PR3).
 *
 * Ensures `evalRecordAtS` matches the legacy coefficient-slice path (Array.from
 * + evalCheby / evalChebyDeriv) at ≥200 ephemeris times spanning DE440s SPK
 * segment record boundaries, optional DE431/DE441 NJCE chunks, and spread samples.
 *
 * getPlanets SHA-256 fingerprints (longitude, latitude, speed per body) for
 * jhora / modern / truth are pinned in `../fixtures/chebyshev-identity-planets.json`.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import {
    evalCheby,
    evalChebyDeriv,
    evalRecordAtS,
    evalRecordAtSInto,
    type Vec3,
} from '../../src/engine/chebyshev.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START } from '../../src/engine/provider/de440s.js';
import { etToJdTdb, jdTdbToEt } from '../../src/engine/provider/time.js';
import { loadSpkFromBytes, NAIF, resetSpkCache } from '../../src/engine/spk.js';

const MIN_SAMPLES = 200;
const FIXTURE_PATH = join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../fixtures/chebyshev-identity-planets.json',
);

function float64Hex(n: number): string {
    const buf = Buffer.allocUnsafe(8);
    buf.writeDoubleLE(n, 0);
    return buf.toString('hex');
}

function vec3Hex(v: Vec3): string {
    return [v.x, v.y, v.z, v.vx, v.vy, v.vz].map(float64Hex).join(':');
}

/** Legacy main-branch path: three Array.from slices per record. */
function evalRecordAtSLegacy(out: Vec3, record: Float64Array | number[], s: number): void {
    const radius = record[1]!;
    const nCoeff = (record.length - 2) / 3;
    const xC = Array.from({ length: nCoeff }, (_, i) => record[2 + i]!);
    const yC = Array.from({ length: nCoeff }, (_, i) => record[2 + nCoeff + i]!);
    const zC = Array.from({ length: nCoeff }, (_, i) => record[2 + 2 * nCoeff + i]!);

    out.x = evalCheby(xC, s);
    out.y = evalCheby(yC, s);
    out.z = evalCheby(zC, s);
    out.vx = evalChebyDeriv(xC, s) / radius;
    out.vy = evalChebyDeriv(yC, s) / radius;
    out.vz = evalChebyDeriv(zC, s) / radius;
}

interface RecordSample {
    label: string;
    record: number[] | Float64Array;
    s: number;
}

interface SegmentMeta {
    init: number;
    intlen: number;
    n: number;
    rsize: number;
    data: Float64Array;
}

function recordMidpointEt(seg: SegmentMeta, recordIdx: number): number {
    return seg.init + recordIdx * seg.intlen + seg.intlen / 2;
}

function firstLastRecordSamples(seg: SegmentMeta, labelPrefix: string): RecordSample[] {
    const out: RecordSample[] = [];
    for (const idx of [0, seg.n - 1]) {
        const et = recordMidpointEt(seg, idx);
        const mid = seg.init + idx * seg.intlen + seg.intlen / 2;
        const radius = seg.intlen / 2;
        const s = (et - mid) / radius;
        const start = idx * seg.rsize;
        const coeffs = seg.data.subarray(start, start + seg.rsize);
        out.push({
            label: `${labelPrefix} record ${idx} (number[])`,
            record: Array.from(coeffs),
            s,
        });
        out.push({
            label: `${labelPrefix} record ${idx} (Float64Array)`,
            record: coeffs,
            s,
        });
    }
    return out;
}

function parseNjceSegments(buf: ArrayBuffer): SegmentMeta[] {
    const view = new DataView(buf);
    let off = 0;
    off += 4;
    off += 2;
    off += 4;
    off += 4;
    const numSeg = view.getUint32(off, true);
    off += 4;
    const segments: SegmentMeta[] = [];
    for (let s = 0; s < numSeg; s++) {
        off += 8;
        const init = view.getFloat64(off, true);
        off += 8;
        const intlen = view.getFloat64(off, true);
        off += 8;
        const rsize = view.getUint32(off, true);
        off += 4;
        const n = view.getUint32(off, true);
        off += 4;
        off = (off + 7) & ~7;
        const total = n * rsize;
        const data = new Float64Array(total);
        for (let i = 0; i < total; i++) {
            data[i] = view.getFloat64(off, true);
            off += 8;
        }
        segments.push({ init, intlen, n, rsize, data });
    }
    return segments;
}

function resolveBsp(): string {
    if (process.env.NODE_JHORA_EPHE_PATH && existsSync(process.env.NODE_JHORA_EPHE_PATH)) {
        return process.env.NODE_JHORA_EPHE_PATH;
    }
    try {
        const req = createRequire(import.meta.url);
        const pkg = req.resolve('@node-jhora/ephe/package.json');
        return join(pkg, '..', 'de440s.bsp');
    } catch {
        return join(fileURLToPath(new URL('../../../ephe/de440s.bsp', import.meta.url)));
    }
}

function collectDe440sSamples(): RecordSample[] {
    resetSpkCache();
    const bytes = readFileSync(resolveBsp());
    const spk = loadSpkFromBytes(new Uint8Array(bytes));
    const samples: RecordSample[] = [];

    for (const seg of spk.segmentList) {
        if (seg.type !== 2) continue;
        const payload = spk.readType2SegmentPayload(seg);
        const meta: SegmentMeta = {
            init: payload.init,
            intlen: payload.intlen,
            n: payload.n,
            rsize: payload.rsize,
            data: payload.data,
        };
        samples.push(...firstLastRecordSamples(meta, `de440s t${seg.target}/c${seg.center}`));
    }

    const spreadDays = 200;
    const step = (DE440S_JD_TDB_END - DE440S_JD_TDB_START) / (spreadDays + 1);
    for (let i = 1; i <= spreadDays; i++) {
        const jd = DE440S_JD_TDB_START + i * step;
        const et = jdTdbToEt(jd);
        const sunSeg = spk.segmentList.find(
            (s) => s.type === 2 && s.target === NAIF.Sun && s.center === NAIF.SSB,
        );
        if (!sunSeg) continue;
        const payload = spk.readType2SegmentPayload(sunSeg);
        let recordIdx = Math.floor((et - payload.init) / payload.intlen);
        recordIdx = Math.max(0, Math.min(recordIdx, payload.n - 1));
        const mid = payload.init + recordIdx * payload.intlen + payload.intlen / 2;
        const s = (et - mid) / (payload.intlen / 2);
        const start = recordIdx * payload.rsize;
        const record = Array.from(payload.data.subarray(start, start + payload.rsize));
        samples.push({ label: `de440s spread jdTdb=${jd.toFixed(4)}`, record, s });
    }

    return samples;
}

function collectNjceDirSamples(dir: string, tag: string): RecordSample[] {
    if (!existsSync(dir)) return [];
    const samples: RecordSample[] = [];
    for (const name of readdirSync(dir)) {
        if (!name.endsWith('.njce')) continue;
        const fileBuf = readFileSync(join(dir, name));
        const segments = parseNjceSegments(
            fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength),
        );
        for (const seg of segments) {
            samples.push(...firstLastRecordSamples(seg, `${tag} ${name}`));
        }
    }
    return samples;
}

function collectJulianDayUtSamples(): number[] {
    const jds = new Set<number>();
    jds.add(2459205.034722222);

    const spreadCount = 200;
    const step = (DE440S_JD_TDB_END - DE440S_JD_TDB_START) / (spreadCount + 1);
    for (let i = 1; i <= spreadCount; i++) {
        jds.add(DE440S_JD_TDB_START + i * step);
    }

    resetSpkCache();
    const spk = loadSpkFromBytes(new Uint8Array(readFileSync(resolveBsp())));
    for (const seg of spk.segmentList) {
        if (seg.type !== 2) continue;
        const p = spk.readType2SegmentPayload(seg);
        for (const idx of [0, p.n - 1]) {
            jds.add(etToJdTdb(p.init + idx * p.intlen + p.intlen / 2));
        }
    }

    const njce431 =
        process.env.NJCE_DIR ??
        join(fileURLToPath(new URL('../../../ephe-long/dist', import.meta.url)));
    const njce441 =
        process.env.NJCE441_DIR ??
        join(fileURLToPath(new URL('../../../ephe441/dist', import.meta.url)));

    for (const dir of [njce431, njce441]) {
        if (!existsSync(dir)) continue;
        for (const name of readdirSync(dir)) {
            if (!name.endsWith('.njce')) continue;
            const fileBuf = readFileSync(join(dir, name));
            for (const seg of parseNjceSegments(
                fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength),
            )) {
                for (const idx of [0, seg.n - 1]) {
                    jds.add(etToJdTdb(recordMidpointEt(seg, idx)));
                }
            }
        }
    }

    return [...jds];
}

function utcFromJulianDayUt(jdUt: number): DateTime {
    return DateTime.fromMillis((jdUt - 2440587.5) * 86400000, { zone: 'utc' });
}

function planetsFingerprint(planets: ReturnType<EphemerisEngine['getPlanets']>): string {
    const parts = planets
        .map(
            (p) =>
                `${p.name}:${float64Hex(p.longitude)}:${float64Hex(p.latitude)}:${float64Hex(p.speed)}`,
        )
        .sort();
    return createHash('sha256').update(parts.join('\n')).digest('hex');
}

const PROFILE_OPTS = [
    { key: 'jhora' as const, precisionProfile: 'jhora' as const },
    { key: 'modern' as const, precisionProfile: 'modern' as const },
    { key: 'truth' as const, precisionProfile: 'truth' as const },
];

type PlanetFixture = {
    schemaVersion: 1;
    entries: Array<{ jdUt: number; jhora: string; modern: string; truth: string }>;
};

function buildPlanetFixture(engine: EphemerisEngine, jdList: number[]): PlanetFixture {
    const entries: PlanetFixture['entries'] = [];
    for (const jdUt of jdList) {
        const utc = utcFromJulianDayUt(jdUt);
        const row: PlanetFixture['entries'][number] = { jdUt, jhora: '', modern: '', truth: '' };
        for (const { key, precisionProfile } of PROFILE_OPTS) {
            const planets = engine.getPlanets(utc, undefined, {
                precisionProfile,
                ayanamsaOrder: 27,
                nodeType: 'true',
                positionMode: 'geometric',
                julianDayUt: jdUt,
            });
            row[key] = planetsFingerprint(planets);
        }
        entries.push(row);
    }
    entries.sort((a, b) => a.jdUt - b.jdUt);
    return { schemaVersion: 1, entries };
}

describe('Chebyshev evalRecordAtS direct-index identity', () => {
    let samples: RecordSample[];

    beforeAll(() => {
        samples = collectDe440sSamples();
        const njce431 =
            process.env.NJCE_DIR ??
            join(fileURLToPath(new URL('../../../ephe-long/dist', import.meta.url)));
        const njce441 =
            process.env.NJCE441_DIR ??
            join(fileURLToPath(new URL('../../../ephe441/dist', import.meta.url)));
        samples.push(...collectNjceDirSamples(njce431, 'de431-njce'));
        samples.push(...collectNjceDirSamples(njce441, 'de441-njce'));
    });

    test(`at least ${MIN_SAMPLES} coefficient record samples`, () => {
        expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);
    });

    test('evalRecordAtS matches legacy Array.from slices on every sample', () => {
        const prod: Vec3 = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
        const legacy: Vec3 = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
        for (const sample of samples) {
            evalRecordAtSInto(prod, sample.record, sample.s);
            evalRecordAtSLegacy(legacy, sample.record, sample.s);
            expect(vec3Hex(prod)).toBe(vec3Hex(legacy));
            const got = evalRecordAtS(sample.record, sample.s);
            expect(got.x).toBe(legacy.x);
            expect(got.y).toBe(legacy.y);
            expect(got.z).toBe(legacy.z);
            expect(got.vx).toBe(legacy.vx);
            expect(got.vy).toBe(legacy.vy);
            expect(got.vz).toBe(legacy.vz);
        }
    });
});

describe('Chebyshev identity — getPlanets fingerprints (jhora, modern, truth)', () => {
    let engine: EphemerisEngine;
    let fixture: PlanetFixture;

    beforeAll(async () => {
        resetSpkCache();
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
        const jdList = collectJulianDayUtSamples();
        expect(jdList.length).toBeGreaterThanOrEqual(MIN_SAMPLES);

        if (process.env.WRITE_CHEBYSHEV_IDENTITY_FIXTURE === '1') {
            const generated = buildPlanetFixture(engine, jdList);
            writeFileSync(FIXTURE_PATH, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
        }

        fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as PlanetFixture;
    });

    test('fixture covers at least 200 Julian days', () => {
        expect(fixture.entries.length).toBeGreaterThanOrEqual(MIN_SAMPLES);
    });

    test('getPlanets hex fingerprints match committed fixture', () => {
        for (const expected of fixture.entries) {
            const utc = utcFromJulianDayUt(expected.jdUt);
            for (const { key, precisionProfile } of PROFILE_OPTS) {
                const planets = engine.getPlanets(utc, undefined, {
                    precisionProfile,
                    ayanamsaOrder: 27,
                    nodeType: 'true',
                    positionMode: 'geometric',
                    julianDayUt: expected.jdUt,
                });
                expect(planetsFingerprint(planets)).toBe(expected[key]);
            }
        }
    });
});
