/**
 * Bracketed Brent root finder for monotone-ish crossings (rise/set/transit).
 */

export interface BrentResult {
    root: number;
    iterations: number;
}

const EPS = 1e-12;

export function brent(
    f: (x: number) => number,
    a: number,
    b: number,
    tol = 1e-9,
    maxIter = 80,
): BrentResult | null {
    let fa = f(a);
    let fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
    if (fa === 0) return { root: a, iterations: 0 };
    if (fb === 0) return { root: b, iterations: 0 };
    if (fa * fb > 0) return null;

    if (Math.abs(fa) < Math.abs(fb)) {
        [a, b] = [b, a];
        [fa, fb] = [fb, fa];
    }

    let c = a;
    let fc = fa;
    let d = b - a;
    let e = d;
    let iter = 0;

    while (iter < maxIter) {
        iter++;
        if (Math.abs(fb) < tol || Math.abs(b - a) < tol) {
            return { root: b, iterations: iter };
        }

        if (Math.abs(fa - fc) > EPS && Math.abs(fb - fc) > EPS) {
            const s =
                (a * fb * fc) / ((fa - fb) * (fa - fc)) +
                (b * fa * fc) / ((fb - fa) * (fb - fc)) +
                (c * fa * fb) / ((fc - fa) * (fc - fb));
            if (
                Number.isFinite(s) &&
                s > Math.min(a, b) &&
                s < Math.max(a, b) &&
                Math.abs(s - b) < Math.abs(e) / 2
            ) {
                c = b;
                fc = fb;
                b = s;
                fb = f(b);
                if (!Number.isFinite(fb)) return null;
                if (fa * fb > 0) {
                    b = c;
                    fb = fc;
                    d = e = b - a;
                }
                continue;
            }
        }

        if (Math.abs(fb) < Math.abs(fc)) {
            a = b;
            b = c;
            c = a;
            fa = fb;
            fb = fc;
            fc = fa;
        }

        const m = 0.5 * (c - b);
        if (Math.abs(m) < tol || fb === 0) {
            return { root: b, iterations: iter };
        }

        if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
            let p: number;
            let q: number;
            const s = fb / fa;
            if (a === c) {
                p = 2 * m * s;
                q = 1 - s;
            } else {
                q = fa / fc;
                const r = fb / fc;
                p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
                q = (q - 1) * (r - 1) * (s - 1);
            }
            if (p > 0) q = -q;
            p = Math.abs(p);
            const min1 = 3 * m * q - Math.abs(tol * q);
            const min2 = Math.abs(e * q);
            if (2 * p < (min1 < min2 ? min1 : min2)) {
                e = d;
                d = p / q;
            } else {
                d = m;
                e = m;
            }
        } else {
            d = m;
            e = m;
        }

        a = b;
        fa = fb;
        if (Math.abs(d) > tol) b += d;
        else b += Math.sign(m) * tol;
        fb = f(b);
        if (!Number.isFinite(fb) || !Number.isFinite(b)) return null;
    }

    return { root: b, iterations: iter };
}
