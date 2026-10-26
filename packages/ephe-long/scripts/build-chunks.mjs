/**
 * Build NJCE chunks from JPL DE431 (U.S. Government work, public domain).
 *
 * Never commit the kernel or the generated chunks. The kernel is published as
 *   https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de431t.bsp   (3.44 GB)
 *
 * The kernel is larger than Node's 2 GiB `readFileSync` limit, so this script
 * reads the DAF/SPK structure (NAIF "DAF Required Reading", "SPK Required
 * Reading", Type 2) with positional reads and copies, for each century, only
 * the Chebyshev records that overlap that century (plus one record of margin
 * on each side). Coefficients are copied verbatim — no re-fitting.
 *
 * Environment:
 *   DE431_BSP_PATH  existing kernel (skips the download)
 *   NJCE_OUT_DIR    output directory (default packages/ephe-long/dist)
 *   NJCE_CENTURIES  optional "min:max" century-index range (default -100:99)
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
const DE431_URL = 'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de431t.bsp';
const DE431_PATH = process.env.DE431_BSP_PATH ?? join(__dirname, '..', '.cache', 'de431t.bsp');
const DE431_BYTES = 3696366592;

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

function centuryRange(centuryIndex) {
    return {
        etStart: jdToEt(julianDayAstro(centuryIndex * 100, 1, 1)),
        etEnd: jdToEt(julianDayAstro(centuryIndex * 100 + 100, 1, 1)),
    };
}

async function downloadDe431() {
    if (existsSync(DE431_PATH) && statSync(DE431_PATH).size === DE431_BYTES) return;
    if (process.env.DE431_BSP_PATH) {
        throw new Error(`DE431_BSP_PATH=${DE431_PATH} is missing or not ${DE431_BYTES} bytes`);
    }
    mkdirSync(dirname(DE431_PATH), { recursive: true });
    const tmp = `${DE431_PATH}.partial`;
    console.log(`[ephe-long] Downloading ${DE431_URL} → ${DE431_PATH} (3.4 GB) …`);
    await new Promise((resolve, reject) => {
        const fetchUrl = (url, hops) =>
            httpsGet(url, (res) => {
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location &&
                    hops < 5
                ) {
                    res.resume();
                    fetchUrl(new URL(res.headers.location, url).toString(), hops + 1);
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                    return;
                }
                const file = createWriteStream(tmp);
                res.pipe(file);
                file.on('finish', resolve);
                file.on('error', reject);
            }).on('error', reject);
        fetchUrl(DE431_URL, 0);
    });
    if (statSync(tmp).size !== DE431_BYTES) {
        rmSync(tmp, { force: true });
        throw new Error('DE431 download truncated');
    }
    renameSync(tmp, DE431_PATH);
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
    await downloadDe431();
    const daf = new DafReader(DE431_PATH);
    mkdirSync(OUT_DIR, { recursive: true });

    const [minCent, maxCent] = (process.env.NJCE_CENTURIES ?? '-100:99').split(':').map(Number);
    let totalBytes = 0;
    let fileCount = 0;
    const perGroup = new Map();

    for (let cent = minCent; cent <= maxCent; cent++) {
        const { etStart, etEnd } = centuryRange(cent);
        for (const [groupId, pairs] of GROUPS) {
            const payloads = [];
            for (const [target, center] of pairs) {
                const segs = daf.segments.filter(
                    (s) =>
                        s.type === 2 &&
                        s.target === target &&
                        s.center === center &&
                        s.endET >= etStart &&
                        s.startET <= etEnd,
                );
                if (segs.length === 0)
                    throw new Error(`no DE431 segment for ${target}/${center} in century ${cent}`);
                for (const seg of segs) payloads.push(daf.slice(seg, etStart, etEnd));
            }
            const bytes = encodeChunk(cent, groupId, payloads);
            writeFileSync(join(OUT_DIR, `g${groupId}-c${cent}.njce`), bytes);
            totalBytes += bytes.byteLength;
            fileCount += 1;
            perGroup.set(groupId, (perGroup.get(groupId) ?? 0) + bytes.byteLength);
        }
    }
    daf.close();

    const centuries = maxCent - minCent + 1;
    console.log(
        `[ephe-long] Wrote ${fileCount} chunks (${centuries} centuries), ` +
            `${(totalBytes / 1e6).toFixed(2)} MB total → ${OUT_DIR}`,
    );
    for (const [g, b] of perGroup) {
        console.log(
            `[ephe-long]   group g${g}: ${(b / 1e6).toFixed(2)} MB, ${(b / centuries / 1e6).toFixed(3)} MB/century`,
        );
    }
    console.log(
        `[ephe-long]   per century (both groups): ${(totalBytes / centuries / 1e6).toFixed(3)} MB`,
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
