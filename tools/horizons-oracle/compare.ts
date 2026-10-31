/**
 * Compare node-jhora (modern precision profile) to cached Horizons oracle rows.
 */

import { DateTime } from '../../packages/core/node_modules/luxon/build/node/luxon.js';
import { EphemerisEngine } from '../../packages/core/dist/engine/ephemeris.js';
import { deltaT } from '../../packages/core/dist/engine/deltat.js';
import { meanObliquity } from '../../packages/core/dist/engine/precession.js';
import { nutation } from '../../packages/core/dist/engine/nutation.js';
import {
    FUTURE_TOLERANCE_ARCSEC,
    LAST_OBSERVED_DELTAT_YEAR,
    TOLERANCE_ARCSEC,
} from '../../packages/core/tests/fixtures/horizons_golden.js';

import {
    COMPARE_BODIES,
    EPOCH_SPECS,
    eraBucket,
    type EraBucket,
    type ObserverSite,
} from './config.js';
import type { HorizonsOracleRow } from './fetch.js';
import type { FixtureFile } from './fixture-io.js';

export interface Residual {
    body: string;
    epochLabel: string;
    siteId: string;
    era: EraBucket;
    dElonArcsec: number;
    dElatArcsec: number;
    dRaArcsec: number;
    dDecArcsec: number;
}

function deltaArcsec(a: number, b: number): number {
    let d = a - b;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d * 3600;
}

function eclipticToEquatorial(lon: number, beta: number, epsDeg: number): [number, number] {
    const L = (lon * Math.PI) / 180;
    const B = (beta * Math.PI) / 180;
    const E = (epsDeg * Math.PI) / 180;
    const dec =
        (Math.asin(Math.sin(B) * Math.cos(E) + Math.cos(B) * Math.sin(E) * Math.sin(L)) * 180) /
        Math.PI;
    let ra =
        (Math.atan2(Math.sin(L) * Math.cos(E) - Math.tan(B) * Math.sin(E), Math.cos(L)) * 180) /
        Math.PI;
    ra = ((ra % 360) + 360) % 360;
    return [ra, dec];
}

function toleranceForYear(year: number) {
    return year <= LAST_OBSERVED_DELTAT_YEAR ? TOLERANCE_ARCSEC : FUTURE_TOLERANCE_ARCSEC;
}

function utcFromRow(row: HorizonsOracleRow): DateTime {
    const spec = EPOCH_SPECS.find((e) => e.label === row.epochLabel);
    if (!spec) throw new Error(`Unknown epoch label ${row.epochLabel}`);
    return DateTime.fromObject(spec.utc, { zone: 'utc' });
}

export function compareFixture(
    engine: EphemerisEngine,
    fixture: FixtureFile,
    site: ObserverSite,
): Residual[] {
    const residuals: Residual[] = [];
    const topocentric = site.geo !== undefined;

    for (const row of fixture.rows) {
        if (!COMPARE_BODIES.includes(row.body)) continue;
        const utc = utcFromRow(row);
        const year = utc.year;
        const jd = engine.julday(utc);
        const dT = deltaT(jd, 'modern', 'oracle-compat');
        const T = (jd + dT / 86400 - 2451545.0) / 36525;
        const { dpsi, deps } = nutation(T);
        const epsTrue = meanObliquity(T, jd + dT / 86400) + deps;

        const planets = engine.getPlanets(utc, site.geo, {
            positionMode: 'apparent',
            precisionProfile: 'modern',
            deltaTForecast: 'oracle-compat',
            topocentric,
        });
        const p = planets.find((pl) => pl.name === row.body);
        if (!p) throw new Error(`Engine missing body ${row.body}`);

        const ayan = engine.getAyanamsa(jd, undefined, 0, 'apparent');
        const elon = (((p.longitude + ayan + dpsi) % 360) + 360) % 360;
        const elat = p.latitude;
        const [ra, dec] = eclipticToEquatorial(elon, elat, epsTrue);

        const era = eraBucket(year);
        residuals.push({
            body: row.body,
            epochLabel: row.epochLabel,
            siteId: site.id,
            era,
            dElonArcsec: deltaArcsec(elon, row.sample.elon),
            dElatArcsec: (elat - row.sample.elat) * 3600,
            dRaArcsec: deltaArcsec(ra, row.sample.ra),
            dDecArcsec: (dec - row.sample.dec) * 3600,
        });

        const tol = toleranceForYear(year);
        if (Math.abs(residuals.at(-1)!.dElonArcsec) > tol.longitude) {
            throw new Error(
                `${row.body} @ ${row.epochLabel} (${site.id}) elon ${residuals.at(-1)!.dElonArcsec}″ > ${tol.longitude}″`,
            );
        }
        if (Math.abs(residuals.at(-1)!.dElatArcsec) > tol.latitude) {
            throw new Error(
                `${row.body} @ ${row.epochLabel} (${site.id}) elat ${residuals.at(-1)!.dElatArcsec}″ > ${tol.latitude}″`,
            );
        }
    }
    return residuals;
}

export interface MaxErrorTable {
    byBodyEra: Record<
        string,
        Record<EraBucket, { elon: number; elat: number; ra: number; dec: number }>
    >;
}

export function maxErrorTable(residuals: Residual[]): MaxErrorTable {
    const byBodyEra: MaxErrorTable['byBodyEra'] = {};
    for (const r of residuals) {
        byBodyEra[r.body] ??= {} as Record<
            EraBucket,
            { elon: number; elat: number; ra: number; dec: number }
        >;
        const slot = byBodyEra[r.body][r.era] ?? { elon: 0, elat: 0, ra: 0, dec: 0 };
        slot.elon = Math.max(slot.elon, Math.abs(r.dElonArcsec));
        slot.elat = Math.max(slot.elat, Math.abs(r.dElatArcsec));
        slot.ra = Math.max(slot.ra, Math.abs(r.dRaArcsec));
        slot.dec = Math.max(slot.dec, Math.abs(r.dDecArcsec));
        byBodyEra[r.body][r.era] = slot;
    }
    return { byBodyEra };
}

export function formatMaxErrorTable(table: MaxErrorTable): string {
    const eras: EraBucket[] = ['pre-1900', 'published-dT', 'future-dT'];
    const lines = ['| Body | Era | max |elon|″ | max |elat|″ | max |RA|″ | max |Dec|″ |'];
    lines.push('| --- | --- | ---: | ---: | ---: | ---: |');
    for (const body of COMPARE_BODIES) {
        for (const era of eras) {
            const m = table.byBodyEra[body]?.[era];
            if (!m) continue;
            lines.push(
                `| ${body} | ${era} | ${m.elon.toFixed(3)} | ${m.elat.toFixed(3)} | ${m.ra.toFixed(3)} | ${m.dec.toFixed(3)} |`,
            );
        }
    }
    return lines.join('\n');
}
