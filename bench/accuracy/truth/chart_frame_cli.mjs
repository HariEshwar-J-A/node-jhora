#!/usr/bin/env node
/**
 * Bench-only: Vondrák 2011 chart ecliptic transforms (same module as production).
 */
import { readFileSync } from 'node:fs';
import {
    chartEclipticFromIcrfDirection,
    icrfToMeanEclipticOfDate,
    iau2000FrameBias,
    julianCenturies,
} from '../../../packages/core/dist/engine/precession.js';
import { deltaT } from '../../../packages/core/dist/engine/deltat.js';

const input = JSON.parse(readFileSync(0, 'utf8'));
const { jdUt, deltaTOverrideSeconds, vectors } = input;
const dtSec = deltaTOverrideSeconds ?? deltaT(jdUt);
const jdTT = jdUt + dtSec / 86400;
const T = julianCenturies(jdTT);

const out = vectors.map((entry) => {
    const v = entry.icrf;
    if (entry.mode === 'biased_ecliptic_km') {
        const pos = icrfToMeanEclipticOfDate(iau2000FrameBias(v), T, jdTT);
        return { xyz: pos };
    }
    const ecl = chartEclipticFromIcrfDirection(v, T, jdTT);
    return { lon: ecl.lon, lat: ecl.lat };
});

process.stdout.write(JSON.stringify({ jdTT, T, deltaTSeconds: dtSec, results: out }));
