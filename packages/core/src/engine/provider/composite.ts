/**
 * Routes ephemeris queries between DE440s (in-range, byte-identical default),
 * optional DE441 long-range chunks (preferred outside DE440s in `auto`), and
 * optional DE431 long-range chunks (legacy / `de431_long` policy).
 */

import { NodeJHoraError, NodeJHoraErrorCode } from '../../errors.js';
import type { BarycentricSource } from '../apparent.js';
import type { Vec3 } from '../chebyshev.js';
import type { PrecisionProfile } from '../deltat.js';
import type { SpkFile } from '../spk.js';
import { type De431ChunkFile, De431LongEphemerisProvider } from './de431-chunk.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START, De440sEphemerisProvider } from './de440s.js';
import { De441LongEphemerisProvider } from './de441-chunk.js';
import { etToJdTdb } from './time.js';
import type {
    EphemerisBodyId,
    EphemerisFrame,
    EphemerisPolicy,
    EphemerisProvenance,
    EphemerisProvider,
    EphemerisState,
} from './types.js';
import { DEFAULT_EPHEMERIS_POLICY } from './types.js';

export interface CompositeEphemerisOptions {
    policy?: EphemerisPolicy;
    /** Legacy DE431 NJCE chunks (`de431_long` policy and `auto` fallback). */
    longRangeDe431?: {
        getChunk: (century: number, groupId: number) => De431ChunkFile | undefined;
    };
    /** JPL DE441 NJCE chunks (preferred outside DE440s when `auto`). */
    longRangeDe441?: {
        getChunk: (century: number, groupId: number) => De431ChunkFile | undefined;
    };
}

export class CompositeEphemerisProvider implements EphemerisProvider, BarycentricSource {
    readonly id = 'composite';
    readonly coverage;
    readonly bodies;

    private readonly de440s: De440sEphemerisProvider;
    private readonly de431?: De431LongEphemerisProvider;
    private readonly de441?: De441LongEphemerisProvider;
    private policy: EphemerisPolicy;

    constructor(spk: SpkFile, options: CompositeEphemerisOptions = {}) {
        this.de440s = new De440sEphemerisProvider(spk);
        this.policy = options.policy ?? DEFAULT_EPHEMERIS_POLICY;
        if (options.longRangeDe431) {
            this.de431 = new De431LongEphemerisProvider(options.longRangeDe431.getChunk);
        }
        if (options.longRangeDe441) {
            this.de441 = new De441LongEphemerisProvider(options.longRangeDe441.getChunk);
        }
        this.bodies = this.de440s.bodies;
        const longStarts = [
            this.de440s.coverage.jdTdbStart,
            this.de441?.coverage.jdTdbStart,
            this.de431?.coverage.jdTdbStart,
        ].filter((x): x is number => x !== undefined);
        const longEnds = [
            this.de440s.coverage.jdTdbEnd,
            this.de441?.coverage.jdTdbEnd,
            this.de431?.coverage.jdTdbEnd,
        ].filter((x): x is number => x !== undefined);
        const hasLong = this.de441 ?? this.de431;
        this.coverage = hasLong
            ? {
                  jdTdbStart: Math.min(...longStarts),
                  jdTdbEnd: Math.max(...longEnds),
                  kernelId: 'composite',
                  version: this.de441 ? 'de440s+de441-long' : 'de440s+de431-long',
              }
            : this.de440s.coverage;
    }

    setPolicy(policy: EphemerisPolicy): void {
        this.policy = policy;
    }

    getPolicy(): EphemerisPolicy {
        return this.policy;
    }

    provenance(jdTdb: number): EphemerisProvenance {
        const active = this.pick(jdTdb);
        return {
            policy: this.policy,
            kernelId: active.id,
            kernelVersion: active.coverage.version,
        };
    }

    private pick(jdTdb: number): EphemerisProvider {
        if (this.policy === 'de440s') return this.de440s;
        if (this.policy === 'de431_long') {
            if (!this.de431) {
                throw new NodeJHoraError(
                    NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                    'DE431 long-range chunks are not loaded',
                );
            }
            return this.de431;
        }
        if (this.policy === 'de441_long') {
            if (!this.de441) {
                throw new NodeJHoraError(
                    NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                    'DE441 long-range chunks are not loaded',
                );
            }
            return this.de441;
        }
        // auto: prefer DE440s inside its span for byte-identical overlap
        if (jdTdb >= DE440S_JD_TDB_START && jdTdb <= DE440S_JD_TDB_END) {
            return this.de440s;
        }
        if (this.de441) return this.de441;
        if (this.de431) return this.de431;
        throw new NodeJHoraError(
            NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
            `Ephemeris date JD(TDB) ${jdTdb} is outside DE440s coverage, 1849-12-26 to 2150-01-22 ` +
                `(JD ${DE440S_JD_TDB_START}–${DE440S_JD_TDB_END}). ` +
                'Install DE441 or DE431 NJCE chunks and attach them with setDe441ChunkStore() / setChunkStore().',
            { jdTdb },
        );
    }

    state(jdTdb: number, body: EphemerisBodyId, frame: EphemerisFrame): EphemerisState {
        return this.pick(jdTdb).state(jdTdb, body, frame);
    }

    /** ET seconds interface used by apparent-place and legacy engine paths. */
    getBarycentric(naifBody: number, et: number): Vec3 {
        return this.state(etToJdTdb(et), naifBody, 'barycentric');
    }

    /**
     * Barycentric state for the osculating lunar node. Outside DE440s coverage,
     * `'modern'` uses the active long-range kernel when chunks are loaded.
     */
    getBarycentricForLunarNode(naifBody: number, et: number, profile: PrecisionProfile): Vec3 {
        const jdTdb = etToJdTdb(et);
        if (profile === 'modern' && (jdTdb < DE440S_JD_TDB_START || jdTdb > DE440S_JD_TDB_END)) {
            const long = this.de441 ?? this.de431;
            if (long) return long.state(jdTdb, naifBody, 'barycentric');
        }
        return this.getBarycentric(naifBody, et);
    }
}
