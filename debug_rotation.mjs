/**
 * debug_rotation.mjs — verify peri rotation fixes Earth longitude
 * Known: Earth body 0 gives x=0.890, y=-0.403 (perihelion frame)
 * Expected after full rotation: lon≈75.4°, dist≈0.983 AU
 */

const x0 = 0.889670, y0 = -0.403273, z0 = -0.001321;
const peri_rad = 1.8022;   // Earth perihelion longitude in radians
const prot_deg = 0.0000;
const qrot_deg = 0.2073;

function rotZ(x, y, z, a) {
    return [x*Math.cos(a) - y*Math.sin(a), x*Math.sin(a) + y*Math.cos(a), z];
}
function rotatePlaneToEcliptic(x, y, z, P, Q) {
    const cosP=Math.cos(P), sinP=Math.sin(P), cosQ=Math.cos(Q), sinQ=Math.sin(Q);
    return [cosP*x-sinP*cosQ*y+sinP*sinQ*z, sinP*x+cosP*cosQ*y-cosP*sinQ*z, sinQ*y+cosQ*z];
}

const lon = t => ((Math.atan2(t[1],t[0])*180/Math.PI)+360)%360;
const dist = t => Math.sqrt(t[0]*t[0]+t[1]*t[1]+t[2]*t[2]);

console.log('Input (perihelion frame):');
console.log(`  x=${x0.toFixed(4)}, y=${y0.toFixed(4)}, lon=${lon([x0,y0,z0]).toFixed(2)}°, dist=${dist([x0,y0,z0]).toFixed(4)}`);

// Step 1: Rz(peri) — rotate from perihelion frame to ascending-node frame
const after_peri = rotZ(x0, y0, z0, peri_rad);
console.log(`\nAfter Rz(peri=${(peri_rad*180/Math.PI).toFixed(2)}°):`);
console.log(`  x=${after_peri[0].toFixed(4)}, y=${after_peri[1].toFixed(4)}, lon=${lon(after_peri).toFixed(2)}°, dist=${dist(after_peri).toFixed(4)}`);

// Step 2: Rz(prot) × Rx(qrot)
const P = prot_deg * Math.PI/180;
const Q = qrot_deg * Math.PI/180;
const after_full = rotatePlaneToEcliptic(...after_peri, P, Q);
console.log(`\nAfter Rz(prot) × Rx(qrot):`);
console.log(`  x=${after_full[0].toFixed(4)}, y=${after_full[1].toFixed(4)}, lon=${lon(after_full).toFixed(2)}°, dist=${dist(after_full).toFixed(4)}`);
console.log(`  Expected: lon≈75.4°, dist≈0.983 AU`);

// Verify the peri values for all planets (should match known perihelion longitudes)
const periData = [
    { name: 'Mercury', peri: 1.3737, knownPeriLon: 77.5 },
    { name: 'Venus',   peri: 2.3082, knownPeriLon: 131.5 },
    { name: 'Earth',   peri: 1.8022, knownPeriLon: 102.9 },
    { name: 'Mars',    peri: 5.8781, knownPeriLon: 336.0 },
    { name: 'Jupiter', peri: 0.2473, knownPeriLon: 14.75 },
    { name: 'Saturn',  peri: 1.6126, knownPeriLon: 92.43 },
];

console.log('\n=== Peri validation (all should be in radians, matching known perihelion longitudes) ===');
for (const {name, peri, knownPeriLon} of periData) {
    const deg = peri * 180/Math.PI;
    const delta = Math.abs(deg - knownPeriLon);
    console.log(`  ${name}: peri=${peri} rad = ${deg.toFixed(2)}° vs known ${knownPeriLon}° (Δ=${delta.toFixed(2)}°)`);
}
