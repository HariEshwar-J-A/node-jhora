#!/usr/bin/env node
/**
 * Calendar-convention probe: EphemerisEngine.julday vs julianDayUt (SE/JHora).
 * Usage: node tools/probe_calendar.mjs [repoRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.argv[2] || process.cwd();
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { DateTime } = await imp('packages/core/node_modules/luxon/src/luxon.js');
const { EphemerisEngine } = await imp('packages/core/dist/engine/ephemeris.js');
const h = await imp('packages/core/dist/time/historical.js');

const e = new EphemerisEngine();
await e.initialize({
    kernel: new Uint8Array(fs.readFileSync(path.join(ROOT, 'packages/ephe/de440s.bsp'))),
});

const rows = [];
for (const [y, m, d] of [
    [2000, 1, 1],
    [1582, 10, 15],
    [1582, 10, 14],
    [1582, 10, 4],
    [1500, 3, 1],
    [1500, 2, 29],
    [1000, 6, 1],
    [0, 2, 29],
    [-1, 6, 1],
    [-4712, 1, 1],
    [-10000, 1, 1],
]) {
    const parts = { astronomicalYear: y, month: m, day: d, hour: 0, minute: 0, second: 0 };
    let seJd = null;
    let seNote = null;
    try {
        seJd = h.julianDayUt(parts);
    } catch (err) {
        seNote = err.name ?? String(err);
    }

    const dt = DateTime.fromObject({ year: y, month: m, day: d }, { zone: 'utc' });
    let engineJd = null;
    let engineNote = null;
    if (dt.isValid) {
        try {
            engineJd = e.julday(dt);
        } catch (err) {
            engineNote = err.name ?? String(err);
        }
    } else {
        try {
            engineJd = h.julianDayUt(parts);
        } catch (err) {
            engineNote = err.name ?? String(err);
        }
    }

    const deltaDays =
        engineJd != null && seJd != null
            ? engineJd - seJd
            : engineJd != null && seJd == null
              ? 'n/a'
              : null;

    rows.push({
        y,
        m,
        d,
        luxonValid: dt.isValid,
        seJd,
        seNote,
        engineJd,
        engineNote,
        deltaDays,
    });
}

console.log(JSON.stringify(rows, null, 2));
