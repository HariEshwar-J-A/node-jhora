/**
 * @provenance Stephenson, F. R., Morrison, L. V. & Hohenkerk, C. Y. (2016),
 * "Measurement of the Earth's rotation: 720 BC to AD 2015",
 * Proc. R. Soc. A 472: 20160404, https://doi.org/10.1098/rspa.2016.0404.
 *
 * Table S15, "The Polynomial Coefficients for DT −720.0 to 2016.0" (cubic
 * spline of ΔT = TT − UT, seconds), from the paper's electronic supplementary
 * material: figshare https://doi.org/10.6084/m9.figshare.4290866, file
 * rspa20160404_si_002.zip (figshare file id 6998699, MD5
 * 322c18c812171a2c0c959509e093faf4), member Table-S15.txt.
 *
 * Table S15 provenance note: these 54 rows were first transcribed, then
 * compared row by row against Table-S15.txt in the figshare archive above
 * (downloaded 2026-10-26; all 54 rows identical). They are the 2016
 * supplement as published with the paper.
 *
 * Each row is [K_i, K_{i+1}, a0, a1, a2, a3]. For K_i ≤ Y < K_{i+1},
 * t = (Y − K_i)/(K_{i+1} − K_i) and ΔT = a0 + a1·t + a2·t² + a3·t³ (the
 * table's own notes). The spline is on the authors' lunar tidal acceleration;
 * deltat.ts moves it to the ephemeris value.
 */
export const SMH2016_S15: readonly (readonly [number, number, number, number, number, number])[] = [
    [-720.0, 400.0, 20550.593, -21268.478, 11863.418, -4541.129],
    [400.0, 1000.0, 6604.404, -5981.266, -505.093, 1349.609],
    [1000.0, 1500.0, 1467.654, -2452.187, 2460.927, -1183.759],
    [1500.0, 1600.0, 292.635, -216.322, -43.614, 56.681],
    [1600.0, 1650.0, 89.38, -66.754, 31.607, -10.497],
    [1650.0, 1720.0, 43.736, -49.043, 0.227, 15.811],
    [1720.0, 1800.0, 10.73, -1.321, 62.25, -52.946],
    [1800.0, 1810.0, 18.714, -4.457, -1.509, 2.507],
    [1810.0, 1820.0, 15.255, 0.046, 6.012, -4.634],
    [1820.0, 1830.0, 16.679, -1.831, -7.889, 3.799],
    [1830.0, 1840.0, 10.758, -6.211, 3.509, -0.388],
    [1840.0, 1850.0, 7.668, -0.357, 2.345, -0.338],
    [1850.0, 1855.0, 9.317, 1.659, 0.332, -0.932],
    [1855.0, 1860.0, 10.376, -0.472, -2.463, 1.596],
    [1860.0, 1865.0, 9.038, -0.61, 2.325, -2.497],
    [1865.0, 1870.0, 8.256, -3.45, -5.166, 2.729],
    [1870.0, 1875.0, 2.369, -5.596, 3.02, -0.919],
    [1875.0, 1880.0, -1.126, -2.312, 0.264, -0.037],
    [1880.0, 1885.0, -3.211, -1.894, 0.154, 0.562],
    [1885.0, 1890.0, -4.388, 0.101, 1.841, -1.438],
    [1890.0, 1895.0, -3.884, -0.531, -2.473, 1.87],
    [1895.0, 1900.0, -5.017, 0.134, 3.138, -0.232],
    [1900.0, 1905.0, -1.977, 5.715, 2.443, -1.257],
    [1905.0, 1910.0, 4.923, 6.828, -1.329, 0.72],
    [1910.0, 1915.0, 11.142, 6.33, 0.831, -0.825],
    [1915.0, 1920.0, 17.479, 5.518, -1.643, 0.262],
    [1920.0, 1925.0, 21.617, 3.02, -0.856, 0.008],
    [1925.0, 1930.0, 23.789, 1.333, -0.831, 0.127],
    [1930.0, 1935.0, 24.418, 0.052, -0.449, 0.142],
    [1935.0, 1940.0, 24.164, -0.419, -0.022, 0.702],
    [1940.0, 1945.0, 24.426, 1.645, 2.086, -1.106],
    [1945.0, 1950.0, 27.05, 2.499, -1.232, 0.614],
    [1950.0, 1953.0, 28.932, 1.127, 0.22, -0.277],
    [1953.0, 1956.0, 30.002, 0.737, -0.61, 0.631],
    [1956.0, 1959.0, 30.76, 1.409, 1.282, -0.799],
    [1959.0, 1962.0, 32.652, 1.577, -1.115, 0.507],
    [1962.0, 1965.0, 33.621, 0.868, 0.406, 0.199],
    [1965.0, 1968.0, 35.093, 2.275, 1.002, -0.414],
    [1968.0, 1971.0, 37.956, 3.035, -0.242, 0.202],
    [1971.0, 1974.0, 40.951, 3.157, 0.364, -0.229],
    [1974.0, 1977.0, 44.244, 3.198, -0.323, 0.172],
    [1977.0, 1980.0, 47.291, 3.069, 0.193, -0.192],
    [1980.0, 1983.0, 50.361, 2.878, -0.384, 0.081],
    [1983.0, 1986.0, 52.936, 2.354, -0.14, -0.166],
    [1986.0, 1989.0, 54.984, 1.577, -0.637, 0.448],
    [1989.0, 1992.0, 56.373, 1.649, 0.709, -0.277],
    [1992.0, 1995.0, 58.453, 2.235, -0.122, 0.111],
    [1995.0, 1998.0, 60.677, 2.324, 0.212, -0.315],
    [1998.0, 2001.0, 62.899, 1.804, -0.732, 0.112],
    [2001.0, 2004.0, 64.082, 0.675, -0.396, 0.193],
    [2004.0, 2007.0, 64.555, 0.463, 0.184, -0.008],
    [2007.0, 2010.0, 65.194, 0.809, 0.161, -0.101],
    [2010.0, 2013.0, 66.063, 0.828, -0.142, 0.168],
    [2013.0, 2016.0, 66.917, 1.046, 0.36, -0.282],
];

