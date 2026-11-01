// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Advertised TT (TDB) Julian-day span that NJCE chunks must cover after a full
 * `build:chunks` run. UT limits come from {@link ../validation/bounds.js}; TT
 * adds ΔT, daily-motion differencing, and prefetch margin.
 */

import { julianDayUt } from '../../time/historical.js';
import {
    CHUNK_PREFETCH_MARGIN_DAYS,
    EPHEMERIS_JD_UT_MAX,
    EPHEMERIS_JD_UT_MIN,
    PLANET_SPEED_STEP_DAYS,
} from '../../validation/bounds.js';
import { deltaT } from '../deltat.js';
import { NAIF } from '../spk.js';
/** Margin (days) added at each TT edge when slicing DE431 into NJCE files. */
export const NJCE_TT_EDGE_MARGIN_DAYS = CHUNK_PREFETCH_MARGIN_DAYS + PLANET_SPEED_STEP_DAYS;

const jdUtMin = EPHEMERIS_JD_UT_MIN;
const jdUtMax = EPHEMERIS_JD_UT_MAX;

/** TT Julian day at the low end of advertised coverage (UT min − margin, in TT). */
export const NJCE_TT_JD_MIN_REQUIRED: number =
    jdUtMin + deltaT(jdUtMin) / 86_400 - NJCE_TT_EDGE_MARGIN_DAYS;

/**
 * TT Julian day at the high end: last supported UT instant (10000-12-31) plus ΔT
 * and motion/prefetch margin.
 */
export const NJCE_TT_JD_MAX_REQUIRED: number =
    jdUtMax + deltaT(jdUtMax) / 86_400 + NJCE_TT_EDGE_MARGIN_DAYS;

/** [target, center] NAIF pairs per NJCE body group (must match build-chunks.mjs). */
export const NJCE_GROUP_SEGMENTS: Readonly<
    Record<number, ReadonlyArray<readonly [number, number]>>
> = {
    0: [
        [NAIF.Sun, NAIF.SSB],
        [NAIF.Mercury, NAIF.SSB],
        [NAIF.Venus, NAIF.SSB],
        [NAIF.Mars, NAIF.SSB],
        [NAIF.Jupiter, NAIF.SSB],
        [NAIF.Saturn, NAIF.SSB],
        [NAIF.Uranus, NAIF.SSB],
        [NAIF.Neptune, NAIF.SSB],
        [NAIF.Pluto, NAIF.SSB],
    ],
    1: [
        [NAIF.EMB, NAIF.SSB],
        [NAIF.Moon, NAIF.EMB],
        [NAIF.Earth, NAIF.EMB],
    ],
};
