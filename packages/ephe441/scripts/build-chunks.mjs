/**
 * Build NJCE chunks from JPL DE441 part-1 + part-2 (U.S. Government work, public domain).
 *
 * Kernels (NAIF generic_kernels mirror):
 *   de441_part-1.bsp  JD -3100015.5 .. 2440432.5  (1.65 GB)
 *   de441_part-2.bsp  JD  2440400.5 .. 8000016.5  (1.66 GB)
 *
 * Environment:
 *   DE441_PART1_PATH / DE441_PART2_PATH  existing kernels (skip download)
 *   NJCE_OUT_DIR    output directory (default packages/ephe441/dist)
 *   NJCE_CENTURIES  optional "min:max" century-index range (default -100:100)
 */

import {
    closeSync,
    createWriteStream,
    existsSync,
    mkdirSync,
    openSync,
    readSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'fs';
import { get as httpsGet } from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.NJCE_OUT_DIR ?? join(__dirname, '..', 'dist');
const DE441_PART1_URL =
    'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-1.bsp';
const DE441_PART2_URL =
    'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-2.bsp';
const DE441_PART1_PATH =
    process.env.DE441_PART1_PATH ?? join(__dirname, '..', '.cache', 'de441_part-1.bsp');
const DE441_PART2_PATH =
    process.env.DE441_PART2_PATH ?? join(__dirname, '..', '.cache', 'de441_part-2.bsp');
const DE441_PART1_BYTES = 1_651_119_104;
const DE441_PART2_BYTES = 1_656_830_976;

const NJCE_MAGIC = 0x45434a4e;
const NJCE_VERSION = 1;
const J2000_JD = 2451545.0;
const SECONDS_PER_DAY = 86400;

const BODY_GROUP_PLANETS = 0;
const BODY_GROUP_EMB = 1;
const SSB = 0;
const EMB = 3;

/** [target, center] pairs per group (NAIF ids). */
const GROUPS = [
    [BODY_GROUP_PLANETS, [1, 2, 4, 5, 6, 7, 8, 9, 10].map((t) => [t, SSB])],
    [
        BODY_GROUP_EMB,
        [
            [EMB, SSB],
            [301, EMB],
            [399, EMB],
        ],
    ],
];

/** JD at 0h of a civil date; proleptic Julian before 1582-10-15 (same rule as core/time/historical.ts). */
function julianDayAstro(year, month, day) {
    let y = year;
    let m = month;
    if (m <= 2) {
        y -= 1;
        m += 12;
    }
    const greg = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
    const A = greg ? Math.floor(y / 100) : 0;
    const B = greg ? 2 - A + Math.floor(A / 4) : 0;
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

const jdToEt = (jd) => (jd - J2000_JD) * SECONDS_PER_DAY;

/**
 * TT Julian-day limits advertised by @node-jhora/core (chunk-coverage.ts).
 * Recompute after changing EPHEMERIS_JD_UT_* or ΔT models:
 *   node --input-type=module -e "import { NJCE_TT_JD_MIN_REQUIRED, NJCE_TT_JD_MAX_REQUIRED } from './packages/core/dist/engine/provider/chunk-coverage.js'; console.log(NJCE_TT_JD_MIN_REQUIRED, NJCE_TT_JD_MAX_REQUIRED)"
 */
const NJCE_TT_JD_MIN_REQUIRED = -1_931_440.605_619_693;
const NJCE_TT_JD_MAX_REQUIRED = 5_373_856.151_148_088; // sync with core chunk-coverage.ts after bounds change

function centuryRange(centuryIndex) {
    return {
        etStart: jdToEt(julianDayAstro(centuryIndex * 100, 1, 1)),
        etEnd: jdToEt(julianDayAstro(centuryIndex * 100 + 100, 1, 1)),
    };
}

/** ET slice bounds for one century file, extended at the global TT edges. */
function centurySliceRange(centuryIndex, minCent, maxCent) {
    const { etStart, etEnd } = centuryRange(centuryIndex);
    const ttMinEt = jdToEt(NJCE_TT_JD_MIN_REQUIRED);
    const ttMaxEt = jdToEt(NJCE_TT_JD_MAX_REQUIRED);
    let start = etStart;
    let end = etEnd;
    if (centuryIndex === minCent) start = Math.min(start, ttMinEt);
    // High TT (10000-12-31 UT + ΔT + margin) can fall in the last two century files.
    if (centuryIndex >= maxCent - 1) end = Math.max(end, ttMaxEt);
    return { etStart: start, etEnd: end };
}

async function downloadPart(url, path, bytes, envName) {
    if (existsSync(path) && statSync(path).size === bytes) return;
    if (process.env[envName]) {
        throw new Error(`${envName}=${path} is missing or not ${bytes} bytes`);
    }
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.partial`;
    console.log(`[ephe441] Downloading ${url} → ${path} (${(bytes / 1e9).toFixed(2)} GB) …`);
    await new Promise((resolve, reject) => {
        const fetchUrl = (u, hops) =>
            httpsGet(u, (res) => {
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location &&
                    hops < 5
                ) {
                    res.resume();
                    fetchUrl(new URL(res.headers.location, u).toString(), hops + 1);
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode} for ${u}`));
                    return;
                }
                const file = createWriteStream(tmp);
                res.pipe(file);
                file.on('finish', resolve);
                file.on('error', reject);
            }).on('error', reject);
        fetchUrl(url, 0);
    });
    if (statSync(tmp).size !== bytes) {
        rmSync(tmp, { force: true });
        throw new Error(`DE441 download truncated: ${path}`);
    }
    renameSync(tmp, path);
}