/** Knot year of the first Table S15 segment (−720…400). */
export const SMH2016_SPLINE_FIRST_YEAR = SMH2016_S15[0][0];

/**
 * Long-term parabola for Y < −720 from Stephenson, Morrison & Hohenkerk (2016),
 * Table S15 notes: ΔT = −320 + 32.5 u², u = (Y − 1825)/100.
 */
export const SMH2016_ANCIENT_PARABOLA_OFFSET = -320;
export const SMH2016_ANCIENT_PARABOLA_COEFF = 32.5;
export const SMH2016_ANCIENT_PARABOLA_ORIGIN = 1825;

/** Table S15 discussion parabola (eq. 4.1), seconds, for Y ≪ −720. */
export function deltaTSmh2016Parabola(y: number): number {
    const u = (y - SMH2016_ANCIENT_PARABOLA_ORIGIN) / 100;
    return SMH2016_ANCIENT_PARABOLA_OFFSET + SMH2016_ANCIENT_PARABOLA_COEFF * u * u;
}

/**
 * Parabola minus the first spline knot value at Y = −720 (Table S15 `a0`).
 * SMH2016 joins the long-term parabola to the cubic spline at −720 (Table S15
 * notes): spline for Y ≥ −720, shifted parabola for Y < −720.
 */
export const SMH2016_PARABOLA_SPLINE_JOIN_OFFSET =
    deltaTSmh2016Parabola(SMH2016_SPLINE_FIRST_YEAR) - SMH2016_S15[0][2];

/** Parabola (4.1) aligned to the Table S15 knot at −720. */
export function deltaTSmh2016Ancient(y: number): number {
    return deltaTSmh2016Parabola(y) - SMH2016_PARABOLA_SPLINE_JOIN_OFFSET;
}

/** Table S15 cubic spline of ΔT (seconds) on the authors' n′ = −25.85″/cy². */
export function deltaTSmh2016Spline(y: number): number {
    if (y < SMH2016_SPLINE_FIRST_YEAR) {
        return deltaTSmh2016Ancient(y);
    }
    for (const [k0, k1, a0, a1, a2, a3] of SMH2016_S15) {
        if (y < k1) {
            const t = (y - k0) / (k1 - k0);
            return a0 + t * (a1 + t * (a2 + t * a3));
        }
    }
    const [k0, k1, a0, a1, a2, a3] = SMH2016_S15[SMH2016_S15.length - 1];
    const t = (y - k0) / (k1 - k0);
    return a0 + t * (a1 + t * (a2 + t * a3));
}
