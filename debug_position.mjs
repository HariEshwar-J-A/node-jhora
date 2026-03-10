/**
 * debug_position.mjs — Test Earth position with fixed echeb
 */

import { readFileSync } from 'fs';

const buf = readFileSync('E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1');

// Skip text header
let pos = 0, nlCount = 0;
while (pos < buf.length && nlCount < 3) { if (buf[pos++] === 0x0A) nlCount++; }
const binStart = pos;

const magic = buf.readUInt32LE(binStart);
const le    = (magic === 0x00616263);
const readF64 = (o) => le ? buf.readDoubleLE(o) : buf.readDoubleBE(o);
const readI32 = (o) => le ? buf.readInt32LE(o)  : buf.readInt32BE(o);
const readI16 = (o) => le ? buf.readInt16LE(o)  : buf.readInt16BE(o);
const read3B  = (o) => buf[o] | (buf[o+1] << 8) | (buf[o+2] << 16);

// Fixed Clenshaw recursion
function echeb(t, coef, offset, ncoe) {
    const x2 = 2.0 * t;
    let br = 0, brp2 = 0, brpp = 0;
    for (let j = ncoe - 1; j >= 1; j--) {
        brpp = brp2;
        brp2 = br;
        br   = x2 * brp2 - brpp + coef[offset + j];
    }
    return t * br - brp2 + coef[offset] / 2.0;  // FIXED
}

// Unpack coefficients from a segment
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

// Parse header
let p = binStart + 4 + 4 + 4 + 16; // endian+flen+denum+tfstart+tfend
const npl = readI16(p); p += 2;
const ipl = [];
for (let i=0; i<npl; i++) { ipl.push(readI16(p)); p+=2; }
p += 4; // CRC
const ratme = readF64(p+24); // skip clight(8)+aunit(8)+helgrav(8)+ratme(8)
p += 40; // gen_const

// Parse all body descriptors
const bodies = {};
for (let k=0; k<npl; k++) {
    const bodyId=ipl[k], descStart=p;
    const lndx0=readI32(p); p+=4;
    const iflg=buf[p]; p+=1;
    const ncoe=buf[p]; p+=1;
    const rmax=readI32(p)/1000; p+=4;
    const dbl=[];
    for(let d=0;d<10;d++){dbl.push(readF64(p));p+=8;}
    const [tfstart,tfend,dseg,telem,prot,dprot,qrot,dqrot,peri,dperi]=dbl;
    let refep=null;
    if(iflg&4){
        refep=new Float64Array(2*ncoe);
        for(let d=0;d<2*ncoe;d++){refep[d]=readF64(p);p+=8;}
    }
    const nndx=Math.floor((tfend-tfstart+0.1)/dseg);
    bodies[bodyId]={lndx0,iflg,ncoe,rmax,tfstart,tfend,dseg,nndx,telem,prot,dprot,qrot,dqrot,peri,dperi,refep};
}

// Rotation: Rz(angle) around Z axis
function rotateZ(x, y, z, a) {
    const c=Math.cos(a), s=Math.sin(a);
    return [c*x - s*y, s*x + c*y, z];
}
// Rotation: Rz(P) × Rx(Q)
function rotate(x, y, z, P, Q) {
    const cosP=Math.cos(P),sinP=Math.sin(P),cosQ=Math.cos(Q),sinQ=Math.sin(Q);
    return [cosP*x-sinP*cosQ*y+sinP*sinQ*z, sinP*x+cosP*cosQ*y-cosP*sinQ*z, sinQ*y+cosQ*z];
}

