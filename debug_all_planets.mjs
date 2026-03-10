/**
 * debug_all_planets.mjs — Compare all planets against reference data
 */

import { EphemerisEngine } from './packages/core/dist/engine/ephemeris.js';
import { DateTime } from 'luxon';

const CHART_A = {
    label: 'A_J2000',
    year: 2000, month: 1, day: 1,
    hour: 12, minute: 0, second: 0,
    planets: [
        { name: 'Sun',     longitude: 256.521486,  speed:  1.019394 },
        { name: 'Moon',    longitude: 199.470528,  speed: 12.021264 },
        { name: 'Mercury', longitude: 248.048782,  speed:  1.556218 },
        { name: 'Venus',   longitude: 217.720510,  speed:  1.209003 },
        { name: 'Mars',    longitude: 304.118365,  speed:  0.775634 },
        { name: 'Jupiter', longitude:   1.400954,  speed:  0.040721 },
        { name: 'Saturn',  longitude:  16.541446,  speed: -0.019985 },
        { name: 'Rahu',    longitude: 101.187424,  speed: -0.054779 },
        { name: 'Ketu',    longitude: 281.187424,  speed: -0.054779 },
    ],
};

const engine = EphemerisEngine.getInstance();
await engine.initialize();
engine.setAyanamsa(1); // Lahiri

const date = DateTime.fromObject({
    year: CHART_A.year, month: CHART_A.month,  day: CHART_A.day,
    hour: CHART_A.hour, minute: CHART_A.minute, second: CHART_A.second,
}, { zone: 'utc' });

const planets = engine.getPlanets(date, undefined, {
    ayanamsaOrder: 1,
    nodeType: 'mean',
});

console.log('Planet Comparison (Sidereal Lahiri):');
console.log('═'.repeat(80));
for (const ref of CHART_A.planets) {
    const p = planets.find(pl => pl.name === ref.name);
    if (!p) continue;
    const lonDiff = p.longitude - ref.longitude;
    const speedDiff = p.speed - ref.speed;
    const lonMark = Math.abs(lonDiff) < 0.001 ? '✓' : '✗';
    const speedMark = Math.abs(speedDiff) < 0.001 ? '✓' : '✗';

    console.log(`${lonMark} ${ref.name.padEnd(10)} Lon: ${p.longitude.toFixed(6).padStart(10)} (expect ${ref.longitude.toFixed(6)}, diff ${lonDiff.toFixed(6)})`);
    console.log(`${speedMark} ${' '.repeat(10)} Spd: ${p.speed.toFixed(6).padStart(10)} (expect ${ref.speed.toFixed(6)}, diff ${speedDiff.toFixed(6)})`);
}
