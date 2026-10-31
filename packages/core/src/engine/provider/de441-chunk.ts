/**
 * DE441 long-range NJCE chunk reader — same `.njce` layout as DE431
 * (coefficients copied verbatim from JPL DE441 part-1/part-2 BSP kernels).
 */

import { NJCE441_MAX_CENTURY, NJCE441_MIN_CENTURY } from '../../ephemeris-data/manifest.de441.js';
import { NodeJHoraError, NodeJHoraErrorCode } from '../../errors.js';
import { NAIF } from '../spk.js';
import { NJCE_TT_JD_MAX_REQUIRED, NJCE_TT_JD_MIN_REQUIRED } from './chunk-coverage.js';
import {
    BODY_GROUP_EMB,
    BODY_GROUP_PLANETS,
    centuryIndex,
    De431ChunkFile,
    jdTdbToAstronomicalYear,
} from './de431-chunk.js';
import { J2000_JD, SECONDS_PER_DAY } from './time.js';
import type {
    EphemerisBodyId,
    EphemerisFrame,
    EphemerisProvider,
    EphemerisState,
} from './types.js';

/** Re-export — DE441 chunks use the same NJCE v1 binary format. */
export { De431ChunkFile as De441ChunkFile };

/** JPL DE441 native TDB Julian-day span (part-1 + part-2, inclusive). */
export const DE441_NATIVE_JD_TDB_START = -3_100_015.5;
export const DE441_NATIVE_JD_TDB_END = 8_000_016.5;

/** Advertised TT coverage for built NJCE chunks (engine UT bounds + margins). */
export const DE441_LONG_JD_TDB_START = NJCE_TT_JD_MIN_REQUIRED;
export const DE441_LONG_JD_TDB_END = NJCE_TT_JD_MAX_REQUIRED;

export class De441LongEphemerisProvider implements EphemerisProvider {
    readonly id = 'de441_long';
    readonly coverage = {
        jdTdbStart: DE441_LONG_JD_TDB_START,
        jdTdbEnd: DE441_LONG_JD_TDB_END,
        kernelId: 'de441-long',
        version: '441',
    };
    readonly bodies = [
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
    ] as const;

    constructor(
        private readonly getChunk: (century: number, groupId: number) => De431ChunkFile | undefined,
    ) {}

    private resolveChunk(nominalCentury: number, groupId: number, et: number): De431ChunkFile {
        const candidates = [nominalCentury, nominalCentury - 1, nominalCentury + 1].filter(
            (c) => c >= NJCE441_MIN_CENTURY && c <= NJCE441_MAX_CENTURY,
        );
        for (const c of candidates) {
            const chunk = this.getChunk(c, groupId);
            if (chunk?.coversGroupAtEt(groupId, et)) return chunk;
        }
        throw new NodeJHoraError(
            NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
            `No DE441 NJCE chunk contains TT ephemeris time ET=${et} for group=${groupId} ` +
                `(nominal century=${nominalCentury}). Build long-range data with ` +
                '`pnpm --filter @node-jhora/ephe441 run build:chunks` and refresh the manifest.',
            { nominalCentury, groupId, et },
        );
    }

    state(jdTdb: number, body: EphemerisBodyId, frame: EphemerisFrame): EphemerisState {
        const et = (jdTdb - J2000_JD) * SECONDS_PER_DAY;
        const astroYear = jdTdbToAstronomicalYear(jdTdb);
        const cent = centuryIndex(astroYear);
        const group =
            body === NAIF.Moon || body === NAIF.Earth || body === NAIF.EMB
                ? BODY_GROUP_EMB
                : BODY_GROUP_PLANETS;
        const chunk = this.resolveChunk(cent, group, et);
        const bary = chunk.getBarycentric(body, et);
        if (frame === 'barycentric') return bary;
        const sun = chunk.getBarycentric(NAIF.Sun, et);
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
