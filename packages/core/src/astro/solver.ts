// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Bracketed root finder (Brent 1971 / 1973 `zero`, zeroin structure).
 *
 * @provenance Brent, R.P. 1971, Computer J. 14(4), 422–425,
 * DOI 10.1093/comjnl/14.4.422; Brent 1973, *Algorithms for Minimization without
 * Derivatives*, ch. 4 (procedure `zero`). Cross-check: netlib `go/zeroin.f`.
 */

export interface BrentResult {
    root: number;
    iterations: number;
}

const MACHEPS = Number.EPSILON;

/**
 * Find a zero of `f` in `(a, b)` when `f(a)` and `f(b)` have opposite signs.
 * Returns `null` when the bracket is invalid or evaluation fails.
 *
 * Termination uses bracket half-width `m = (c − b)/2` with tolerance
 * `2·ε·|b| + tol/2`, and when `f(b) === 0`.
 */
export function brent(
    f: (x: number) => number,
    ax: number,
    bx: number,
    tol = 1e-9,
    maxIter = 80,
): BrentResult | null {
    let a = ax;
    let b = bx;
    let fa = f(a);
    let fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
    if (fa === 0) return { root: a, iterations: 0 };
    if (fb === 0) return { root: b, iterations: 0 };
    if (fa * fb > 0) return null;

    let c = a;
    let fc = fa;
    let d = b - a;
    let e = d;
    let iter = 0;

    while (iter < maxIter) {
        iter++;

        if (Math.abs(fc) >= Math.abs(fb)) {
            a = b;
            b = c;
            c = a;
            fa = fb;
            fb = fc;
            fc = fa;
        }

        const tol1 = 2 * MACHEPS * Math.abs(b) + 0.5 * tol;
        const xm = 0.5 * (c - b);
        if (Math.abs(xm) <= tol1 || fb === 0) {
            return { root: b, iterations: iter };
        }

        if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
            let p: number;
            let q: number;
            const s = fb / fa;
            if (a === c) {
                p = 2 * xm * s;
                q = 1 - s;
            } else {
                q = fa / fc;
                const r = fb / fc;
                p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1));
                q = (q - 1) * (r - 1) * (s - 1);
            }
            if (p > 0) q = -q;
            p = Math.abs(p);
            const min1 = 3 * xm * q - Math.abs(tol1 * q);
            const min2 = Math.abs(e * q);
            if (2 * p < (min1 < min2 ? min1 : min2)) {
                e = d;
                d = p / q;
            } else {
                d = xm;
                e = d;
            }
        } else {
            d = xm;
            e = d;
        }

        a = b;
        fa = fb;
        if (Math.abs(d) > tol1) {
            b += d;
        } else if (xm <= 0) {
            b -= tol1;
        } else {
            b += tol1;
        }

        fb = f(b);
        if (!Number.isFinite(fb) || !Number.isFinite(b)) return null;

        if (Math.abs(fb) > 0 && Math.abs(fc) > 0 && fb * (fc / Math.abs(fc)) > 0) {
            c = a;
            fc = fa;
            d = e = b - a;
        }
    }

    return { root: b, iterations: iter };
}
