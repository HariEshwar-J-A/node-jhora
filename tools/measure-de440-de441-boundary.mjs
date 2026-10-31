#!/usr/bin/env node
/**
 * Measure barycentric position differences DE440s vs DE441 at DE440s coverage edges
 * and at the DE441 part-1 / part-2 overlap stitch (~1969).
 *
 * Requires local BSP files (never committed):
 *   de440s.bsp — NODE_JHORA_EPHE_PATH or @node-jhora/ephe
 *   de441_part-2.bsp — DE441_PART2_PATH (covers 1849–2150 along with part-1)
 *   de441_part-1.bsp — DE441_PART1_PATH (for part stitch check)
 *
 * Writes JSON to stdout or MEASURE_OUT path.
 */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalRecord } from '../packages/core/dist/engine/chebyshev.js';
import { NAIF } from '../packages/core/dist/engine/spk.js';

const J2000_JD = 2451545.0;
const SECONDS_PER_DAY = 86400;
const jdToEt = (jd) => (jd - J2000_JD) * SECONDS_PER_DAY;

function md5File(path) {
    return createHash('md5').update(readFileSync(path)).digest('hex');
}

function resolveDe440s() {
    if (process.env.NODE_JHORA_EPHE_PATH) return process.env.NODE_JHORA_EPHE_PATH;
    try {
        const req = createRequire(import.meta.url);
        const pkg = req.resolve('@node-jhora/ephe/package.json');
        return join(dirname(pkg), 'de440s.bsp');
    } catch {
        return join(dirname(fileURLToPath(import.meta.url)), '../packages/ephe/de440s.bsp');
    }
}

class DirectSpk {
    constructor(path) {
        this.fd = openSync(path, 'r');
        this.segs = [];
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
    read(pos, len) {
        const b = Buffer.alloc(len);
        readSync(this.fd, b, 0, len, pos);
        return b;
    }
    state(target, center, et) {
        const seg = this.segs.find(
            (s) =>
                s.target === target &&
                s.center === center &&
                et >= s.init &&
                et <= s.init + s.n * s.intlen,
        );
        if (!seg) throw new Error(`no segment ${target}/${center} at ET=${et}`);
        const idx = Math.min(seg.n - 1, Math.floor((et - seg.init) / seg.intlen));
        const raw = this.read((seg.initAddr - 1) * 8 + idx * seg.rsize * 8, seg.rsize * 8);
        const rec = new Float64Array(seg.rsize);
        for (let i = 0; i < seg.rsize; i++) rec[i] = raw.readDoubleLE(i * 8);
        return evalRecord(rec, et);
    }
    barycentric(body, et) {
        if (body === NAIF.Moon || body === NAIF.Earth) {
            const emb = this.state(NAIF.EMB, NAIF.SSB, et);
            const rel = this.state(body, NAIF.EMB, et);
            return {
                x: emb.x + rel.x,
                y: emb.y + rel.y,
                z: emb.z + rel.z,
            };
        }
        return this.state(body, NAIF.SSB, et);
    }
    close() {
        closeSync(this.fd);
    }
}

function arcsec(a, b) {
    const r = Math.hypot(a.x, a.y, a.z);
    return (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / r) * 206264.80624709636;
}

const de440sPath = resolveDe440s();
const part1 = process.env.DE441_PART1_PATH;
const part2 = process.env.DE441_PART2_PATH;
if (!existsSync(de440sPath)) {
    console.error(`missing de440s: ${de440sPath}`);
    process.exit(1);
}
if (!part1 || !existsSync(part1)) {
    console.error('set DE441_PART1_PATH to de441_part-1.bsp');
    process.exit(1);
}
if (!part2 || !existsSync(part2)) {
    console.error('set DE441_PART2_PATH to de441_part-2.bsp');
    process.exit(1);
}

const DE440S_JD_START = 2396752.5;
const DE440S_JD_END = 2506352.5;
const PART_STITCH_JD = 2440416.5;

const bodies = [
    ['Sun', NAIF.Sun],
    ['Moon', NAIF.Moon],
    ['Mercury', NAIF.Mercury],
    ['Mars', NAIF.Mars],
];

const de440 = new DirectSpk(de440sPath);
const de441p1 = new DirectSpk(part1);
const de441p2 = new DirectSpk(part2);

/** NAIF split: part-1 through 2440432.5, part-2 from 2440400.5 (overlap ~1969). */
const DE441_PART2_JD_START = 2440400.5;

function de441ForJd(jd) {
    return jd >= DE441_PART2_JD_START ? de441p2 : de441p1;
}

const report = {
    measuredAt: new Date().toISOString(),
    measuredBy: 'tools/measure-de440-de441-boundary.mjs',
    provenance: {
        de440s: {
            path: de440sPath,
            bytes: statSync(de440sPath).size,
            md5: md5File(de440sPath),
        },
        de441_part2: {
            path: part2,
            bytes: statSync(part2).size,
            md5: md5File(part2),
        },
        de441_part1: {
            path: part1,
            bytes: statSync(part1).size,
            md5: md5File(part1),
        },
    },
    de440sBoundaryArcsec: [],
    partStitchArcsec: [],
};

const labels = {
    [DE440S_JD_START]: 'DE440s start 1849-12-26',
    [DE440S_JD_END]: 'DE440s end 2150-01-22',
    [2451545.0]: 'J2000.0',
};

for (const jd of [DE440S_JD_START, DE440S_JD_END, 2451545.0]) {
    const et = jdToEt(jd);
    for (const [name, id] of bodies) {
        const d0 = de440.barycentric(id, et);
        const d1 = de441ForJd(jd).barycentric(id, et);
        report.de440sBoundaryArcsec.push({
            jdTdb: jd,
            label: labels[jd],
            body: name,
            deltaArcsec: arcsec(d0, d1),
        });
    }
}

if (de441p1) {
    const et = jdToEt(PART_STITCH_JD);
    for (const [name, id] of bodies) {
        const a = de441p1.barycentric(id, et);
        const b = de441p2.barycentric(id, et);
        report.partStitchArcsec.push({
            jdTdb: PART_STITCH_JD,
            label: 'DE441 part-1 / part-2 overlap mid-1969',
            body: name,
            deltaArcsec: arcsec(a, b),
        });
    }
}

de440.close();
de441p1.close();
de441p2.close();

const out = process.env.MEASURE_OUT;
const json = JSON.stringify(report, null, 2);
if (out) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(out, json);
    console.error(`wrote ${out}`);
} else {
    console.log(json);
}
