/**
 * Black-box probe: which osculating-node frame matches fixture oracles (DE440s cases).
 * Logs ranked variants; does not fail CI on residual size.
 */
import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import { getAyanamsa, toSidereal } from '../../src/engine/ayanamsa.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import {
    trueAscendingNodeLongitude,
    type TrueNodeEclipticFrame,
    type TrueNodeVelocityMode,
} from '../../src/engine/lunar-node.js';
import type { BarycentricSource } from '../../src/engine/apparent.js';
import type { PrecisionProfile } from '../../src/engine/deltat.js';
import { withDeltaTContext } from '../../src/engine/deltat.js';

import {
    NODE_CASES,
    inDe440s,
    inWindow,
    oracleOf,
    type NodeMode,
} from './lunar-node-oracle-support.js';

const modern = JSON.parse(
    readFileSync(new URL('../fixtures/modern_se210_golden.json', import.meta.url), 'utf8'),
) as { cases: { utc: string; jdUT: number; bodies: { TrueNode: number } }[] };

const DE440S_FIRST = 2396758.5 + 1;
const DE440S_LAST = 2506331.5 - 1;

const oracleDe440s = NODE_CASES.filter((c) => inWindow(c) && inDe440s(c.jd));

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

type SourceHolder = {
    composite: {
        getBarycentricForLunarNode: (b: number, et: number, p: PrecisionProfile) => unknown;
    };
};

function siderealNode(
    jd: number,
    source: BarycentricSource,
    profile: PrecisionProfile,
    opts: Parameters<typeof trueAscendingNodeLongitude>[2],
): number {
    const trop = withDeltaTContext({ profile }, () => trueAscendingNodeLongitude(jd, source, opts));
    return toSidereal(trop, getAyanamsa(27, jd, 'geometric'));
}

describe('true-node frame probe (informational)', () => {
    let engine: EphemerisEngine;
    let lunarSource: BarycentricSource;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
        const comp = (engine as unknown as SourceHolder).composite;
        lunarSource = {
            getBarycentric: (b, et) =>
                comp.getBarycentricForLunarNode(b, et, 'modern') as ReturnType<
                    BarycentricSource['getBarycentric']
                >,
        };
    });

    test('rank frame/velocity variants vs modern_se210 TrueNode', () => {
        const frames: TrueNodeEclipticFrame[] = [
            'mean_ecliptic_of_date',
            'true_obliquity_ecliptic',
            'j2000_mean_ecliptic',
        ];
        const velocities: TrueNodeVelocityMode[] = ['spk_analytic', 'fd_1s', 'fd_60s'];
        const spins = [true, false];
        const max: Record<string, number> = {};

        for (const frame of frames) {
            for (const velocityMode of velocities) {
                for (const precessionSpin of spins) {
                    const key = `${frame}|${velocityMode}|spin=${precessionSpin}`;
                    max[key] = 0;
                    for (const c of modern.cases) {
                        if (c.jdUT <= DE440S_FIRST || c.jdUT >= DE440S_LAST) continue;
                        const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
                        const jd = engine.julday(utc);
                        const sid = siderealNode(jd, lunarSource, 'modern', {
                            eclipticFrame: frame,
                            velocityMode,
                            precessionSpin,
                        });
                        max[key] = Math.max(max[key], gapArcsec(sid, c.bodies.TrueNode));
                    }
                }
            }
        }

        const ranked = Object.entries(max).sort((a, b) => a[1] - b[1]);
        // eslint-disable-next-line no-console
        console.log('true-node probe (modern oracle, DE440s cases), best 8:');
        for (const [k, v] of ranked.slice(0, 8)) {
            // eslint-disable-next-line no-console
            console.log(`  ${v.toFixed(4)}″  ${k}`);
        }
        expect(ranked.length).toBeGreaterThan(0);
    });

    test('rank frame/velocity variants vs lunar-node-oracle True (DE440s, 0..2150)', () => {
        const frames: TrueNodeEclipticFrame[] = [
            'mean_ecliptic_of_date',
            'true_obliquity_ecliptic',
            'j2000_mean_ecliptic',
        ];
        const velocities: TrueNodeVelocityMode[] = ['spk_analytic', 'fd_1s', 'fd_60s'];
        const spins = [true, false];
        const max: Record<string, number> = {};

        for (const frame of frames) {
            for (const velocityMode of velocities) {
                for (const precessionSpin of spins) {
                    const key = `${frame}|${velocityMode}|spin=${precessionSpin}`;
                    max[key] = 0;
                    for (const c of oracleDe440s) {
                        const jd = c.jd;
                        const sid = siderealNode(jd, lunarSource, 'modern', {
                            eclipticFrame: frame,
                            velocityMode,
                            precessionSpin,
                        });
                        const exp = oracleOf(c, 'M' satisfies NodeMode).true.lon;
                        max[key] = Math.max(max[key], gapArcsec(sid, exp));
                    }
                }
            }
        }

        const ranked = Object.entries(max).sort((a, b) => a[1] - b[1]);
        // eslint-disable-next-line no-console
        console.log('true-node probe (lunar-node-oracle modern, DE440s), best 5:');
        for (const [k, v] of ranked.slice(0, 5)) {
            // eslint-disable-next-line no-console
            console.log(`  ${v.toFixed(4)}″  ${k}`);
        }
        expect(ranked[0][0]).toContain('mean_ecliptic_of_date');
        expect(ranked[0][0]).toContain('spin=false');
    });
});
