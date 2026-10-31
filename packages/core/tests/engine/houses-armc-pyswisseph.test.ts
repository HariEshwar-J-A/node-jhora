import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    computeTropicalHouses,
    sunshineMakranskyLongArcWedge,
    type HouseLetter,
} from '../../src/engine/house-systems.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../fixtures/houses_armc_pyswisseph.json');

type FixtureCase = {
    letter: string;
    armc: number;
    lat: number;
    eps: number;
    sunDeclination: number | null;
    sunEclipticLongitude: number | null;
    cusps: number[];
    asc: number;
    mc: number;
};

type Fixture = {
    meta: { toleranceArcsec: number };
    cases: FixtureCase[];
};

/**
 * Makransky (`i`) long-semi-arc wedge: min(DSA, NSA) &lt; 45° (Treindl fallback; see ADR 0017).
 * All other letters assert ≤0.001″ vs pyswisseph.
 */
const I_WEDGE_GAP =
    'Sunshine Makransky (i): long semi-arc wedge (min(DSA,NSA)<45°) — no closed form yet';

function knownGapReason(c: FixtureCase): string | undefined {
    if (c.letter !== 'i') return undefined;
    if (c.sunDeclination == null) return I_WEDGE_GAP;
    if (sunshineMakranskyLongArcWedge(c.lat, c.sunDeclination)) return I_WEDGE_GAP;
    return undefined;
}

function gapArcsec(a: number, b: number): number {
    const d = ((((a - b + 180) % 360) + 360) % 360) - 180;
    return Math.abs(d) * 3600;
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;
const tol = fixture.meta.toleranceArcsec;

describe('houses_armc geometry vs pyswisseph', () => {
    for (const c of fixture.cases) {
        const letter = c.letter as HouseLetter;
        const gapReason = knownGapReason(c);
        const run = gapReason ? it.skip : it;
        run(
            `${letter} armc=${c.armc.toFixed(3)} lat=${c.lat.toFixed(3)}${gapReason ? ` — ${gapReason}` : ''}`,
            () => {
                if (gapReason) {
                    return;
                }
                const r = computeTropicalHouses(letter, c.armc, c.lat, c.eps, c.asc, c.mc, 0, {
                    placidusScheme: 'converged',
                    polarFallback: 'porphyry',
                    ...(c.sunEclipticLongitude != null
                        ? { sunEclipticLongitude: c.sunEclipticLongitude }
                        : {}),
                });
                const pred = letter === 'G' ? (r.gauquelinSectors ?? r.cusps) : r.cusps;
                expect(pred.length).toBe(c.cusps.length);
                let max = 0;
                for (let i = 0; i < c.cusps.length; i++) {
                    max = Math.max(max, gapArcsec(pred[i], c.cusps[i]));
                }
                expect(max).toBeLessThanOrEqual(tol);
            },
        );
    }
});
