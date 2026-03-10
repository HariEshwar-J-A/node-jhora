/**
 * debug_moon.mjs — Trace Moon computation from semo_18.se1
 * Expected: Moon sidereal lon = 186.96° (Libra 6.96°) at JD 2450424.7111
 * Expected Moon tropical lon ≈ 186.96 + 23.81 = 210.77°
 */

import { readFileSync } from 'fs';

const SEMO = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/semo_18.se1';
const buf = readFileSync(SEMO);

// Skip text header (3 newlines)
let pos = 0, nlCount = 0;
while (pos < buf.length && nlCount < 3) { if (buf[pos++] === 0x0A) nlCount++; }
const binStart = pos;

const magic = buf.readUInt32LE(binStart);
const le    = (magic === 0x00616263);
const readF64 = (o) => le ? buf.readDoubleLE(o) : buf.readDoubleBE(o);
const readI32 = (o) => le ? buf.readInt32LE(o)  : buf.readInt32BE(o);
const readI16 = (o) => le ? buf.readInt16LE(o)  : buf.readInt16BE(o);
const read3B  = (o) => buf[o] | (buf[o+1] << 8) | (buf[o+2] << 16);

console.log(`Binary starts at ${binStart}, le=${le}`);

// Parse header
let p = binStart + 4; // skip endian
const flen  = readI32(p); p += 4;
const denum = readI32(p); p += 4;
p += 16; // file tfstart + tfend
const npl   = readI16(p); p += 2;
const ipl   = [];
for (let i = 0; i < npl; i++) { ipl.push(readI16(p)); p += 2; }
p += 4; // CRC
// gen_const (5 doubles)
p += 8; // clight
p += 8; // aunit
p += 8; // helgrav
const ratme = readF64(p); p += 8;
p += 8; // sunrad
console.log(`npl=${npl}, ipl=[${ipl}], ratme=${ratme.toFixed(5)}`);

// Parse Moon body descriptor
const bodyId  = ipl[0];
const lndx0   = readI32(p); p += 4;
const iflg    = buf[p]; p += 1;
const ncoe    = buf[p]; p += 1;
const rmaxInt = readI32(p); p += 4;
const rmax    = rmaxInt / 1000.0;

const dbl = [];
for (let d = 0; d < 10; d++) { dbl.push(readF64(p)); p += 8; }
const [tfstart, tfend, dseg, telem, prot, dprot, qrot, dqrot, peri, dperi] = dbl;
const nndx = Math.floor((tfend - tfstart + 0.1) / dseg);

console.log(`\nMoon body ${bodyId} descriptor:`);
console.log(`  lndx0=${lndx0}, iflg=0x${iflg.toString(16)} (HELIO=${!!(iflg&1)}, ROTATE=${!!(iflg&2)}, ELLIPSE=${!!(iflg&4)}, EMBHEL=${!!(iflg&8)})`);
console.log(`  ncoe=${ncoe}, rmax=${rmax}, rmaxInt=${rmaxInt}`);
console.log(`  tfstart=${tfstart.toFixed(2)}, tfend=${tfend.toFixed(2)}, dseg=${dseg.toFixed(6)}`);
console.log(`  telem=${telem.toFixed(4)}`);
console.log(`  prot=${prot.toFixed(6)}° (Ω), dprot=${dprot.toExponential(4)} °/cent`);
console.log(`  qrot=${qrot.toFixed(6)}° (i), dqrot=${dqrot.toExponential(4)} °/cent`);
console.log(`  peri=${peri.toFixed(6)} rad = ${(peri*180/Math.PI).toFixed(4)}° (ω), dperi=${dperi.toExponential(4)} rad/cent`);

// Load refep if ELLIPSE
let refepX = null, refepY = null;
if (iflg & 4) {
    refepX = new Float64Array(ncoe);
    refepY = new Float64Array(ncoe);
    for (let d = 0; d < ncoe; d++) { refepX[d] = readF64(p); p += 8; }
    for (let d = 0; d < ncoe; d++) { refepY[d] = readF64(p); p += 8; }
    console.log(`  refepX[0..5]: [${Array.from(refepX.slice(0,6)).map(v=>v.toFixed(8)).join(', ')}]`);
    console.log(`  refepY[0..5]: [${Array.from(refepY.slice(0,6)).map(v=>v.toFixed(8)).join(', ')}]`);
}

// ── Chebyshev evaluation ──────────────────────────────────────────────────

function echeb(t, coef, offset, ncoe) {
    const x2 = 2.0 * t;
    let br = 0, brp2 = 0, brpp = 0;
    for (let j = ncoe - 1; j >= 1; j--) {
        brpp = brp2;
        brp2 = br;
        br   = x2 * brp2 - brpp + coef[offset + j];
    }
    return t * br - brp2 + coef[offset] / 2.0;  // FIXED echeb
}

