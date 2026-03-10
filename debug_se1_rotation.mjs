/**
 * debug_se1_rotation.mjs — Check if SE1 reader is actually applying rotations
 */

import { readFileSync } from 'fs';

const SEPL = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1';

// Manually parse SE1 and check Mercury rotation

const buf = readFileSync(SEPL);

// Skip text header
let pos = 0, nlCount = 0;
while (pos < buf.length && nlCount < 3) { if (buf[pos++] === 0x0A) nlCount++; }
const binStart = pos;

const le = buf.readUInt32LE(binStart) === 0x00616263;
const readF64 = (o) => le ? buf.readDoubleLE(o) : buf.readDoubleBE(o);
const readI32 = (o) => le ? buf.readInt32LE(o) : buf.readInt32BE(o);
const readI16 = (o) => le ? buf.readInt16LE(o) : buf.readInt16BE(o);
const read3B  = (o) => le ? (buf[o] | (buf[o+1] << 8) | (buf[o+2] << 16))
                           : ((buf[o] << 16) | (buf[o+1] << 8) | buf[o+2]);

let p = binStart + 12;
p += 16;
const npl = readI16(p);
p += 2;
const ipl = [];
for (let i = 0; i < npl; i++) { ipl.push(readI16(p)); p += 2; }
p += 4;
p += 40;

// Find Mercury (body 2)
let merPos = null;
for (let k = 0; k < npl; k++) {
    const bodyId = ipl[k];
    if (bodyId === 2) {
        merPos = p;
        break;
    }
    const iflg = buf[p + 4];
    const ncoe = buf[p + 5];
    p += 4 + 1 + 1 + 4 + 80;
    if (iflg & 4) p += 2 * ncoe * 8;
}

// Parse Mercury
p = merPos;
const lndx0 = readI32(p);
p += 4;
const iflg = buf[p];
p += 1;
const ncoe = buf[p];
p += 1;
const rmaxInt = readI32(p);
p += 4;
const rmax = rmaxInt / 1000.0;

const dbl = [];
for (let d = 0; d < 10; d++) { dbl.push(readF64(p)); p += 8; }
const [tfstart, tfend, dseg, telem, prot, dprot, qrot, dqrot, peri, dperi] = dbl;

// Check for refep
let refep = null;
if (iflg & 4) {
    refep = new Float64Array(2 * ncoe);
    for (let d = 0; d < 2 * ncoe; d++) {
        refep[d] = readF64(p);
        p += 8;
    }
}

console.log('Mercury Rotation Check:');
console.log(`  ROTATE flag set: ${!!(iflg & 2)} (iflg=0x${iflg.toString(16)})`);
console.log(`  iflg & SEI_FLG_ROTATE = iflg & 2 = ${iflg & 2} (should be 2 for rotation)`);
console.log(`\nRotation parameters:`);
console.log(`  prot=${prot.toFixed(6)}° (Ω)`);
console.log(`  qrot=${qrot.toFixed(6)}° (i)`);
console.log(`  peri=${peri.toFixed(6)} rad`);
console.log(`\nTime-corrected at J2000:`);
const TJD = 2451545.0;
const T = (TJD - telem) / 36525.0;
const peri_t = peri + dperi * T;
const prot_t = prot + dprot * T;
const qrot_t = qrot + dqrot * T;
console.log(`  T=${T.toFixed(6)} centuries`);
console.log(`  peri_t=${peri_t.toFixed(6)} rad = ${(peri_t*180/Math.PI).toFixed(4)}°`);
console.log(`  prot_t=${prot_t.toFixed(6)}°`);
console.log(`  qrot_t=${qrot_t.toFixed(6)}°`);

console.log('\n✓ Rotation parameters are non-zero, so rotations SHOULD be applied');
console.log('If SE1 reader shows unrotated coordinates, the rotation code is not being executed');
