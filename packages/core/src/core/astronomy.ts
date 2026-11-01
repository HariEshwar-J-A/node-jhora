// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { normalize360 } from './math.js';

const DEGS_TO_RAD = Math.PI / 180;
const RAD_TO_DEGS = 180 / Math.PI;

/**
 * Calculates the Parallax correction for a planet (mainly Moon).
 * Converts Geocentric coordinates to Topocentric coordinates.
 */
export function calculateParallax(
    geoLon: number,
    geoLat: number,
    distanceAU: number,
    obsLat: number,
    lst: number,
    obl: number,
): { lon: number; lat: number } {
    // 1. Convert Ecliptic (Geo) -> Equatorial (Geo)
    const lonRad = geoLon * DEGS_TO_RAD;
    const latRad = geoLat * DEGS_TO_RAD;
    const oblRad = obl * DEGS_TO_RAD;

    // Standard conversion Ecl -> Eq
    const x = Math.cos(latRad) * Math.cos(lonRad);
    const y = Math.cos(latRad) * Math.sin(lonRad);
    const z = Math.sin(latRad);

    const eqX = x;
    const eqY = y * Math.cos(oblRad) - z * Math.sin(oblRad);
    const eqZ = y * Math.sin(oblRad) + z * Math.cos(oblRad);

    const geoRA = Math.atan2(eqY, eqX);
    const geoDec = Math.asin(eqZ);

    // 2. Observer's Geocentric Coordinates
    const flattening = 1 / 298.257223563;
    const obsLatRad = obsLat * DEGS_TO_RAD;
    // Standard Geodetic -> Geocentric conversion
    // u = atan( (1-f) * tan(phi) ) -- This gives Reduced Latitude.
    // Usually Parallax formulas use Geocentric Latitude directly or this conversion.
    // Let's use standard Astrological formulas which often use:
    // tan(phi') = (1-f^2) tan(phi)?
    // Yes: tan(phi_geoc) = (1-f)^2 tan(phi_geod)
    const C =
        1 / Math.sqrt(Math.cos(obsLatRad) ** 2 + (1 - flattening) ** 2 * Math.sin(obsLatRad) ** 2);
    const S = (1 - flattening) ** 2 * C;

    // Neglecting height (h=0) factors for now as usually minimal vs Lat effect
    const rhoSinPhiP = S * Math.sin(obsLatRad);
    const rhoCosPhiP = C * Math.cos(obsLatRad);

    // 3. Hour Angle
    const lstRad = lst * DEGS_TO_RAD;
    const H = lstRad - geoRA;

    // 4. Parallax Calculation
    // 1 AU = 149597870.7 km, Earth Rad = 6378.14 km => ~23454.79 ER/AU
    const AU_TO_ER = 23454.79;
    const r = distanceAU * AU_TO_ER;

    // Vector Topocentric = Vector Geo - Vector Observer
    // Geo Vector (Eq)
    const gx = r * Math.cos(geoDec) * Math.cos(geoRA);
    const gy = r * Math.cos(geoDec) * Math.sin(geoRA);
    const gz = r * Math.sin(geoDec);

    // Obs Vector (Eq) at GST (actually needs LAST)
    // Coords are rotated by LST
    // Xobs = rho cos(phi') cos(LST)
    // Yobs = rho cos(phi') sin(LST)
    // Zobs = rho sin(phi')
    const ox = rhoCosPhiP * Math.cos(lstRad);
    const oy = rhoCosPhiP * Math.sin(lstRad);
    const oz = rhoSinPhiP;

    const tx = gx - ox;
    const ty = gy - oy;
    const tz = gz - oz;

    // Back to Eq (Topo)
    const topoDist = Math.sqrt(tx * tx + ty * ty + tz * tz);
    const topoRARad = Math.atan2(ty, tx);
    const topoDecRad = Math.asin(tz / topoDist);

    // 5. Convert Equatorial (Topo) -> Ecliptic (Topo)
    const finalX = Math.cos(topoDecRad) * Math.cos(topoRARad);
    const eclY_eq = Math.cos(topoDecRad) * Math.sin(topoRARad);
    const eclZ_eq = Math.sin(topoDecRad);

    const finalY = eclY_eq * Math.cos(oblRad) + eclZ_eq * Math.sin(oblRad);
    const finalZ = -eclY_eq * Math.sin(oblRad) + eclZ_eq * Math.cos(oblRad);

    const topoLonRad = Math.atan2(finalY, finalX);
    const topoLatRad = Math.asin(finalZ);

    return {
        lon: normalize360(topoLonRad * RAD_TO_DEGS),
        lat: topoLatRad * RAD_TO_DEGS,
    };
}
