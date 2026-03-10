/**
 * debug_se1.mjs — Deep binary inspection of sepl_18.se1
 * Compares all per-body descriptor values with known physical constants.
 */

import { readFileSync } from 'fs';

const FILE = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1';
const buf  = readFileSync(FILE);

// ── Locate binary section start (skip 3 CR+LF text lines) ──────────────────
let pos = 0, nlCount = 0;
while (pos < buf.length && nlCount < 3) { if (buf[pos++] === 0x0A) nlCount++; }
const binStart = pos;
console.log(`Binary section starts at byte ${binStart}`);
console.log(`Text header: "${buf.slice(0, binStart).toString('ascii').replace(/\r\n/g,'|')}"`);

// ── Endianness ──────────────────────────────────────────────────────────────
const magic = buf.readUInt32LE(binStart);
const le    = (magic === 0x00616263);
console.log(`Endian magic: 0x${magic.toString(16)} → le=${le}`);

const readF64 = (o) => le ? buf.readDoubleLE(o) : buf.readDoubleBE(o);
const readI32 = (o) => le ? buf.readInt32LE(o)  : buf.readInt32BE(o);
const readI16 = (o) => le ? buf.readInt16LE(o)  : buf.readInt16BE(o);

// ── Fixed header ─────────────────────────────────────────────────────────────
let p = binStart;
p += 4; // endian
const flen = readI32(p); p += 4;
const denum = readI32(p); p += 4;
const tfstart_file = readF64(p); p += 8;
const tfend_file   = readF64(p); p += 8;
const npl = readI16(p); p += 2;
console.log(`\nFile header: flen=${flen}, denum=${denum}`);
console.log(`File JD range: ${tfstart_file.toFixed(2)} – ${tfend_file.toFixed(2)}`);
console.log(`npl=${npl}`);

const ipl = [];
for (let i = 0; i < npl; i++) { ipl.push(readI16(p)); p += 2; }
console.log(`ipl = [${ipl}]`);

p += 4; // CRC32
console.log(`After header+CRC: p=${p}`);

// ── gen_const ─────────────────────────────────────────────────────────────────
const clight  = readF64(p); p += 8;
const aunit   = readF64(p); p += 8;
const helgrav = readF64(p); p += 8;
const ratme   = readF64(p); p += 8;
const sunrad  = readF64(p); p += 8;
console.log(`\ngen_const: clight=${clight.toExponential(6)}, aunit=${aunit.toExponential(6)}`);
console.log(`           ratme=${ratme.toFixed(5)}, sunrad=${sunrad.toExponential(4)}`);

// ── Per-body descriptors ──────────────────────────────────────────────────────
const BODY_NAMES = {0:'Sun/Earth',1:'Moon',2:'Mercury',3:'Venus',4:'Mars',
                    5:'Jupiter',6:'Saturn',7:'Uranus',8:'Neptune',9:'Pluto',10:'MeanNode'};
const FLAG_NAMES = {1:'HELIO',2:'ROTATE',4:'ELLIPSE',8:'EMBHEL'};

function flagStr(f) {
  return Object.entries(FLAG_NAMES).filter(([k])=>(f & k)!==0).map(([,v])=>v).join('|') || '0';
}

// Test JD for 1996-12-07 05:04 UTC
const TJD = 2450424.7111111;
// Expected Earth helio: lon=75.37°, dist=0.983 AU → x=0.2463, y=0.9517