// Unpack coefficients
function unpackSegp(fpos, ncoe, rmax) {
    const segp = new Float64Array(3 * ncoe);
    let p = fpos, idbl = 0;
    for (let comp = 0; comp < 3; comp++) {
        const c0 = buf[p++], c1 = buf[p++];
        let nsizes, nsize = [0,0,0,0,0,0];
        if (c0 & 0x80) {
            const c2=buf[p++], c3=buf[p++]; nsizes=6;
            nsize[0]=c1>>4; nsize[1]=c1&0xF; nsize[2]=c2>>4; nsize[3]=c2&0xF; nsize[4]=c3>>4; nsize[5]=c3&0xF;
        } else {
            nsizes=4; nsize[0]=c0>>4; nsize[1]=c0&0xF; nsize[2]=c1>>4; nsize[3]=c1&0xF;
        }
        for (let gi=0; gi<nsizes; gi++) {
            const cnt=nsize[gi]; if (!cnt) continue;
            if (gi<=3) {
                const bw=4-gi;
                for (let m=0; m<cnt; m++,idbl++) {
                    let raw;
                    if (bw===4) raw=le?buf.readUInt32LE(p):buf.readUInt32BE(p);
                    else { raw=0; if(le){for(let b=0;b<bw;b++)raw+=buf[p+b]*(256**b);}else{for(let b=0;b<bw;b++)raw=raw*256+buf[p+b];} }
                    p+=bw;
                    const neg=(raw&1)!==0, val=(raw>>>1)/1e9*rmax/2;
                    segp[idbl]=neg?-val:val;
                }
            } else if (gi===4) {
                for (let m=0; m<cnt; m+=2, p++) {
                    const byte=buf[p], hi=(byte>>4)&0xF, lo=byte&0xF;
                    if(m<cnt){const neg=(hi&1)!==0;segp[idbl++]=neg?-(hi>>>1)/1e9*rmax/2:(hi>>>1)/1e9*rmax/2;}
                    if(m+1<cnt){const neg=(lo&1)!==0;segp[idbl++]=neg?-(lo>>>1)/1e9*rmax/2:(lo>>>1)/1e9*rmax/2;}
                }
            } else {
                for (let m=0; m<cnt; m+=4, p++) {
                    const byte=buf[p];
                    for(let slot=0;slot<4&&(m+slot)<cnt;slot++){
                        const bits=(byte>>(slot*2))&3, neg=(bits&1)!==0;
                        segp[idbl++]=neg?-(bits>>>1)/1e9*rmax/2:(bits>>>1)/1e9*rmax/2;
                    }
                }
            }
        }
    }
    return segp;
}

function rotZ(x, y, z, a) {
    const cosA=Math.cos(a), sinA=Math.sin(a);
    return [cosA*x - sinA*y, sinA*x + cosA*y, z];
}
function rotPlane(x, y, z, P, Q) {
    const cosP=Math.cos(P),sinP=Math.sin(P),cosQ=Math.cos(Q),sinQ=Math.sin(Q);
    return [cosP*x-sinP*cosQ*y+sinP*sinQ*z, sinP*x+cosP*cosQ*y-cosP*sinQ*z, sinQ*y+cosQ*z];
}
const lon360 = v => ((Math.atan2(v[1],v[0])*180/Math.PI)+360)%360;
const dist3  = v => Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);

const TJD = 2450424.7111111;
console.log(`\n=== Moon position trace at TJD=${TJD} ===`);

// Segment index
let iseg = Math.floor((TJD - tfstart) / dseg);
iseg = Math.max(0, Math.min(iseg, nndx - 1));
const tseg0 = tfstart + iseg * dseg;
const coeffPos = read3B(lndx0 + iseg * 3);
console.log(`  iseg=${iseg}, tseg0=${tseg0.toFixed(6)}, coeffPos=${coeffPos}`);

const segp = unpackSegp(coeffPos, ncoe, rmax);
const t_seg = 2.0 * (TJD - tseg0) / dseg - 1.0;
console.log(`  t_seg=${t_seg.toFixed(6)}`);

let x = echeb(t_seg, segp, 0, ncoe);
let y = echeb(t_seg, segp, ncoe, ncoe);
let z = echeb(t_seg, segp, 2*ncoe, ncoe);
console.log(`\nAfter segp evaluation (no refep, no rotation):`);
console.log(`  x=${x.toFixed(8)}, y=${y.toFixed(8)}, z=${z.toFixed(8)}`);
console.log(`  dist=${dist3([x,y,z]).toFixed(8)} AU (expected ~0.00257 AU for Moon)`);
console.log(`  lon=${lon360([x,y,z]).toFixed(4)}°`);

