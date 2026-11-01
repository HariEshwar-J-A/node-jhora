/**
 * Parse IERS finals2000A.all and pack UT1−UTC + polar motion into eop.bin.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FINALS_NAME, LEAP_NAME, fetchEopSources } from './download.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAGIC = 0x4e4a454f; // 'NJEO'
const VERSION = 1;

/** 1-based column slices from readme.finals2000A (USNO). */
function slice(line, start, end) {
    return line.slice(start - 1, end).trim();
}

export function parseFinals2000A(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        if (line.length < 68) continue;
        if (!/^\d/.test(line)) continue;
        const mjd = Number.parseFloat(slice(line, 8, 15));
        if (!Number.isFinite(mjd)) continue;
        const xp = Number.parseFloat(slice(line, 19, 27));
        const yp = Number.parseFloat(slice(line, 38, 46));
        const ut1utc = Number.parseFloat(slice(line, 59, 68));
        if (![xp, yp, ut1utc].every(Number.isFinite)) continue;
        rows.push({ mjd, xpArcsec: xp, ypArcsec: yp, ut1UtcSec: ut1utc });
    }
    rows.sort((a, b) => a.mjd - b.mjd);
    return rows;
}

export function packEopBin(rows, meta) {
    const count = rows.length;
    const headerBytes = 4 + 4 + 4 + 4 + 32 + 32;
    const rowBytes = 4 + 2 + 2;
    const buf = Buffer.alloc(headerBytes + count * rowBytes);
    let o = 0;
    buf.writeUInt32LE(MAGIC, o);
    o += 4;
    buf.writeUInt32LE(VERSION, o);
    o += 4;
    buf.writeFloatLE(rows[0].mjd, o);
    o += 4;
    buf.writeUInt32LE(count, o);
    o += 4;
    Buffer.from(meta.finalsSha256, 'hex').copy(buf, o);
    o += 32;
    Buffer.from(meta.leapSha256, 'hex').copy(buf, o);
    o += 32;
    for (const r of rows) {
        buf.writeInt32LE(Math.round(r.ut1UtcSec * 1e6), o);
        o += 4;
        buf.writeInt16LE(Math.round(r.xpArcsec * 1000), o);
        o += 2;
        buf.writeInt16LE(Math.round(r.ypArcsec * 1000), o);
        o += 2;
    }
    return buf;
}

function sha256Text(text) {
    return createHash('sha256').update(text).digest('hex');
}

async function main() {
    await fetchEopSources();
    const finalsPath = join(__dirname, FINALS_NAME);
    const leapPath = join(__dirname, LEAP_NAME);
    const finalsText = readFileSync(finalsPath, 'utf8');
    const leapText = readFileSync(leapPath, 'utf8');
    const finalsSha256 = sha256Text(finalsText);
    const leapSha256 = sha256Text(leapText);
    const rows = parseFinals2000A(finalsText);
    if (rows.length < 1000) {
        throw new Error(`Too few EOP rows parsed: ${rows.length}`);
    }
    const bin = packEopBin(rows, { finalsSha256, leapSha256 });
    const binPath = join(__dirname, 'eop.bin');
    writeFileSync(binPath, bin);
    const eopBinSha256 = createHash('sha256').update(bin).digest('hex');
    writeFileSync(
        join(__dirname, 'pins.json'),
        JSON.stringify(
            {
                finalsSha256,
                leapSha256,
                eopBinSha256,
                rowCount: rows.length,
                mjdStart: rows[0].mjd,
                mjdEnd: rows.at(-1).mjd,
            },
            null,
            2,
        ) + '\n',
    );
    console.log(
        `Wrote eop.bin (${bin.length} bytes, ${rows.length} rows, MJD ${rows[0].mjd}–${rows.at(-1).mjd})`,
    );
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
