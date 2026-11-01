/**
 * @node-jhora/eop — load packed IERS UT1−UTC and polar motion.
 */

/** @typedef {{ mjdStart: number, count: number, ut1UtcMicros: Int32Array, xpMilliarcsec: Int16Array, ypMilliarcsec: Int16Array, finalsSha256: string, leapSha256: string }} IersEopTable */

const MAGIC = 0x4e4a454f;
const VERSION = 1;

/**
 * @param {Buffer | Uint8Array} bytes
 * @returns {IersEopTable}
 */
export function parseEopBin(bytes) {
    const buf = Buffer.from(bytes);
    if (buf.length < 80) throw new Error('eop.bin too small');
    if (buf.readUInt32LE(0) !== MAGIC) throw new Error('eop.bin bad magic');
    if (buf.readUInt32LE(4) !== VERSION)
        throw new Error(`eop.bin unsupported version ${buf.readUInt32LE(4)}`);
    const mjdStart = buf.readFloatLE(8);
    const count = buf.readUInt32LE(12);
    const finalsSha256 = buf.subarray(16, 48).toString('hex');
    const leapSha256 = buf.subarray(48, 80).toString('hex');
    const need = 80 + count * 8;
    if (buf.length < need) throw new Error('eop.bin truncated');
    const ut1UtcMicros = new Int32Array(count);
    const xpMilliarcsec = new Int16Array(count);
    const ypMilliarcsec = new Int16Array(count);
    let o = 80;
    for (let i = 0; i < count; i++) {
        ut1UtcMicros[i] = buf.readInt32LE(o);
        o += 4;
        xpMilliarcsec[i] = buf.readInt16LE(o);
        o += 2;
        ypMilliarcsec[i] = buf.readInt16LE(o);
        o += 2;
    }
    return {
        mjdStart,
        count,
        ut1UtcMicros,
        xpMilliarcsec,
        ypMilliarcsec,
        finalsSha256,
        leapSha256,
    };
}

/**
 * @param {number} jdUt Julian day UT (UTC)
 * @param {IersEopTable} table
 */
export function mjdUtcFromJdUt(jdUt) {
    return jdUt - 2400000.5;
}

/**
 * Linear interpolation in MJD UTC.
 * @param {number} mjd
 * @param {IersEopTable} table
 */
function rowIndex(mjd, table) {
    const idx = mjd - table.mjdStart;
    if (idx <= 0) return 0;
    if (idx >= table.count - 1) return table.count - 1;
    return idx;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * @param {number} jdUt
 * @param {IersEopTable} table
 * @returns {{ ut1MinusUtcSeconds: number, xpArcsec: number, ypArcsec: number, inTable: boolean }}
 */
export function lookupEop(jdUt, table) {
    const mjd = mjdUtcFromJdUt(jdUt);
    if (mjd < table.mjdStart || mjd > table.mjdStart + table.count - 1) {
        return { ut1MinusUtcSeconds: 0, xpArcsec: 0, ypArcsec: 0, inTable: false };
    }
    const i0 = rowIndex(mjd, table);
    const i1 = Math.min(i0 + 1, table.count - 1);
    const mjd0 = table.mjdStart + i0;
    const mjd1 = table.mjdStart + i1;
    const t = mjd1 > mjd0 ? (mjd - mjd0) / (mjd1 - mjd0) : 0;
    const ut1Micros = lerp(table.ut1UtcMicros[i0], table.ut1UtcMicros[i1], t);
    const xpMas = lerp(table.xpMilliarcsec[i0], table.xpMilliarcsec[i1], t);
    const ypMas = lerp(table.ypMilliarcsec[i0], table.ypMilliarcsec[i1], t);
    return {
        ut1MinusUtcSeconds: ut1Micros / 1e6,
        xpArcsec: xpMas / 1000,
        ypArcsec: ypMas / 1000,
        inTable: true,
    };
}

export { parseEopBin as default };
