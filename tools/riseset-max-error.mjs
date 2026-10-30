#!/usr/bin/env node
/**
 * Report max |Δt| (seconds) between engine rise/set and oracle goldens.
 * Requires `pnpm build` first.
 *
 * Usage: node tools/riseset-max-error.mjs
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../packages/core/package.json'));
const { DateTime } = require('luxon');
const { parseGoldenCorpus } = await import(join(__dirname, '../packages/testkit/dist/index.js'));
const {
    CalculationSettingsSchema,
    EphemerisEngine,
    findRiseSetEvent,
    getPreset,
    jdUtFromDateTime,
    riseSetDefinitionFromSettings,
} = await import(join(__dirname, '../packages/core/dist/index.js'));

const FIXTURES = [
    { profile: 'jhora', file: 'riseset.jhora-dll.json' },
    { profile: 'modern', file: 'riseset.pyswisseph-se1.json' },
    { profile: 'jhora', file: 'riseset.highlat-jhora.json' },
    { profile: 'modern', file: 'riseset.highlat-modern.json' },
];

const BODY = { Sun: 0, Moon: 1, Mercury: 2, Venus: 3, Mars: 4, Jupiter: 5, Saturn: 6 };
const EV = {
    rise: 'rise',
    set: 'set',
    upperTransit: 'upper_transit',
    lowerTransit: 'lower_transit',
};

const { registerNodeBspLoaderFromCore } = await import(
    join(__dirname, '../packages/core/node/register.mjs')
);
await registerNodeBspLoaderFromCore();

const engine = EphemerisEngine.getInstance();
await engine.initialize();

function settingsFor(golden, profile) {
    const base = getPreset('jhora-default@8.0');
    const s = golden.settings;
    return CalculationSettingsSchema.parse({
        ...base,
        precisionProfile: profile,
        positionMode: s.positionMode ?? base.positionMode,
        ...(typeof s.deltaTOverrideSeconds === 'number'
            ? { deltaTOverrideSeconds: s.deltaTOverrideSeconds }
            : {}),
        sunrise: {
            ...base.sunrise,
            limb: s.limb ?? base.sunrise.limb,
            refraction:
                s.refraction !== undefined ? Boolean(s.refraction) : base.sunrise.refraction,
        },
    });
}

function latitudeBand(lat) {
    const a = Math.abs(lat);
    if (a < 55) return '<55';
    if (a <= 60) return '55-60';
    if (a <= 65) return '60-65';
    if (a <= 75) return '65-75';
    return '75-90';
}

for (const { profile, file } of FIXTURES) {
    const fixture = join(__dirname, '../packages/core/tests/fixtures', file);
    const CASES = parseGoldenCorpus(readFileSync(fixture, 'utf8'));
    const stats = {};
    const bands = {};

    for (const g of CASES) {
        const jdStart = jdUtFromDateTime(DateTime.fromISO(g.input.instant, { zone: 'utc' }));
        const loc = { latitude: g.input.lat, longitude: g.input.lon, altitude: g.input.alt };
        const def = riseSetDefinitionFromSettings(settingsFor(g, profile), {
            precisionProfile: profile,
        });
        const body = Object.keys(BODY).find((n) =>
            Object.keys(g.expected).some((p) => p.startsWith(`riseset.${n}.`)),
        );
        const bid = BODY[body];

        const band = latitudeBand(g.input.lat);
        const cellKey = `${body}|${band}`;
        if (!bands[cellKey]) bands[cellKey] = { errs: [], missing: 0, kindMiss: 0 };

        for (const [path, exp] of Object.entries(g.expected)) {
            const evKey = path.split('.')[2];
            const field = path.split('.')[3];
            if (field === 'kind') {
                const out = findRiseSetEvent(engine, bid, EV[evKey], jdStart, loc, def);
                const got = out.kind === 'time' ? 'time' : 'none';
                if (got !== exp.value) bands[cellKey].kindMiss++;
                continue;
            }
            if (field !== 'jdUt') continue;
            const out = findRiseSetEvent(engine, bid, EV[evKey], jdStart, loc, def);
            if (!stats[evKey]) stats[evKey] = { errs: [], max: 0, maxPath: '', missing: 0 };
            if (out.kind !== 'time') {
                stats[evKey].missing++;
                bands[cellKey].missing++;
                console.log(`  no event (${out.reason}) at ${g.id} ${path}`);
                continue;
            }
            const d = Math.abs(out.jdUt - exp.value) * 86400;
            if (d > 1) console.log(`  ${d.toFixed(3)}s ${g.id} ${path}`);
            stats[evKey].errs.push(d);
            bands[cellKey].errs.push(d);
            if (d > stats[evKey].max) {
                stats[evKey].max = d;
                stats[evKey].maxPath = `${g.id} ${path}`;
            }
        }
    }

    console.log(`\n### precisionProfile: ${profile} (${file})\n`);
    console.log('| Event | max (s) | mean (s) | ≤1s | ≤2s |');
    console.log('|-------|--------:|---------:|----:|----:|');
    for (const evKey of ['rise', 'set', 'upperTransit', 'lowerTransit']) {
        const s = stats[evKey];
        if (!s) continue;
        const n = s.errs.length;
        const mean = s.errs.reduce((a, b) => a + b, 0) / n;
        const le1 = s.errs.filter((e) => e <= 1).length;
        const le2 = s.errs.filter((e) => e <= 2).length;
        console.log(
            `| ${evKey} | ${s.max.toFixed(2)} | ${mean.toFixed(2)} | ${le1}/${n} | ${le2}/${n} |`,
        );
        if (s.maxPath) console.log(`  max at ${s.maxPath}`);
        if (s.missing) console.log(`  ${s.missing} golden events returned no time`);
    }

    console.log('\n| Body | Latitude band | n | max (s) | mean (s) | kind mismatches | missing |');
    console.log('|------|---------------|--:|--------:|---------:|----------------:|--------:|');
    const order = ['<55', '55-60', '60-65', '65-75', '75-90'];
    const bodies = Object.keys(BODY);
    for (const body of bodies) {
        for (const band of order) {
            const cell = bands[`${body}|${band}`];
            if (!cell) continue;
            const n = cell.errs.length;
            const max = n ? Math.max(...cell.errs) : 0;
            const mean = n ? cell.errs.reduce((a, b) => a + b, 0) / n : 0;
            console.log(
                `| ${body} | ${band} | ${n} | ${max.toFixed(3)} | ${mean.toFixed(3)} | ${cell.kindMiss} | ${cell.missing} |`,
            );
        }
    }
}
