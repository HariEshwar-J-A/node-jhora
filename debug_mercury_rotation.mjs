/**
 * debug_mercury_rotation.mjs — Trace Mercury rotation from perihelion frame to J2000 ecliptic
 */

import { readFileSync } from 'fs';

const SEPL = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1';
const buf = readFileSync(SEPL);

// Skip text header
let pos = 0, nlCount = 0;
while (pos < buf.length && nlCount < 3) { if (buf[pos++] === 0x0A) nlCount++; }
const binStart = pos;

const le = buf.readUInt32LE(binStart) === 0x00616263;
const readF64 = (o) => le ? buf.readDoubleLE(o) : buf.readDoubleBE(o);
const readI32 = (o) => le ? buf.readInt32LE(o) : buf.readInt32BE(o);
const readI16 = (o) => le ? buf.readInt16LE(o) : buf.readInt16BE(o);

let p = binStart + 12;
p += 16;  // skip file tfstart/tfend
const npl = readI16(p);
p += 2;
const ipl = [];
for (let i = 0; i < npl; i++) { ipl.push(readI16(p)); p += 2; }
p += 4; // CRC
p += 40; // gen_const

// Find Mercury (body 2)
let merPos = null;
for (let k = 0; k < npl; k++) {
    const bodyId = ipl[k];
    if (bodyId === 2) {
        merPos = p;
        break;
    }
    const iflg = buf[p + 4];
    p += 4 + 1 + 1 + 4 + 80;
    if (iflg & 4) p += 2 * buf[p - 77] * 8; // refep
}

if (!merPos) throw new Error('Mercury not found!');

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

console.log('Mercury Descriptor:');
console.log(`  ncoe=${ncoe}, rmax=${rmax}, iflg=0x${iflg.toString(16)}`);
console.log(`  telem=${telem.toFixed(4)}, dseg=${dseg.toFixed(6)}`);
console.log(`  prot=${prot.toFixed(6)}° (Ω), dprot=${dprot.toExponential(4)} °/cent`);
console.log(`  qrot=${qrot.toFixed(6)}° (i), dqrot=${dqrot.toExponential(4)} °/cent`);
console.log(`  peri=${peri.toFixed(6)} rad = ${(peri*180/Math.PI).toFixed(4)}° (ω), dperi=${dperi.toExponential(4)} rad/cent`);

// Test coordinates: raw Mercury before rotation
const TJD = 2451545.0;
const T = (TJD - telem) / 36525.0;

console.log(`\nAt J2000 (JD ${TJD}):`);
console.log(`  T = ${T.toFixed(6)} centuries from telem`);
console.log(`  peri_t = ${peri.toFixed(6)} + ${dperi.toExponential(4)} * ${T.toFixed(6)}`);
console.log(`         = ${(peri + dperi * T).toFixed(6)} rad`);
console.log(`         = ${((peri + dperi * T) * 180 / Math.PI).toFixed(4)}°`);

console.log(`  P (prot) = ${prot.toFixed(6)}° + ${dprot.toExponential(4)} * ${T.toFixed(6)}`);
console.log(`          = ${(prot + dprot * T).toFixed(6)}°`);
console.log(`  Q (qrot) = ${qrot.toFixed(6)}° + ${dqrot.toExponential(4)} * ${T.toFixed(6)}`);
console.log(`          = ${(qrot + dqrot * T).toFixed(6)}°`);

console.log('\nNote: These rotation parameters should transform perihelion frame → J2000 ecliptic');
console.log('If P or Q have huge values, the rotation might be wrong');
