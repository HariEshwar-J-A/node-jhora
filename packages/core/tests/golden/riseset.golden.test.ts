/**
 * Rise/set/transit goldens: JHora SE 2.02 DLL (jhora) and pyswisseph DE431 (modern).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DateTime } from 'luxon';
import { expectGolden, parseGoldenCorpus } from '@node-jhora/testkit';

import {
    EphemerisEngine,
    findRiseSetEvent,
    jdUtFromDateTime,
    riseSetDefinitionFromSettings,
    type RiseSetBodyId,
    type RiseSetEvent,
} from '../../src/index.js';
import { CalculationSettingsSchema, getPreset } from '../../src/settings/index.js';
import type { PrecisionProfileId } from '../../src/settings/schema.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

const FIXTURES: { profile: PrecisionProfileId; file: string }[] = [
    { profile: 'jhora', file: 'riseset.jhora-dll.json' },
    { profile: 'modern', file: 'riseset.pyswisseph-se1.json' },
    { profile: 'jhora', file: 'riseset.highlat-jhora.json' },
    { profile: 'modern', file: 'riseset.highlat-modern.json' },
];

const BODY_IDS: Record<string, RiseSetBodyId> = {
    Sun: 0,
    Moon: 1,
    Mercury: 2,
    Venus: 3,
    Mars: 4,
    Jupiter: 5,
    Saturn: 6,
};

const EVENT_MAP: Record<string, RiseSetEvent> = {
    rise: 'rise',
    set: 'set',
    upperTransit: 'upper_transit',
    lowerTransit: 'lower_transit',
};

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 60_000);

function settingsFor(golden: { settings: Record<string, unknown> }, profile: PrecisionProfileId) {
    const base = getPreset('jhora-default@8.0');
    const s = golden.settings;
    return CalculationSettingsSchema.parse({
        ...base,
        precisionProfile: profile,
        ...(profile === 'modern' ? { deltaTForecast: 'oracle-compat' as const } : {}),
        positionMode: (s.positionMode as 'geometric' | 'apparent') ?? base.positionMode,
        ...(typeof s.deltaTOverrideSeconds === 'number'
            ? { deltaTOverrideSeconds: s.deltaTOverrideSeconds }
            : {}),
        sunrise: {
            ...base.sunrise,
            limb: (s.limb as 'disc_centre' | 'upper_limb') ?? base.sunrise.limb,
            refraction:
                s.refraction !== undefined ? Boolean(s.refraction) : base.sunrise.refraction,
        },
    });
}

function actualFor(
    golden: ReturnType<typeof parseGoldenCorpus>[number],
    profile: PrecisionProfileId,
): Record<string, string | number> {
    const jdStart = jdUtFromDateTime(DateTime.fromISO(golden.input.instant, { zone: 'utc' }));
    const location = {
        latitude: golden.input.lat,
        longitude: golden.input.lon,
        altitude: golden.input.alt,
    };
    const def = riseSetDefinitionFromSettings(settingsFor(golden, profile), {
        limb: golden.settings.limb as 'disc_centre' | 'upper_limb',
        refraction: Boolean(golden.settings.refraction),
        pressureHPa: Number(golden.settings.pressureHPa ?? 1013.25),
        temperatureC: Number(golden.settings.temperatureC ?? 15),
        horizonAltitudeDeg: Number(golden.settings.horizonAltitudeDeg ?? 0),
        positionMode: (golden.settings.positionMode as 'geometric' | 'apparent') ?? 'geometric',
        precisionProfile: profile,
        ...(profile === 'modern' ? { deltaTForecast: 'oracle-compat' as const } : {}),
    });

    const actual: Record<string, string | number> = {};
    const bodyName = Object.keys(BODY_IDS).find((name) =>
        Object.keys(golden.expected).some((p) => p.startsWith(`riseset.${name}.`)),
    );
    if (!bodyName) return actual;
    const bodyId = BODY_IDS[bodyName]!;
    const found = new Map<RiseSetEvent, ReturnType<typeof findRiseSetEvent>>();
    const outcome = (event: RiseSetEvent) => {
        let hit = found.get(event);
        if (!hit) {
            hit = findRiseSetEvent(engine, bodyId, event, jdStart, location, def);
            found.set(event, hit);
        }
        return hit;
    };

    for (const path of Object.keys(golden.expected)) {
        const m = path.match(/^riseset\.(\w+)\.(\w+)\.(kind|jdUt)$/);
        if (!m) continue;
        const event = EVENT_MAP[m[2]!];
        if (!event) continue;
        const out = outcome(event);
        if (path.endsWith('.kind')) actual[path] = out.kind === 'time' ? 'time' : 'none';
        else if (out.kind === 'time') actual[path] = out.jdUt;
    }

    return actual;
}

for (const { profile, file } of FIXTURES) {
    const CASES = parseGoldenCorpus(readFileSync(join(fixtureDir, file), 'utf8'));
    describe(`Rise/set golden (${profile}: ${file})`, () => {
        for (const golden of CASES) {
            test(golden.id, () => {
                expectGolden(golden, actualFor(golden, profile));
            });
        }
    });
}
