/**
 * debug_se1_flags.mjs — Check body descriptor flags in SE1 files
 */

import { readFileSync } from 'fs';

const SEPL = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1';
const SEMO = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/semo_18.se1';

const flags = {
    HELIO: 1,
    ROTATE: 2,
    ELLIPSE: 4,
    EMBHEL: 8,
};

function analyzeFile(filePath, name) {
    const buf = readFileSync(filePath);

    // Skip text header
    let pos = 0, nlCount = 0;
    while (pos < buf.length && nlCount < 3) { if (buf[pos++] === 0x0A) nlCount++; }
    const binStart = pos;

    const le = buf.readUInt32LE(binStart) === 0x00616263;
    const readI32 = (o) => le ? buf.readInt32LE(o) : buf.readInt32BE(o);
    const readI16 = (o) => le ? buf.readInt16LE(o) : buf.readInt16BE(o);

    let p = binStart + 12;
    p += 16;  // skip file tfstart/tfend
    const npl = readI16(p);
    p += 2;
    const ipl = [];
    for (let i = 0; i < npl; i++) { ipl.push(readI16(p)); p += 2; }
    p += 4; // CRC
    p += 40; // gen_const (5 doubles)

    console.log(`\n${name} File Flags:`);
    console.log('═'.repeat(80));

    for (let k = 0; k < npl; k++) {
        const bodyId = ipl[k];
        const lndx0 = readI32(p);
        p += 4;
        const iflg = buf[p];
        p += 1;
        const ncoe = buf[p];
        p += 1;

        const flagStr = [
            (iflg & flags.HELIO) ? 'HELIO' : '',
            (iflg & flags.ROTATE) ? 'ROTATE' : '',
            (iflg & flags.ELLIPSE) ? 'ELLIPSE' : '',
            (iflg & flags.EMBHEL) ? 'EMBHEL' : '',
        ].filter(Boolean).join(' | ');

        const bodyNames = {
            0: 'Sun (EMB)',
            1: 'Moon',
            2: 'Mercury',
            3: 'Venus',
            4: 'Mars',
            5: 'Jupiter',
            6: 'Saturn',
            7: 'Uranus',
            8: 'Neptune',
            9: 'Pluto',
            10: 'Mean Node',
        };

        console.log(`Body ${bodyId} (${bodyNames[bodyId] || 'Unknown'}): 0x${iflg.toString(16)} = ${flagStr || '(none)'}`);

        // Skip to next body descriptor (44 bytes: int32 + uint8 + uint8 + int32 + 10 doubles)
        p += 4;  // rmaxInt
        p += 80; // 10 doubles
        if (iflg & flags.ELLIPSE) {
            p += 2 * ncoe * 8; // refep
        }
    }
}

analyzeFile(SEPL, 'SEPL (Planets)');
analyzeFile(SEMO, 'SEMO (Moon)');
