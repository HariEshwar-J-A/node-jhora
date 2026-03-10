/**
 * debug_echeb.mjs — Verify the correct echeb formula
 * Tests both implementations against known T_k(x) values.
 */

// The SE Clenshaw algorithm for sum_{k=0}^{ncoe-1} coef[k] * T_k(x)
// where coef[0] contributes c0/2 (half-coefficient convention).
//
// After the backward recurrence, the state is:
//   br   = b[1]    (last computed)
//   brp2 = b[2]    (second-to-last)
//   brpp = b[3]    (third-to-last, = 0 for n>=3 since b[n+1]=b[n]=0)
//
// WRONG return: t * brp2 - brpp + c0/2  (uses b[2] instead of b[1])
// CORRECT:      t * br   - brp2 + c0/2  (correct Clenshaw completion)

function echeb_WRONG(t, coef) {
    const x2 = 2.0 * t;
    let br = 0, brp2 = 0, brpp = 0;
    for (let j = coef.length - 1; j >= 1; j--) {
        brpp = brp2;
        brp2 = br;
        br   = x2 * brp2 - brpp + coef[j];
    }
    return t * brp2 - brpp + coef[0] / 2.0;  // WRONG: uses brp2 (=b[2])
}

function echeb_FIXED(t, coef) {
    const x2 = 2.0 * t;
    let br = 0, brp2 = 0, brpp = 0;
    for (let j = coef.length - 1; j >= 1; j--) {
        brpp = brp2;
        brp2 = br;
        br   = x2 * brp2 - brpp + coef[j];
    }
    return t * br - brp2 + coef[0] / 2.0;    // FIXED: uses br (=b[1])
}

// Known exact value: T_k(x)
function T(k, x) {
    if (k === 0) return 1;
    if (k === 1) return x;
    return 2*x*T(k-1, x) - T(k-2, x);
}

console.log('=== Verify echeb correctness ===');
console.log('Testing: f(x) = c0*T0 + c1*T1 + c2*T2 + c3*T3');
console.log('SE convention: f(x) = c0/2 + c1*T1 + c2*T2 + c3*T3 (c0 is stored *2)\n');

const tests = [
    { coef: [2, 0, 0, 0], desc: 'T0: c0=2 → f=1', x: 0.5 },
    { coef: [0, 1, 0, 0], desc: 'T1: c1=1 → f=x', x: 0.7 },
    { coef: [0, 0, 1, 0], desc: 'T2: c2=1 → f=2x²-1', x: 0.3 },
    { coef: [0, 0, 0, 1], desc: 'T3: c3=1 → f=4x³-3x', x: 0.4 },
    { coef: [2, 3, 5, 7], desc: 'Mixed: f=1+3x+5T2+7T3', x: 0.6 },
];

for (const {coef, desc, x} of tests) {
    // Expected: coef[0]/2 + sum_{k>=1} coef[k]*T_k(x)
    const expected = coef[0]/2 + coef.slice(1).reduce((s, c, i) => s + c * T(i+1, x), 0);
    const wrong    = echeb_WRONG(x, coef);
    const fixed    = echeb_FIXED(x, coef);
    console.log(`${desc} at x=${x}:`);
    console.log(`  expected=${expected.toFixed(8)}, WRONG=${wrong.toFixed(8)} (Δ=${(wrong-expected).toFixed(8)}), FIXED=${fixed.toFixed(8)} (Δ=${(fixed-expected).toFixed(8)})`);
}

console.log('\n=== Earth refep at dt=0.8679 ===');
// From debug: Earth refep_X = [0.562131, 0, 0.975611, 0, ...] (26 terms)
// We don't have all 26 terms, but let's test with first 4:
const earthRefepX_partial = [0.562131, 0.000000, 0.975611, -0.000000];
const dt = 0.8679;
const wrong_x = echeb_WRONG(dt, earthRefepX_partial);
const fixed_x = echeb_FIXED(dt, earthRefepX_partial);
console.log(`  WRONG result (first 4 terms): x=${wrong_x.toFixed(4)}`);
console.log(`  FIXED result (first 4 terms): x=${fixed_x.toFixed(4)}`);
console.log(`  Expected x_orb ≈ 0.895 AU (in orbital plane, near perihelion)`);
