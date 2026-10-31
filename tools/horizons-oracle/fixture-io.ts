import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIXTURE_BUDGET_BYTES, type ObserverSite } from './config.js';
import type { HorizonsOracleMeta, HorizonsOracleRow } from './fetch.js';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixturePathForSite(siteId: string): string {
    return join(FIXTURE_DIR, `${siteId}.horizons.tsv`);
}

const HEADER_PREFIX = '# horizons-oracle-fixture v1';

export interface FixtureFile {
    site: ObserverSite;
    meta: HorizonsOracleMeta;
    rows: HorizonsOracleRow[];
}

function formatRow(row: HorizonsOracleRow): string {
    const { ra, dec, elon, elat } = row.sample;
    return [
        row.body,
        row.epochLabel,
        row.jd.toFixed(9),
        ra.toFixed(9),
        dec.toFixed(9),
        elon.toFixed(7),
        elat.toFixed(7),
    ].join('\t');
}

export function serializeFixture(
    site: ObserverSite,
    meta: HorizonsOracleMeta,
    rows: HorizonsOracleRow[],
): string {
    const lines = [
        HEADER_PREFIX,
        `# retrieved-utc: ${meta.retrievedUtc}`,
        `# horizons-api-version: ${meta.horizonsApiVersion}`,
        `# ephemeris: ${meta.ephemeris}`,
        `# site-id: ${site.id}`,
        `# site-label: ${site.label}`,
        `# query-url-template: ${meta.queryUrl}`,
        '# columns: body\\tepoch-label\\tjd\\tra\\tdec\\telon\\telat',
        'body\tepoch-label\tjd\tra\tdec\telon\telat',
        ...rows.map(formatRow),
    ];
    return `${lines.join('\n')}\n`;
}

export function parseFixture(text: string): FixtureFile {
    const meta: Partial<HorizonsOracleMeta> = {};
    let siteId = '';
    let siteLabel = '';
    const rows: HorizonsOracleRow[] = [];
    for (const line of text.split('\n')) {
        if (line.startsWith('# retrieved-utc:')) meta.retrievedUtc = line.slice(18).trim();
        else if (line.startsWith('# horizons-api-version:'))
            meta.horizonsApiVersion = line.slice(24).trim();
        else if (line.startsWith('# ephemeris:')) meta.ephemeris = line.slice(12).trim();
        else if (line.startsWith('# site-id:')) siteId = line.slice(11).trim();
        else if (line.startsWith('# site-label:')) siteLabel = line.slice(14).trim();
        else if (line.startsWith('# query-url-template:')) meta.queryUrl = line.slice(22).trim();
        else if (!line.trim() || line.startsWith('#')) continue;
        else if (line.startsWith('body\t')) continue;
        else {
            const [body, epochLabel, jd, ra, dec, elon, elat] = line.split('\t');
            rows.push({
                body,
                epochLabel,
                jd: Number(jd),
                sample: {
                    ra: Number(ra),
                    dec: Number(dec),
                    elon: Number(elon),
                    elat: Number(elat),
                },
            });
        }
    }
    if (!meta.retrievedUtc || !meta.ephemeris || !meta.queryUrl || !siteId) {
        throw new Error('Invalid horizons-oracle fixture header');
    }
    return {
        site: { id: siteId, label: siteLabel, center: '', epochLabels: [] },
        meta: meta as HorizonsOracleMeta,
        rows,
    };
}

export function writeFixture(
    site: ObserverSite,
    meta: HorizonsOracleMeta,
    rows: HorizonsOracleRow[],
): void {
    writeFileSync(fixturePathForSite(site.id), serializeFixture(site, meta, rows), 'utf8');
}

export function readFixture(siteId: string): FixtureFile {
    const text = readFileSync(fixturePathForSite(siteId), 'utf8');
    return parseFixture(text);
}

export function totalFixtureBytes(): number {
    let total = 0;
    for (const name of readdirSync(FIXTURE_DIR)) {
        if (!name.endsWith('.horizons.tsv')) continue;
        total += statSync(join(FIXTURE_DIR, name)).size;
    }
    return total;
}

export function assertFixtureBudget(): void {
    const total = totalFixtureBytes();
    if (total > FIXTURE_BUDGET_BYTES) {
        throw new Error(
            `Horizons oracle fixtures ${total} bytes exceed budget ${FIXTURE_BUDGET_BYTES}`,
        );
    }
}

export { FIXTURE_DIR };
