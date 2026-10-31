import {
    icrfToMeanEclipticOfDate,
    matVec,
    meanObliquity,
    rotateX,
    toSpherical,
    vondrakEquatorPrecessionMatrixSigma,
    vondrakPrecessionMatrix,
    type Vec,
} from '../../src/engine/precession.js';

function angleArcsec(a: Vec, b: Vec): number {
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return ((Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI) * 3600;
}

function dot(a: Vec, b: Vec): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

describe('Vondrák 2011 precession frames', () => {
    test('P_Σ (§5.5 eq. 24–28) rows are orthonormal at J2000 and at T = −100', () => {
        for (const T of [0, -100]) {
            const m = vondrakEquatorPrecessionMatrixSigma(T);
            for (const row of m) {
                expect(Math.hypot(row[0], row[1], row[2])).toBeCloseTo(1, 10);
            }
            expect(Math.abs(dot(m[0], m[1]))).toBeLessThan(1e-10);
            expect(Math.abs(dot(m[0], m[2]))).toBeLessThan(1e-10);
            expect(Math.abs(dot(m[1], m[2]))).toBeLessThan(1e-10);
        }
    });

    test('P_Σ equator pole matches Fabri A.3 pole (Table 2 only)', () => {
        for (const T of [0, 10, -100, -1000]) {
            const fab = vondrakPrecessionMatrix(T);
            const sig = vondrakEquatorPrecessionMatrixSigma(T);
            expect(angleArcsec(fab[2], sig[2])).toBeLessThan(0.01);
        }
    });

    test('sidereal mean ecliptic (Fabri P + ε_A) matches O4 equinox line to sub-milliarcsec', () => {
        const T = 10;
        const fab = vondrakPrecessionMatrix(T);
        const n = fab[2];
        const ey = fab[1];
        const eps = (meanObliquity(T) * Math.PI) / 180;
        const pTilt: Vec = [
            Math.cos(eps) * n[0] - Math.sin(eps) * ey[0],
            Math.cos(eps) * n[1] - Math.sin(eps) * ey[1],
            Math.cos(eps) * n[2] - Math.sin(eps) * ey[2],
        ];
        const h = Math.hypot(pTilt[0], pTilt[1], pTilt[2]);
        const pU: Vec = [pTilt[0] / h, pTilt[1] / h, pTilt[2] / h];
        const cross = (a: Vec, b: Vec): Vec => [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ];
        let exO4 = cross(n, pU);
        const hn = Math.hypot(exO4[0], exO4[1], exO4[2]);
        exO4 = [exO4[0] / hn, exO4[1] / hn, exO4[2] / hn];
        if (exO4[0] * fab[0][0] + exO4[1] * fab[0][1] + exO4[2] * fab[0][2] < 0) {
            exO4 = [-exO4[0], -exO4[1], -exO4[2]];
        }
        expect(angleArcsec(fab[0], exO4)).toBeLessThan(0.01);
    });

    test('P_Σ CIO equinox is not the sidereal Fabri equinox far from J2000', () => {
        const T = 10;
        const fab = vondrakPrecessionMatrix(T);
        const sig = vondrakEquatorPrecessionMatrixSigma(T);
        expect(angleArcsec(fab[0], sig[0])).toBeGreaterThan(1);
    });

    test('icrfToMeanEclipticOfDate equals explicit R₁(ε_A) · P_fabri · v', () => {
        const T = -37.5;
        const v: Vec = [0.3, -0.2, 0.4];
        const jd = 2451545 + T * 36525;
        const explicit = rotateX(matVec(vondrakPrecessionMatrix(T), v), meanObliquity(T, jd));
        const got = icrfToMeanEclipticOfDate(v, T, jd);
        expect(toSpherical(got).lon).toBeCloseTo(toSpherical(explicit).lon, 12);
        expect(toSpherical(got).lat).toBeCloseTo(toSpherical(explicit).lat, 12);
    });
});
