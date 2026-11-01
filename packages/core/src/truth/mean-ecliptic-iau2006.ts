// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import type { PrecisionProfile } from '../engine/deltat.js';
import type { Vec } from '../engine/precession.js';
import {
    icrfToMeanEclipticOfDate,
    icrfToVondrakTwoPoleMeanEcliptic,
} from '../engine/precession.js';

const R = Math.PI / 648000,
    J0 = 2305448.0,
    J1 = 2524594.0,
    K = [
        -0.052928, 10.556378, 0.4932044, -0.00031238, -0.000002788, 2.6e-8, 84381.412819,
        -46.811016, 0.0511268, 0.00053289, -4.4e-7, -1.76e-8, -0.041775, 5038.481484, 1.5584175,
        -0.00018522, -0.000026452, -1.48e-8, 84381.406, -46.836769, -0.0001831, 0.0020034, -5.76e-7,
        -4.34e-8,
    ] as const;

const p6 = (b: number, T: number) => {
    const i = b * 6;
    let v = K[i]!,
        t = T;
    for (let k = 1; k < 6; k++) {
        v += K[i + k]! * t;
        t *= T;
    }
    return v * R;
};

const rz = (v: Vec, a: number): Vec => {
    const c = Math.cos(a),
        s = Math.sin(a);
    return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c, v[2]];
};

const rx = (v: Vec, a: number): Vec => {
    const c = Math.cos(a),
        s = Math.sin(a);
    return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
};

const e6 = (v: Vec, T: number): Vec =>
    rx(rx(rz(rx(rz(v, p6(0, T)), p6(1, T)), -p6(2, T)), -p6(3, T)), p6(3, T));

export function icrfToMeanEclipticOfDateForProfile(
    v: Vec,
    T: number,
    jdTT: number,
    profile: PrecisionProfile,
): Vec {
    if (profile !== 'truth') return icrfToMeanEclipticOfDate(v, T, jdTT);
    if (jdTT >= J0 && jdTT <= J1) return e6(v, T);
    return icrfToVondrakTwoPoleMeanEcliptic(v, T);
}
