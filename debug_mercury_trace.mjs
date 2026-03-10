/**
 * debug_mercury_trace.mjs — Full trace of Mercury computation
 * Expected sidereal: 248.048782°
 */

import { Se1File, SE_BODY } from './packages/core/dist/engine/se1.js';

const SEPL = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1';
const TJD = 2451545.0;
const AYANAMSA = 23.857103;

const sepl = new Se1File(SEPL);

console.log('Mercury Trace (J2000 epoch, JD 2451545)');
console.log('═'.repeat(100));

// Step 1: Get raw Mercury (rotated to J2000 ecliptic)
const mer_rect = sepl.getRawPosition(SE_BODY.Mercury, TJD);
console.log(`\nStep 1: Raw Mercury position (from SE1, post-rotation):`);
console.log(`  [x, y, z] = [${mer_rect[0].toFixed(8)}, ${mer_rect[1].toFixed(8)}, ${mer_rect[2].toFixed(8)}] AU`);

// Step 2: Get raw Earth/EMB
const earth_rect = sepl.getRawPosition(SE_BODY.Sun, TJD);  // Body 0 = EMB
console.log(`\nStep 2: Raw Earth/EMB position (from SE1, post-rotation):`);
console.log(`  [x, y, z] = [${earth_rect[0].toFixed(8)}, ${earth_rect[1].toFixed(8)}, ${earth_rect[2].toFixed(8)}] AU`);

// Step 3: Compute geocentric Mercury
const mer_geo_x = mer_rect[0] - earth_rect[0];
const mer_geo_y = mer_rect[1] - earth_rect[1];
const mer_geo_z = mer_rect[2] - earth_rect[2];
console.log(`\nStep 3: Geocentric Mercury (helio - earth):`);
console.log(`  [x, y, z] = [${mer_geo_x.toFixed(8)}, ${mer_geo_y.toFixed(8)}, ${mer_geo_z.toFixed(8)}] AU`);

// Step 4: Convert to lon/lat/dist
const dist = Math.sqrt(mer_geo_x*mer_geo_x + mer_geo_y*mer_geo_y + mer_geo_z*mer_geo_z);
const lon_trop = ((Math.atan2(mer_geo_y, mer_geo_x) * 180 / Math.PI) + 360) % 360;
const lat = Math.asin(mer_geo_z / dist) * 180 / Math.PI;
console.log(`\nStep 4: Tropical coordinates:`);
console.log(`  Longitude: ${lon_trop.toFixed(6)}°`);
console.log(`  Latitude: ${lat.toFixed(6)}°`);
console.log(`  Distance: ${dist.toFixed(8)} AU`);

// Step 5: Apply ayanamsa to get sidereal
const lon_sid = ((lon_trop - AYANAMSA) + 360) % 360;
console.log(`\nStep 5: Sidereal (tropical - ayanamsa):`);
console.log(`  Ayanamsa: ${AYANAMSA.toFixed(6)}°`);
console.log(`  Sidereal: ${lon_sid.toFixed(6)}°`);

// Expected
const expected_sid = 248.048782;
const diff = lon_sid - expected_sid;
console.log(`\nComparison:`);
console.log(`  Expected sidereal: ${expected_sid.toFixed(6)}°`);
console.log(`  Computed sidereal: ${lon_sid.toFixed(6)}°`);
console.log(`  Difference: ${diff.toFixed(6)}°`);
console.log(`  Match: ${Math.abs(diff) < 0.01 ? '✓ YES' : '✗ NO'}`);
