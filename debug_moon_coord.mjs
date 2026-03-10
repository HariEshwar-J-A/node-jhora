/**
 * debug_moon_coord.mjs — Trace Moon calculation through the full stack
 */

import { EphemerisEngine } from './packages/core/dist/engine/ephemeris.js';
import { DateTime } from 'luxon';

const engine = EphemerisEngine.getInstance();
await engine.initialize();
engine.setAyanamsa(1); // Lahiri

const date = DateTime.fromObject({
    year: 2000, month: 1,  day: 1,
    hour: 12, minute: 0,   second: 0,
}, { zone: 'utc' });

const jd = engine.julday(date);
console.log(`Julian Day: ${jd}`);

const ayan = engine.getAyanamsa(jd);
console.log(`Ayanamsa (Lahiri) at JD ${jd}: ${ayan.toFixed(6)}°`);

const planets = engine.getPlanets(date, undefined, {
    ayanamsaOrder: 1,
    nodeType: 'mean',
});

const moon = planets.find(p => p.name === 'Moon');
const sun = planets.find(p => p.name === 'Sun');

console.log(`\nSun:  ${sun.longitude.toFixed(6)}° (expected 256.521486°, diff: ${(sun.longitude - 256.521486).toFixed(6)}°)`);
console.log(`Moon: ${moon.longitude.toFixed(6)}° (expected 199.470528°, diff: ${(moon.longitude - 199.470528).toFixed(6)}°)`);

console.log(`\nTropical Moon would be: ${(moon.longitude + ayan).toFixed(6)}°`);