// refep correction
if (refepX && (iflg & 4)) {
    let fmod_c = (TJD - telem) % dseg;
    if (fmod_c < 0) fmod_c += dseg;
    const dt = fmod_c / dseg * 2.0 - 1.0;
    console.log(`\nrefep: telem=${telem.toFixed(4)}, dseg=${dseg.toFixed(6)}`);
    console.log(`  (TJD-telem)=${(TJD-telem).toFixed(6)}, fmod_c=${fmod_c.toFixed(6)}, dt=${dt.toFixed(6)}`);
    const rx = echeb(dt, refepX, 0, ncoe);
    const ry = echeb(dt, refepY, 0, ncoe);
    console.log(`  refep correction: dx=${rx.toFixed(8)}, dy=${ry.toFixed(8)}`);
    x += rx;
    y += ry;
    console.log(`After segp + refep:`);
    console.log(`  x=${x.toFixed(8)}, y=${y.toFixed(8)}, z=${z.toFixed(8)}`);
    console.log(`  dist=${dist3([x,y,z]).toFixed(8)} AU`);
    console.log(`  lon=${lon360([x,y,z]).toFixed(4)}°`);
}

// Rotation steps
if (iflg & 2) {
    const T = (TJD - telem) / 36525.0;
    console.log(`\nRotation: T=${T.toFixed(6)} centuries from telem`);

    const periT = peri + dperi * T;
    console.log(`  peri=${peri.toFixed(6)} rad, dperi=${dperi.toFixed(6)} rad/cent`);
    console.log(`  periT = peri + dperi*T = ${peri.toFixed(6)} + ${dperi.toFixed(6)}*${T.toFixed(6)} = ${periT.toFixed(6)} rad`);
    console.log(`  periT mod 2π = ${(periT % (2*Math.PI)).toFixed(6)} rad = ${((periT % (2*Math.PI))*180/Math.PI).toFixed(4)}°`);

    const [xa, ya, za] = rotZ(x, y, z, periT);
    console.log(`After Rz(periT):`);
    console.log(`  x=${xa.toFixed(8)}, y=${ya.toFixed(8)}, z=${za.toFixed(8)}`);
    console.log(`  dist=${dist3([xa,ya,za]).toFixed(8)} AU, lon=${lon360([xa,ya,za]).toFixed(4)}°`);

    const P = (prot + dprot * T) * (Math.PI/180);
    const Q = (qrot + dqrot * T) * (Math.PI/180);
    console.log(`  prot=${prot.toFixed(6)}° + dprot*T = ${(prot+dprot*T).toFixed(6)}° → P=${(P*180/Math.PI).toFixed(6)}°`);
    console.log(`  qrot=${qrot.toFixed(6)}° + dqrot*T = ${(qrot+dqrot*T).toFixed(6)}° → Q=${(Q*180/Math.PI).toFixed(6)}°`);

    const [xb, yb, zb] = rotPlane(xa, ya, za, P, Q);
    console.log(`After full rotation (Rz(prot)×Rx(qrot)):`);
    console.log(`  x=${xb.toFixed(8)}, y=${yb.toFixed(8)}, z=${zb.toFixed(8)}`);
    console.log(`  dist=${dist3([xb,yb,zb]).toFixed(8)} AU, lon=${lon360([xb,yb,zb]).toFixed(4)}°`);
    console.log(`  Expected geocentric Moon tropical lon ≈ 210.77°`);
    console.log(`  Expected geocentric Moon distance ≈ 0.00250-0.00270 AU`);

    // Also test: what if we DON'T apply peri rotation?
    const [xc, yc, zc] = rotPlane(x, y, z, P, Q);
    console.log(`\nWithout Rz(peri) — only Rz(prot)×Rx(qrot):`);
    console.log(`  lon=${lon360([xc,yc,zc]).toFixed(4)}°`);

    // Test: what if we skip all rotation?
    console.log(`\nWithout any rotation:`);
    console.log(`  lon=${lon360([x,y,z]).toFixed(4)}°`);
}

// Also check: what segp[0..5] look like (raw coefficients)
console.log(`\nsegp[0..5] (X): ${Array.from(segp.slice(0,6)).map(v=>v.toExponential(6)).join(', ')}`);
console.log(`segp[ncoe..ncoe+5] (Y): ${Array.from(segp.slice(ncoe,ncoe+6)).map(v=>v.toExponential(6)).join(', ')}`);

console.log('\nDone.');