const bodyDescStart = {};
for (let k = 0; k < npl; k++) {
    const bodyId  = ipl[k];
    const descStart = p;
    bodyDescStart[bodyId] = descStart;

    const lndx0   = readI32(p);   p += 4;
    const iflg    = buf[p];        p += 1;
    const ncoe    = buf[p];        p += 1;
    const rmaxInt = readI32(p);    p += 4;
    const rmax    = rmaxInt / 1000.0;

    // Read 10 doubles
    const dbl = [];
    for (let d = 0; d < 10; d++) { dbl.push(readF64(p)); p += 8; }

    // What we ASSUME the 10 doubles are:
    const [tfstart, tfend, dseg, telem,
           prot, dprot, qrot, dqrot,
           peri, dperi] = dbl;

    // refep (if ELLIPSE)
    let refepX, refepY;
    if (iflg & 4) {
        refepX = [];
        refepY = [];
        for (let d = 0; d < ncoe; d++) { refepX.push(readF64(p)); p += 8; }
        for (let d = 0; d < ncoe; d++) { refepY.push(readF64(p)); p += 8; }
    }

    console.log(`\n─── Body ${bodyId} (${BODY_NAMES[bodyId]}) at byte ${descStart} ───`);
    console.log(`  lndx0=${lndx0}, iflg=0x${iflg.toString(16)} [${flagStr(iflg)}], ncoe=${ncoe}, rmax=${rmax}`);
    console.log(`  dbl[0..9]: [${dbl.map(d=>d.toFixed(4)).join(', ')}]`);
    console.log(`  tfstart=${tfstart.toFixed(2)}, tfend=${tfend.toFixed(2)}, dseg=${dseg.toFixed(4)}`);
    console.log(`  telem=${telem.toFixed(4)}, prot=${prot.toFixed(4)}°, dprot=${dprot.toExponential(3)}`);
    console.log(`  qrot=${qrot.toFixed(6)}°, dqrot=${dqrot.toExponential(3)}, peri=${peri.toFixed(4)}, dperi=${dperi.toExponential(3)}`);

    if (iflg & 4) {
        // Compute refep using correct fmod formula
        const diff  = TJD - telem;
        let fmod_c  = diff % dseg;                          // JS % same sign as left
        if (fmod_c < 0) fmod_c += dseg;                    // make positive (C style + dseg)
        const dt    = fmod_c / dseg * 2.0 - 1.0;

        // Also compute segment t for comparison
        const iseg  = Math.floor((TJD - tfstart) / dseg);
        const tseg0 = tfstart + iseg * dseg;
        const t_seg = 2.0 * (TJD - tseg0) / dseg - 1.0;

        function echeb(t, coef) {
            const x2 = 2*t, n=coef.length;
            let br=0, brp2=0, brpp=0;
            for (let j=n-1; j>=1; j--) { brpp=brp2; brp2=br; br=x2*brp2-brpp+coef[j]; }
            return t*brp2 - brpp + coef[0]/2;
        }

        const rx  = echeb(dt, refepX);
        const ry  = echeb(dt, refepY);
        const rx2 = echeb(t_seg, refepX);
        const ry2 = echeb(t_seg, refepY);

        const dist_dt   = Math.sqrt(rx*rx+ry*ry);
        const lon_dt    = Math.atan2(ry, rx)*180/Math.PI;
        const dist_tseg = Math.sqrt(rx2*rx2+ry2*ry2);
        const lon_tseg  = Math.atan2(ry2, rx2)*180/Math.PI;

        console.log(`  refep dt=${dt.toFixed(4)} (fmod_c=${fmod_c.toFixed(2)}, t_seg=${t_seg.toFixed(4)})`);
        console.log(`  refep(dt):   x=${rx.toFixed(4)}, y=${ry.toFixed(4)}, dist=${dist_dt.toFixed(4)}, lon=${((lon_dt+360)%360).toFixed(2)}°`);
        console.log(`  refep(tseg): x=${rx2.toFixed(4)}, y=${ry2.toFixed(4)}, dist=${dist_tseg.toFixed(4)}, lon=${((lon_tseg+360)%360).toFixed(2)}°`);
        console.log(`  refep[0..3]: X=[${refepX.slice(0,4).map(v=>v.toFixed(6)).join(', ')}]`);
        console.log(`  refep[0..3]: Y=[${refepY.slice(0,4).map(v=>v.toFixed(6)).join(', ')}]`);

        if (bodyId === 0) {
            console.log(`\n  *** EARTH ANALYSIS ***`);
            console.log(`  Expected helio Earth: x=0.2463, y=0.9517, lon=75.37°, dist=0.983`);
            console.log(`  Physical check: rmax should be ~1.017 AU (Earth aphelion)`);
            console.log(`  prot should be ~102.9° (Earth perihelion longitude)`);
            console.log(`  qrot should be ~0.0° (Earth orbit = ecliptic)`);

            // Try: maybe telem is something else, and the doubles layout is different
            // Layout alternative: [dseg, telem, tfstart, tfend, prot, dprot, qrot, dqrot, peri, dperi]
            console.log(`\n  --- Alternative layout attempts ---`);
            for (let skip = 0; skip <= 4; skip++) {
                const alt_dseg  = dbl[skip+0];
                const alt_telem = dbl[skip+1];
                if (alt_dseg < 300 || alt_dseg > 500) continue;  // dseg should be ~365
                const alt_diff  = TJD - alt_telem;
                let   alt_fmod  = alt_diff % alt_dseg;
                if (alt_fmod < 0) alt_fmod += alt_dseg;
                const alt_dt    = alt_fmod / alt_dseg * 2 - 1;
                const alt_rx    = echeb(alt_dt, refepX);
                const alt_ry    = echeb(alt_dt, refepY);
                const alt_dist  = Math.sqrt(alt_rx*alt_rx+alt_ry*alt_ry);
                const alt_lon   = ((Math.atan2(alt_ry, alt_rx)*180/Math.PI)+360)%360;
                console.log(`  skip=${skip}: dseg=${alt_dseg.toFixed(2)}, telem=${alt_telem.toFixed(2)}, dt=${alt_dt.toFixed(4)} → lon=${alt_lon.toFixed(2)}°, dist=${alt_dist.toFixed(4)}`);
            }
        }
    }
}

