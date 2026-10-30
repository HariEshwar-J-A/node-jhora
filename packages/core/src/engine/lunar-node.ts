/**
 * True (osculating) lunar node on the mean ecliptic and equinox of date.
 *
 * Swiss Ephemeris documents the true node as the ascending intersection of the
 * Moon's instantaneous orbital plane with the ecliptic (traditional ecliptic,
 * not the Sun's orbital plane). The node is derived from geocentric position
 * and velocity at epoch.
 *
 * Frame (precession stream, Vondrák et al. 2011 A&A 534, A22): mean equator of
 * date via the equator pole series, then tilt by ε_A (eq. 10) — not the
 * independent ecliptic-pole series.
 *
 * @provenance Vallado, *Fundamentals of Astrodynamics and Applications*, §2.4
 * (ascending-node longitude from h = r × v); Vondrák–Capitaine–Wallace (2011).
 */

import type { BarycentricSource } from './apparent.js';
import { observerState } from './apparent.js';
import { mod360 } from './coordinates.js';
import { deltaT, jdUTtoET } from './deltat.js';
import { geocentricRelativeState, meanEclipticRelativeKinematics } from './kinematics.js';
import { nutation } from './nutation.js';
import {
    icrfToMeanEclipticOfDate,
    julianCenturies,
    matVec,
    meanObliquity,
    precessionMatrix,
    rotateX,
    type Vec,
} from './precession.js';
import { NAIF } from './spk.js';

/** How position/velocity are mapped into the ecliptic before forming h = r × v. */
export type TrueNodeEclipticFrame =
    /** Mean equator of date + ε_A (sidereal planet longitudes use this). */
    | 'mean_ecliptic_of_date'
    /** Mean equator of date + (ε_A + Δε); nutation in obliquity only. */
    | 'true_obliquity_ecliptic'
    /** J2000 mean ecliptic (precession matrix at T = 0). */
    | 'j2000_mean_ecliptic';

/** Velocity source for the osculating plane. */
export type TrueNodeVelocityMode = 'spk_analytic' | 'fd_1s' | 'fd_60s';

export interface TrueNodeOptions {
    eclipticFrame?: TrueNodeEclipticFrame;
    velocityMode?: TrueNodeVelocityMode;
    /** When true (default), include ∂(ecliptic frame)/∂t on the velocity (mean ecliptic of date only). */
    precessionSpin?: boolean;
}

function ascendingNodeLongitudeFromEclipticState(pos: Vec, vel: Vec): number {
    const hx = pos[1] * vel[2] - pos[2] * vel[1];
    const hy = pos[2] * vel[0] - pos[0] * vel[2];
    return mod360((Math.atan2(hx, -hy) * 180) / Math.PI);
}

function icrfToEclipticFrame(v: Vec, T: number, jdTT: number, frame: TrueNodeEclipticFrame): Vec {
    const Tuse = frame === 'j2000_mean_ecliptic' ? 0 : T;
    const jdUse = frame === 'j2000_mean_ecliptic' ? 2451545.0 : jdTT;
    const onEquator = matVec(precessionMatrix(Tuse, jdUse), v);
    const eps = meanObliquity(Tuse, jdUse);
    if (frame === 'true_obliquity_ecliptic') {
        return rotateX(onEquator, eps + nutation(T).deps);
    }
    return rotateX(onEquator, eps);
}

function eclipticStateFromIcrf(
    relKm: Vec,
    relVelKmS: Vec,
    jdUT: number,
    frame: TrueNodeEclipticFrame,
    precessionSpin: boolean,
): { pos: Vec; vel: Vec } {
    if (frame === 'mean_ecliptic_of_date' && precessionSpin) {
        return meanEclipticRelativeKinematics(relKm, relVelKmS, jdUT);
    }

    const jdTT = jdUT + deltaT(jdUT) / 86400;
    const T = julianCenturies(jdTT);
    const secPerDay = 86400 + (deltaT(jdUT + 1e-4) - deltaT(jdUT - 1e-4)) / 2e-4;
    const velKmDay: Vec = [
        relVelKmS[0] * secPerDay,
        relVelKmS[1] * secPerDay,
        relVelKmS[2] * secPerDay,
    ];
    const pos =
        frame === 'mean_ecliptic_of_date'
            ? icrfToMeanEclipticOfDate(relKm, T, jdTT)
            : icrfToEclipticFrame(relKm, T, jdTT, frame);
    const vel =
        frame === 'mean_ecliptic_of_date'
            ? icrfToMeanEclipticOfDate(velKmDay, T, jdTT)
            : icrfToEclipticFrame(velKmDay, T, jdTT, frame);
    return { pos, vel };
}

function geocentricMoonState(
    jdUT: number,
    source: BarycentricSource,
    velocityMode: TrueNodeVelocityMode,
): { rel: Vec; vel: Vec } {
    const et = jdUTtoET(jdUT);
    const observer = observerState(source, NAIF.Earth, et);
    if (velocityMode === 'spk_analytic') {
        return geocentricRelativeState(source, NAIF.Moon, et, observer);
    }
    const hSec = velocityMode === 'fd_1s' ? 1 : 60;
    const { rel } = geocentricRelativeState(source, NAIF.Moon, et, observer);
    const o1 = observerState(source, NAIF.Earth, et + hSec);
    const o2 = observerState(source, NAIF.Earth, et - hSec);
    const r1 = geocentricRelativeState(source, NAIF.Moon, et + hSec, o1).rel;
    const r2 = geocentricRelativeState(source, NAIF.Moon, et - hSec, o2).rel;
    const vel: Vec = [
        (r1[0] - r2[0]) / (2 * hSec),
        (r1[1] - r2[1]) / (2 * hSec),
        (r1[2] - r2[2]) / (2 * hSec),
    ];
    return { rel, vel };
}

/**
 * Tropical ascending-node longitude for the osculating lunar orbit.
 */
export function trueAscendingNodeLongitude(
    jdUT: number,
    source: BarycentricSource,
    options: TrueNodeOptions = {},
): number {
    const {
        eclipticFrame = 'mean_ecliptic_of_date',
        velocityMode = 'spk_analytic',
        precessionSpin = true,
    } = options;

    const { rel, vel } = geocentricMoonState(jdUT, source, velocityMode);
    const { pos, vel: vEcl } = eclipticStateFromIcrf(rel, vel, jdUT, eclipticFrame, precessionSpin);
    return ascendingNodeLongitudeFromEclipticState(pos, vEcl);
}