async function downloadDe441() {
    await downloadPart(DE441_PART1_URL, DE441_PART1_PATH, DE441_PART1_BYTES, 'DE441_PART1_PATH');
    await downloadPart(DE441_PART2_URL, DE441_PART2_PATH, DE441_PART2_BYTES, 'DE441_PART2_PATH');
}

/** Minimal positional DAF/SPK reader (little-endian kernels only). */
class DafReader {
    constructor(path) {
        this.fd = openSync(path, 'r');
        const rec = this.read(0, 1024);
        const idword = rec.toString('latin1', 0, 8);
        if (!idword.startsWith('DAF/SPK')) throw new Error(`not an SPK file: ${idword}`);
        if (rec.toString('latin1', 88, 96) !== 'LTL-IEEE')
            throw new Error('only LTL-IEEE kernels supported');
        const nd = rec.readInt32LE(8);
        const ni = rec.readInt32LE(12);
        if (nd !== 2 || ni !== 6) throw new Error(`unexpected ND/NI ${nd}/${ni}`);
        let next = rec.readInt32LE(76);
        this.segments = [];
        while (next) {
            const s = this.read((next - 1) * 1024, 1024);
            next = Math.round(s.readDoubleLE(0));
            const n = Math.round(s.readDoubleLE(16));
            for (let i = 0; i < n; i++) {
                const o = 24 + i * 40;
                const seg = {
                    startET: s.readDoubleLE(o),
                    endET: s.readDoubleLE(o + 8),
                    target: s.readInt32LE(o + 16),
                    center: s.readInt32LE(o + 20),
                    frame: s.readInt32LE(o + 24),
                    type: s.readInt32LE(o + 28),
                    initAddr: s.readInt32LE(o + 32),
                    finalAddr: s.readInt32LE(o + 36),
                };
                if (seg.type === 2) {
                    const meta = this.read((seg.finalAddr - 4) * 8, 32);
                    seg.init = meta.readDoubleLE(0);
                    seg.intlen = meta.readDoubleLE(8);
                    seg.rsize = Math.round(meta.readDoubleLE(16));
                    seg.n = Math.round(meta.readDoubleLE(24));
                }
                this.segments.push(seg);
            }
        }
    }
    read(pos, len) {
        const b = Buffer.allocUnsafe(len);
        let got = 0;
        while (got < len) {
            const r = readSync(this.fd, b, got, len - got, pos + got);
            if (r === 0) throw new Error('unexpected EOF');
            got += r;
        }
        return b;
    }
    /** Records of `seg` overlapping [etStart, etEnd], with one record of margin. */
    slice(seg, etStart, etEnd) {
        const i0 = Math.max(0, Math.floor((etStart - seg.init) / seg.intlen) - 1);
        const i1 = Math.min(seg.n, Math.ceil((etEnd - seg.init) / seg.intlen) + 1);
        const n = i1 - i0;
        const raw = this.read((seg.initAddr - 1) * 8 + i0 * seg.rsize * 8, n * seg.rsize * 8);
        const data = new Float64Array(n * seg.rsize);
        for (let i = 0; i < data.length; i++) data[i] = raw.readDoubleLE(i * 8);
        return {
            target: seg.target,
            center: seg.center,
            init: seg.init + i0 * seg.intlen,
            intlen: seg.intlen,
            rsize: seg.rsize,
            n,
            data,
        };
    }
    close() {
        closeSync(this.fd);
    }
}