// ── Now try with semo_18.se1 ────────────────────────────────────────────────
console.log('\n\n═══════ SEMO_18.SE1 ═══════');
const sBuf = readFileSync('E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/semo_18.se1');
let sp = 0; let snl = 0;
while (sp < sBuf.length && snl < 3) { if (sBuf[sp++] === 0x0A) snl++; }
const sBinStart = sp;
console.log(`Semo binary starts at byte ${sBinStart}`);
const sMagic = sBuf.readUInt32LE(sBinStart);
const sLe = (sMagic === 0x00616263);
const sReadF64 = (o) => sLe ? sBuf.readDoubleLE(o) : sBuf.readDoubleBE(o);
const sReadI32 = (o) => sLe ? sBuf.readInt32LE(o)  : sBuf.readInt32BE(o);
const sReadI16 = (o) => sLe ? sBuf.readInt16LE(o)  : sBuf.readInt16BE(o);
let sq = sBinStart + 4; // skip endian
const sFlen  = sReadI32(sq); sq += 4;
const sDenum = sReadI32(sq); sq += 4;
sq += 16; // tfstart, tfend
const sNpl = sReadI16(sq); sq += 2;
const sIpl = [];
for (let i = 0; i < sNpl; i++) { sIpl.push(sReadI16(sq)); sq += 2; }
sq += 4; // CRC32
sq += 40; // gen_const
console.log(`npl=${sNpl}, ipl=[${sIpl}], after-header: sq=${sq}`);

for (let k = 0; k < sNpl; k++) {
    const bodyId  = sIpl[k];
    const lndx0   = sReadI32(sq); sq += 4;
    const iflg    = sBuf[sq]; sq += 1;
    const ncoe    = sBuf[sq]; sq += 1;
    const rmaxInt = sReadI32(sq); sq += 4;
    const rmax    = rmaxInt / 1000.0;
    const dbl = [];
    for (let d = 0; d < 10; d++) { dbl.push(sReadF64(sq)); sq += 8; }
    const [tfstart, tfend, dseg, telem, prot, dprot, qrot, dqrot, peri, dperi] = dbl;

    let refepX, refepY;
    if (iflg & 4) {
        refepX=[]; refepY=[];
        for (let d=0;d<ncoe;d++){refepX.push(sReadF64(sq));sq+=8;}
        for (let d=0;d<ncoe;d++){refepY.push(sReadF64(sq));sq+=8;}
    }

    console.log(`\nMoon (body ${bodyId}): iflg=0x${iflg.toString(16)}, ncoe=${ncoe}, rmax=${rmax}`);
    console.log(`  tfstart=${tfstart.toFixed(2)}, tfend=${tfend.toFixed(2)}, dseg=${dseg.toFixed(4)}`);
    console.log(`  telem=${telem.toFixed(4)}`);

    // Evaluate Moon position (no ELLIPSE for Moon)
    if (!(iflg & 4)) {
        console.log(`  Moon has NO ELLIPSE flag — pure segp evaluation`);
    }
}
