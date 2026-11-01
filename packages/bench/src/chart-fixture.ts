import {
    calculateHouseCusps,
    describeCalculation,
    EphemerisEngine,
    type PrecisionOptions,
} from '@node-jhora/core';
import { CHART_SECTION_IDS, ChartSession } from '@node-jhora/engine';
import { DateTime } from 'luxon';

import {
    type BenchProfileId,
    precisionProfileForBench,
    settingsForBenchProfile,
} from './profiles.js';

/** Canonical warm-chart fixture (fictional Varanasi reference from jhora12). */
export const BENCH_CHART = {
    instant: DateTime.fromISO('2020-12-21T18:20:00', { zone: 'Asia/Kolkata' }),
    location: { latitude: 25.3176, longitude: 82.9739 },
    settings: 'node-jhora-default' as const,
    dasha: { depth: 3 },
};

/** TT Julian day for deep-era mean node (proleptic year -10000, outside faom03 window). */
export const DEEP_ERA_TRUTH_MEAN_NODE_JD_TT = -1_931_455.0;

export const DISTINCT_JD_PLANET_COUNT = 40;
export const DISTINCT_JD_PLANET_STEP_DAYS = 3;

/** UT Julian day for the bench instant (2020-12-21 18:20 IST = 12:50 UT). */
export const BENCH_JD_UT = 2_459_205.034_722_222;

export function benchJulianDayUt(): number {
    return BENCH_JD_UT;
}

export function precisionOpts(profile: BenchProfileId): PrecisionOptions {
    const resolved = describeCalculation(settingsForBenchProfile(profile));
    const o: PrecisionOptions = {
        calendar: resolved.config.calendar,
        precisionProfile: precisionProfileForBench(profile),
    };
    if (resolved.config.deltaTOverrideSeconds !== undefined) {
        o.deltaTOverrideSeconds = resolved.config.deltaTOverrideSeconds;
    }
    if (resolved.config.deltaTForecast === 'oracle-compat') {
        o.deltaTForecast = resolved.config.deltaTForecast;
    }
    return o;
}

export function ephemerisCallOpts(
    profile: BenchProfileId,
): Parameters<EphemerisEngine['getPlanets']>[2] {
    const resolved = describeCalculation(settingsForBenchProfile(profile));
    return {
        ayanamsaOrder: resolved.config.ayanamsaMode,
        nodeType: resolved.config.nodeType,
        positionMode: resolved.config.positionMode,
        topocentric: resolved.config.topocentric,
        ayanamsaOffset: resolved.config.ayanamsaOffset,
        ...precisionOpts(profile),
    };
}

/**
 * Full chart workload: D1–D60 vargas, Vimshottari dasha to level 3, shadbala,
 * yogas, ashtakavarga, plus core sections.
 */
export function runFullChartWarm(engine: EphemerisEngine, profile: BenchProfileId = 'jhora'): void {
    const session = new ChartSession({
        instant: BENCH_CHART.instant,
        location: BENCH_CHART.location,
        settings: settingsForBenchProfile(profile),
        dasha: BENCH_CHART.dasha,
        ephemeris: engine,
    });
    session.collect([...CHART_SECTION_IDS]);
}

export function runPlanets(engine: EphemerisEngine, profile: BenchProfileId): void {
    engine.getPlanets(BENCH_CHART.instant, BENCH_CHART.location, ephemerisCallOpts(profile));
}

export function runHouses(engine: EphemerisEngine, profile: BenchProfileId): void {
    const resolved = describeCalculation(settingsForBenchProfile(profile));
    calculateHouseCusps(
        BENCH_CHART.instant,
        BENCH_CHART.location.latitude,
        BENCH_CHART.location.longitude,
        resolved.config.houseSystem,
        engine,
        resolved.config.ayanamsaMode,
        resolved.config.ayanamsaOffset,
        precisionOpts(profile),
    );
}

export function runAyanamsa(engine: EphemerisEngine, profile: BenchProfileId): void {
    const jd = benchJulianDayUt();
    const resolved = describeCalculation(settingsForBenchProfile(profile));
    const p = precisionProfileForBench(profile);
    const frame = p === 'modern' || p === 'truth' ? ('apparent' as const) : ('geometric' as const);
    engine.getAyanamsa(
        jd,
        resolved.config.ayanamsaMode,
        resolved.config.ayanamsaOffset,
        frame,
        precisionOpts(profile),
    );
}

export function distinctPlanetInstants(): DateTime[] {
    const out: DateTime[] = [];
    for (let i = 0; i < DISTINCT_JD_PLANET_COUNT; i++) {
        out.push(BENCH_CHART.instant.plus({ days: i * DISTINCT_JD_PLANET_STEP_DAYS }));
    }
    return out;
}

/** One sweep of distinct Julian days (truth profile). */
export function runPlanetsDistinctJdSweep(engine: EphemerisEngine): void {
    const opts = ephemerisCallOpts('truth');
    for (const instant of distinctPlanetInstants()) {
        engine.getPlanets(instant, BENCH_CHART.location, opts);
    }
}