function encodeChunk(centuryIndex, groupId, payloads) {
    let size = 18;
    for (const p of payloads) size = ((size + 32 + 7) & ~7) + p.data.byteLength;
    const buf = new ArrayBuffer(size);
    const view = new DataView(buf);
    let off = 0;
    view.setUint32(off, NJCE_MAGIC, true);
    off += 4;
    view.setUint16(off, NJCE_VERSION, true);
    off += 2;
    view.setInt32(off, centuryIndex, true);
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
        for (let i = 0; i < p.data.length; i++) {
            view.setFloat64(off, p.data[i], true);
            off += 8;
        }
    }
    return Buffer.from(buf, 0, off);
}

async function main() {
    await downloadDe441();
    const daf1 = new DafReader(DE441_PART1_PATH);
    const daf2 = new DafReader(DE441_PART2_PATH);
    const dafs = [daf1, daf2];
    mkdirSync(OUT_DIR, { recursive: true });

    const [minCent, maxCent] = (process.env.NJCE_CENTURIES ?? '-100:100').split(':').map(Number);
    let totalBytes = 0;
    let fileCount = 0;
    const perGroup = new Map();

    for (let cent = minCent; cent <= maxCent; cent++) {
        const { etStart, etEnd } = centurySliceRange(cent, minCent, maxCent);
        for (const [groupId, pairs] of GROUPS) {
            const payloads = [];
            for (const [target, center] of pairs) {
                let found = false;
                for (const daf of dafs) {
                    const segs = daf.segments.filter(
                        (s) =>
                            s.type === 2 &&
                            s.target === target &&
                            s.center === center &&
                            s.endET >= etStart &&
                            s.startET <= etEnd,
                    );
                    if (segs.length === 0) continue;
                    found = true;
                    for (const seg of segs) payloads.push(daf.slice(seg, etStart, etEnd));
                }
                if (!found)
                    throw new Error(`no DE441 segment for ${target}/${center} in century ${cent}`);
            }
            const bytes = encodeChunk(cent, groupId, payloads);
            writeFileSync(join(OUT_DIR, `g${groupId}-c${cent}.njce`), bytes);
            totalBytes += bytes.byteLength;
            fileCount += 1;
            perGroup.set(groupId, (perGroup.get(groupId) ?? 0) + bytes.byteLength);
        }
    }
    daf1.close();
    daf2.close();

    const centuries = maxCent - minCent + 1;
    console.log(
        `[ephe441] Wrote ${fileCount} chunks (${centuries} centuries), ` +
            `${(totalBytes / 1e6).toFixed(2)} MB total → ${OUT_DIR}`,
    );
    for (const [g, b] of perGroup) {
        console.log(
            `[ephe441]   group g${g}: ${(b / 1e6).toFixed(2)} MB, ${(b / centuries / 1e6).toFixed(3)} MB/century`,
        );
    }
    console.log(
        `[ephe441]   per century (both groups): ${(totalBytes / centuries / 1e6).toFixed(3)} MB`,
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