// Evaluate body position
function getPos(bodyId, tjd) {
    const d=bodies[bodyId];
    let iseg=Math.floor((tjd-d.tfstart)/d.dseg);
    iseg=Math.max(0,Math.min(iseg,d.nndx-1));
    const tseg0=d.tfstart+iseg*d.dseg;
    const coeffPos=read3B(d.lndx0+iseg*3);
    const segp=unpackSegp(coeffPos,d.ncoe,d.rmax);
    const t=2*(tjd-tseg0)/d.dseg-1;

    let x=echeb(t,segp,0,d.ncoe);
    let y=echeb(t,segp,d.ncoe,d.ncoe);
    let z=echeb(t,segp,2*d.ncoe,d.ncoe);

    if(d.refep&&(d.iflg&4)){
        let fm=(tjd-d.telem)%d.dseg;
        if(fm<0)fm+=d.dseg;
        const dt=fm/d.dseg*2-1;
        x+=echeb(dt,d.refep,0,d.ncoe);
        y+=echeb(dt,d.refep,d.ncoe,d.ncoe);
    }

    if(d.iflg&2){
        const T=(tjd-d.telem)/36525;  // centuries from telem (not J2000)
        // 1. Rz(peri_t): perihelion frame → ascending-node frame (peri in radians)
        const periT = d.peri + d.dperi * T;
        [x,y,z]=rotateZ(x,y,z,periT);
        // 2. Rz(prot) × Rx(qrot): orbital frame → J2000 ecliptic (degrees)
        const P=(d.prot+d.dprot*T)*(Math.PI/180);
        const Q=(d.qrot+d.dqrot*T)*(Math.PI/180);
        [x,y,z]=rotate(x,y,z,P,Q);
    }
    return [x,y,z];
}

// Test JD: 1996-12-07 05:04 UTC
const TJD = 2450424.7111111;

console.log(`Test JD: ${TJD} (1996-12-07 05:04 UTC)\n`);

// Earth body 0 (heliocentric EMB)
const [ex, ey, ez] = getPos(0, TJD);
const eDist = Math.sqrt(ex*ex+ey*ey+ez*ez);
const eLon  = ((Math.atan2(ey,ex)*180/Math.PI)+360)%360;
console.log('Earth/EMB helio (body 0):');
console.log(`  x=${ex.toFixed(6)}, y=${ey.toFixed(6)}, z=${ez.toFixed(6)}`);
console.log(`  dist=${eDist.toFixed(6)} AU, lon=${eLon.toFixed(4)}°`);
console.log(`  Expected: lon=75.37°, dist≈0.983 AU`);

// Sun geocentric = -Earth helio
const sx=-ex, sy=-ey, sz=-ez;
const sDist=Math.sqrt(sx*sx+sy*sy+sz*sz);
const sLon=((Math.atan2(sy,sx)*180/Math.PI)+360)%360;
console.log(`\nSun geocentric (= -Earth):`);
console.log(`  dist=${sDist.toFixed(6)} AU, lon=${sLon.toFixed(4)}°`);
console.log(`  Expected: lon≈255.37° (Sun opposite Earth), dist≈0.983 AU`);

// Mars helio body 4
const [mx, my, mz] = getPos(4, TJD);
const mDist = Math.sqrt(mx*mx+my*my+mz*mz);
const mLon  = ((Math.atan2(my,mx)*180/Math.PI)+360)%360;
console.log(`\nMars helio (body 4):`);
console.log(`  dist=${mDist.toFixed(6)} AU, lon=${mLon.toFixed(4)}°`);
console.log(`  Expected: lon≈201.7°, dist≈1.502 AU (approx)`);

// Jupiter helio body 5
const [jx, jy, jz] = getPos(5, TJD);
const jDist = Math.sqrt(jx*jx+jy*jy+jz*jz);
const jLon  = ((Math.atan2(jy,jx)*180/Math.PI)+360)%360;
console.log(`\nJupiter helio (body 5):`);
console.log(`  dist=${jDist.toFixed(6)} AU, lon=${jLon.toFixed(4)}°`);

// Saturn helio
const [satx, saty, satz] = getPos(6, TJD);
const satDist = Math.sqrt(satx*satx+saty*saty+satz*satz);
const satLon  = ((Math.atan2(saty,satx)*180/Math.PI)+360)%360;
console.log(`\nSaturn helio (body 6):`);
console.log(`  dist=${satDist.toFixed(6)} AU, lon=${satLon.toFixed(4)}°`);

// Mercury geocentric
const [mercx, mercy, mercz] = getPos(2, TJD);
const [mercGx, mercGy, mercGz] = [mercx-ex, mercy-ey, mercz-ez];
const mercGDist = Math.sqrt(mercGx*mercGx+mercGy*mercGy+mercGz*mercGz);
const mercGLon  = ((Math.atan2(mercGy,mercGx)*180/Math.PI)+360)%360;
console.log(`\nMercury geocentric:`);
console.log(`  dist=${mercGDist.toFixed(6)} AU, lon=${mercGLon.toFixed(4)}°`);

console.log('\nDone.');
