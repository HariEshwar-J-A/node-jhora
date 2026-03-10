/**
 * debug_compare_pyjhora.mjs — Compare SE1 reader output with PyJHora
 *
 * This script loads the same ephemeris files that PyJHora uses and compares
 * raw rectangular coordinates for each body.
 */

import { Se1File, SE_BODY } from './packages/core/dist/engine/se1.js';

const SEPL = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1';
const SEMO = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/semo_18.se1';

const TJD = 2451545.0;  // J2000 epoch (2000-01-01 12:00 UTC)

console.log(`Loading SE1 files and comparing raw coordinates at JD ${TJD}...`);
console.log('═'.repeat(100));

const sepl = new Se1File(SEPL);
const semo = new Se1File(SEMO);

// Test each body
const bodies = [
    { id: SE_BODY.Sun, name: 'Sun (body 0)' },
    { id: SE_BODY.Moon, name: 'Moon (body 1)' },
    { id: SE_BODY.Mercury, name: 'Mercury (body 2)' },
    { id: SE_BODY.Venus, name: 'Venus (body 3)' },
    { id: SE_BODY.Mars, name: 'Mars (body 4)' },
    { id: SE_BODY.Jupiter, name: 'Jupiter (body 5)' },
    { id: SE_BODY.Saturn, name: 'Saturn (body 6)' },
    { id: SE_BODY.MeanNode, name: 'Mean Node (body 10)' },
];

for (const body of bodies) {
    try {
        let pos;
        if (body.id === SE_BODY.Moon) {
            pos = semo.getRawPosition(body.id, TJD);
        } else {
            pos = sepl.getRawPosition(body.id, TJD);
        }

        const [x, y, z] = pos;
        const dist = Math.sqrt(x*x + y*y + z*z);
        const lon = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
        const lat = Math.asin(z / dist) * 180 / Math.PI;

        console.log(`\n${body.name}:`);
        console.log(`  Rect:  x=${x.toFixed(8)} AU, y=${y.toFixed(8)} AU, z=${z.toFixed(8)} AU`);
        console.log(`  Dist:  ${dist.toFixed(8)} AU`);
        console.log(`  Lon:   ${lon.toFixed(6)}°`);
        console.log(`  Lat:   ${lat.toFixed(6)}°`);
    } catch (e) {
        console.log(`\n${body.name}: NOT AVAILABLE (${e.message})`);
    }
}

console.log('\n' + '═'.repeat(100));
console.log('\nNOTE: These are RAW coordinates from the SE1 files (before geocentric conversion).');
console.log('For planets (except Moon): these are HELIOCENTRIC ecliptic rectangular coordinates.');
console.log('For Moon: these are GEOCENTRIC ecliptic rectangular coordinates.');
console.log('\nTo get geocentric planets: planet_heliocentric - earth_heliocentric');
console.log('To get tropical: apply no ayanamsa');
console.log('To get sidereal: subtract ayanamsa (23.857103° for Lahiri at J2000)');
