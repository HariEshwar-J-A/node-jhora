/**
 * Swiss Ephemeris 2.10 comparison — informational only.
 *
 * The hard < 1″ contract is against the Swiss Ephemeris 2.02 build that ships
 * inside JHora (jhora-dll.golden.test.ts). These pyswisseph 2.10 samples
 * (JPL DE440, True Citra, tools/generate-se-golden.py) differ from that build
 * in ΔT, in the ayanamsa frame (SE 2.10 apparent vs JHora geometric) and in
 * the Placidus iteration, so they are only reported here, with a coarse
 * sanity bound that catches gross regressions.
 *
 * Houses are compared in the opt-in 'se-apparent' frame, which is what
 * swe_houses_ex reports; everything else uses the public defaults.
 */

import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { deltaT } from '../../src/engine/deltat.js';

interface SeHouse {
    ascendant: number;
    mc: number;
    armc: number;
    vertex: number;
    cusps: number[];
}

interface SeChart {
    id: string;
    jd: number;
    utc: { year: number; month: number; day: number; hour: number; minute: number; second: number };
    lat: number;
    lon: number;
    ayanamsa: number;
    deltaT: number;
    planets: Record<string, number>;
    trueNode: number;
    meanNode: number;
    houses: Record<string, SeHouse>;
}

const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/se_golden.json', import.meta.url), 'utf8'),
) as { charts: SeChart[] };

/** Coarse sanity bound — not an accuracy contract. */
const SANITY_ARCSEC = 120;

const worst = new Map<string, number>();
afterAll(() => {
    const rows = [...worst.entries()].map(
        ([k, v]) => `${k.padEnd(14)} ${v.toFixed(3)}${k.endsWith('(s)') ? ' s' : '″'}`,
    );
    // eslint-disable-next-line no-console
    console.log(`SE 2.10 comparison (informational), max |Δ|:\n${rows.join('\n')}`);
});

const GRAHAS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
const HOUSE_SYSTEMS = ['W', 'E', 'P', 'O'] as const;

/** |a − b| in arcseconds, wrapped across 0°/360°. */
function gapArcsec(a: number, b: number): number {
    let d = a - b;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

const ketu = (lon: number): number => (((lon + 180) % 360) + 360) % 360;

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
    engine.setAyanamsa(27);
}, 30_000);

describe.each(fixture.charts)('Swiss Ephemeris 2.10 comparison — $id', (chart) => {
    const utc = DateTime.fromObject(chart.utc, { zone: 'utc' });

    test('stays within the sanity bound of SE 2.10', () => {
        const jd = engine.julday(utc);
        expect(Math.abs(jd - chart.jd)).toBeLessThan(1e-6);
        // ΔT differs between SE 2.10 and the SE 2.02 model JHora uses (by
        // ~13 s near 2026, more in the extrapolated future); report it only.
        const dtGap = Math.abs(deltaT(jd) - chart.deltaT);
        worst.set('ΔT (s)', Math.max(worst.get('ΔT (s)') ?? 0, dtGap));

        const failures: string[] = [];
        const check = (label: string, got: number, expected: number) => {
            const err = gapArcsec(got, expected);
            const key = label.replace(/ cusp \d+$/, ' cusps');
            worst.set(key, Math.max(worst.get(key) ?? 0, err));
            if (!(err < SANITY_ARCSEC)) failures.push(`${label} ${err.toFixed(3)}″`);
        };

        // swe_get_ayanamsa_ut reports the apparent star place (opt-in here).
        check('ayanamsa', engine.getAyanamsa(jd, 27, 0, 'apparent'), chart.ayanamsa);

        const byName = (list: ReturnType<EphemerisEngine['getPlanets']>) =>
            new Map(list.map((p) => [p.name, p.longitude]));

        const geometric = byName(engine.getPlanets(utc, undefined, { nodeType: 'true' }));
        for (const name of GRAHAS) check(name, geometric.get(name)!, chart.planets[name]);
        check('Rahu true', geometric.get('Rahu')!, chart.trueNode);
        check('Ketu true', geometric.get('Ketu')!, ketu(chart.trueNode));

        const mean = byName(engine.getPlanets(utc, undefined, { nodeType: 'mean' }));
        check('Rahu mean', mean.get('Rahu')!, chart.meanNode);
        check('Ketu mean', mean.get('Ketu')!, ketu(chart.meanNode));

        for (const system of HOUSE_SYSTEMS) {
            const got = engine.getHouses(
                jd,
                chart.lat,
                chart.lon,
                system,
                true,
                27,
                0,
                'se-apparent',
            );
            const exp = chart.houses[system];
            check(`${system} asc`, got.ascendant, exp.ascendant);
            check(`${system} mc`, got.mc, exp.mc);
            check(`${system} armc`, got.armc, exp.armc);
            check(`${system} vertex`, got.vertex, exp.vertex);
            exp.cusps.forEach((cusp, i) => check(`${system} cusp ${i + 1}`, got.cusps[i], cusp));
        }

        expect(failures).toEqual([]);
    });
});
