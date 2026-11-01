// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * JHora-profile yearly ΔT table (1620–2019), 1 January values.
 *
 * @provenance Same observed record as OBSERVED_DELTAT_JAN1 (AA K8–K9 / USNO
 * deltat.data through 2019). Swiss Ephemeris 2.02.01 used USNO predictions for
 * 2016–2019; this engine uses Bulletin-B observations — see deltat-jhora.test.ts
 * for oracle residuals.
 */

import { OBSERVED_DELTAT_JAN1 } from './deltat-observed.js';

export const JHORA_DELTAT_JAN1: readonly number[] = OBSERVED_DELTAT_JAN1;

export const JHORA_DELTAT_LAST_YEAR = 2019;
