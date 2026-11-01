/**
 * J2000 TT sanity check for astronomy-engine (bench-only).
 * argv: jdUt deltaTSeconds truthSunLonDeg
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const jdUt = Number(process.argv[2]);
const dt = Number(process.argv[3]);
const truthLon = Number(process.argv[4]);
const jdTT = jdUt + dt / 86400;
const daysSinceJ2000 = jdTT - 2451545.0;

const Astronomy = require(join(__dirname, '../node_modules/astronomy-engine'));
const time = Astronomy.AstroTime.FromTerrestrialTime(daysSinceJ2000);
const ecl = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Sun, time, true));
const lon = ((ecl.elon % 360) + 360) % 360;
let d = lon - truthLon;
if (d > 180) d -= 360;
if (d < -180) d += 360;
const err = Math.abs(d) * 3600;
if (err > 20) {
    console.error(
        `astronomy-engine J2000 TT Sun residual ${err.toFixed(3)}″ (expected <20″); lon=${lon} truth=${truthLon}`,
    );
    process.exit(1);
}
