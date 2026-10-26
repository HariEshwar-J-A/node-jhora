/**
 * DE440s provider — wraps the existing SPK reader for 1849–2150.
 */

import type { SpkFile } from '../spk.js';
import { NAIF } from '../spk.js';
import { J2000_JD, SECONDS_PER_DAY } from './time.js';
import type {
    EphemerisBodyId,
    EphemerisFrame,
    EphemerisProvider,
    EphemerisState,
} from './types.js';

/** Coverage of de440s.bsp (matches @node-jhora/ephe download.mjs). */
export const DE440S_UTC_START = { y: 1849, m: 12, d: 26 };
export const DE440S_UTC_END = { y: 2150, m: 1, d: 22 };

/**
 * TDB Julian day bounds of every Type-2 segment in de440s.bsp
 * (ET -4734072000 .. 4735368000 s = 1849-12-26 .. 2150-01-22 0h TDB, Gregorian).
 */
export const DE440S_JD_TDB_START = 2396752.5;
export const DE440S_JD_TDB_END = 2506352.5;

const SUPPORTED: readonly EphemerisBodyId[] = [
    NAIF.Sun,
    NAIF.Mercury,
    NAIF.Venus,
    NAIF.Earth,
    NAIF.Moon,
    NAIF.Mars,
    NAIF.Jupiter,
    NAIF.Saturn,
    NAIF.Uranus,
    NAIF.Neptune,
    NAIF.Pluto,
];

export class De440sEphemerisProvider implements EphemerisProvider {
    readonly id = 'de440s';
    readonly coverage = {
        jdTdbStart: DE440S_JD_TDB_START,
        jdTdbEnd: DE440S_JD_TDB_END,
        kernelId: 'de440s',
        version: '440',
    };
    readonly bodies = SUPPORTED;

    constructor(private readonly spk: SpkFile) {}

    state(jdTdb: number, body: EphemerisBodyId, frame: EphemerisFrame): EphemerisState {
        const et = (jdTdb - J2000_JD) * SECONDS_PER_DAY;
        const bary = this.spk.getBarycentric(body, et);
        if (frame === 'barycentric') return bary;
        const sun = this.spk.getBarycentric(NAIF.Sun, et);
        return {
            x: bary.x - sun.x,
            y: bary.y - sun.y,
            z: bary.z - sun.z,
            vx: bary.vx - sun.vx,
            vy: bary.vy - sun.vy,
            vz: bary.vz - sun.vz,
        };
    }
}
