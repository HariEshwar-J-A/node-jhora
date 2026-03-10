/**
 * debug_geo_formula.mjs — Test both geocentric formulas
 */

import { Se1File, SE_BODY } from './packages/core/dist/engine/se1.js';

const SEPL = 'E:/Code Base/Github/astrology/PyJHora/src/jhora/data/ephe/sepl_18.se1';
const TJD = 2451545.0;
const AYANAMSA = 23.857103;

const sepl = new Se1File(SEPL);

const mer_rect = sepl.getRawPosition(SE_BODY.Mercury, TJD);
const earth_rect = sepl.getRawPosition(SE_BODY.Sun, TJD);

console.log('Testing Geocentric Formulas');
console.log('═'.repeat(100));
console.log(`Mercury helio: [${mer_rect[0].toFixed(8)}, ${mer_rect[1].toFixed(8)}, ${mer_rect[2].toFixed(8)}] AU`);
console.log(`Earth helio:   [${earth_rect[0].toFixed(8)}, ${earth_rect[1].toFixed(8)}, ${earth_rect[2].toFixed(8)}] AU`);
console.log(`Expected sidereal: 248.048782°`);

// Formula 1: Mercury_helio - Earth_helio
const geo1_x = mer_rect[0] - earth_rect[0];
const geo1_y = mer_rect[1] - earth_rect[1];
const geo1_z = mer_rect[2] - earth_rect[2];
const lon1_trop = ((Math.atan2(geo1_y, geo1_x) * 180 / Math.PI) + 360) % 360;
const lon1_sid = ((lon1_trop - AYANAMSA) + 360) % 360;

console.log(`\nFormula 1: Geocentric = Mercury_helio - Earth_helio`);
console.log(`  Tropical: ${lon1_trop.toFixed(6)}°`);
console.log(`  Sidereal: ${lon1_sid.toFixed(6)}°`);
console.log(`  Error: ${(lon1_sid - 248.048782).toFixed(6)}°`);

// Formula 2: Earth_helio - Mercury_helio (opposite vector)
const geo2_x = earth_rect[0] - mer_rect[0];
const geo2_y = earth_rect[1] - mer_rect[1];
const geo2_z = earth_rect[2] - mer_rect[2];
const lon2_trop = ((Math.atan2(geo2_y, geo2_x) * 180 / Math.PI) + 360) % 360;
const lon2_sid = ((lon2_trop - AYANAMSA) + 360) % 360;

console.log(`\nFormula 2: Geocentric = Earth_helio - Mercury_helio`);
console.log(`  Tropical: ${lon2_trop.toFixed(6)}°`);
console.log(`  Sidereal: ${lon2_sid.toFixed(6)}°`);
console.log(`  Error: ${(lon2_sid - 248.048782).toFixed(6)}°`);

// Formula 3: Just use Mercury as-is (already geocentric?)
const lon3_trop = ((Math.atan2(mer_rect[1], mer_rect[0]) * 180 / Math.PI) + 360) % 360;
const lon3_sid = ((lon3_trop - AYANAMSA) + 360) % 360;

console.log(`\nFormula 3: Geocentric = Mercury as-is (no Earth subtraction)`);
console.log(`  Tropical: ${lon3_trop.toFixed(6)}°`);
console.log(`  Sidereal: ${lon3_sid.toFixed(6)}°`);
console.log(`  Error: ${(lon3_sid - 248.048782).toFixed(6)}°`);

console.log(`\n✓ Best match: Formula ${Math.abs(lon1_sid - 248.048782) < Math.abs(lon2_sid - 248.048782) ?
  (Math.abs(lon1_sid - 248.048782) < Math.abs(lon3_sid - 248.048782) ? 1 : 3) : 2}`);
