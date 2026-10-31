import { jdFromUtc } from '../oracles/horizons/julday.js';
import {
    EPOCH_SPECS,
    FIXTURE_BODY_ORDER,
    HORIZONS_API_ORIGIN,
    HORIZONS_COMMAND,
    HORIZONS_ORACLE_REQUEST_PARAMS,
    type ObserverSite,
} from './config.js';

export interface HorizonsOracleSample {
    ra: number;
    dec: number;
    elon: number;
    elat: number;
}

export interface HorizonsOracleRow {
    body: string;
    epochLabel: string;
    jd: number;
    sample: HorizonsOracleSample;
}

export interface HorizonsOracleMeta {
    horizonsApiVersion: string;
    ephemeris: string;
    retrievedUtc: string;
    queryUrl: string;
}

function buildQuery(site: ObserverSite, command: string, tlist: string): string {
    const params = new URLSearchParams({
        ...HORIZONS_ORACLE_REQUEST_PARAMS,
        CENTER: site.center,
        COMMAND: `'${command}'`,
        TLIST: tlist,
    });
    if (site.siteCoord) {
        params.set('SITE_COORD', `'${site.siteCoord}'`);
    }
    return `${HORIZONS_API_ORIGIN}?${params.toString()}`;
}

export function parseEphemerisLabel(result: string): string {
    const m = result.match(/\{source:\s*(DE\d+)\}/);
    return m?.[1] ?? 'unknown';
}

/** Parse observer rows for QUANTITIES 2,31 (RA, Dec, ecliptic lon, lat). */
export function parseHorizonsOracleRow(line: string): HorizonsOracleSample {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 4) throw new Error(`Unrecognized Horizons row: ${line}`);
    const elat = Number(cols[cols.length - 1]);
    const elon = Number(cols[cols.length - 2]);
    const dec = Number(cols[cols.length - 3]);
    const ra = Number(cols[cols.length - 4]);
    if (![ra, dec, elon, elat].every(Number.isFinite)) {
        throw new Error(`Non-numeric Horizons row: ${line}`);
    }
    return { ra, dec, elon, elat };
}

export function parseHorizonsOracleTable(result: string): HorizonsOracleSample[] {
    const start = result.indexOf('$$SOE');
    const end = result.indexOf('$$EOE');
    if (start < 0 || end < 0 || end <= start) {
        throw new Error('Horizons result missing $$SOE/$$EOE block');
    }
    const block = result.slice(start + 5, end);
    const rows = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    return rows.map(parseHorizonsOracleRow);
}

function epochListForSite(site: ObserverSite): typeof EPOCH_SPECS {
    if (site.epochLabels === 'ALL') return EPOCH_SPECS;
    const want = new Set(site.epochLabels);
    return EPOCH_SPECS.filter((e) => want.has(e.label));
}

export interface FetchOptions {
    fetchImpl?: typeof fetch;
}

export async function fetchSiteOracle(
    site: ObserverSite,
    options: FetchOptions = {},
): Promise<{ rows: HorizonsOracleRow[]; meta: HorizonsOracleMeta }> {
    const epochs = epochListForSite(site);
    const jds = epochs.map((spec) => jdFromUtc(spec.utc));
    const tlist = jds.map((jd) => jd.toFixed(9)).join(',');
    const fetchFn = options.fetchImpl ?? fetch;

    const byBody = new Map<string, HorizonsOracleSample[]>();
    let horizonsApiVersion = 'unknown';
    let ephemeris = 'unknown';
    let queryUrl = '';

    for (const bodyName of FIXTURE_BODY_ORDER) {
        const command = HORIZONS_COMMAND[bodyName];
        if (!command) throw new Error(`No Horizons COMMAND for ${bodyName}`);
        queryUrl = buildQuery(site, command, tlist);
        const response = await fetchFn(queryUrl);
        if (!response.ok) throw new Error(`Horizons HTTP ${response.status} for ${bodyName}`);
        const payload = (await response.json()) as {
            result?: string;
            error?: string;
            signature?: { version?: string };
        };
        if (payload.error) throw new Error(`Horizons error for ${bodyName}: ${payload.error}`);
        if (!payload.result) throw new Error(`Horizons empty result for ${bodyName}`);
        const samples = parseHorizonsOracleTable(payload.result);
        if (samples.length !== jds.length) {
            throw new Error(
                `Horizons row count ${samples.length} != ${jds.length} for ${bodyName}`,
            );
        }
        byBody.set(bodyName, samples);
        horizonsApiVersion = payload.signature?.version ?? horizonsApiVersion;
        ephemeris = parseEphemerisLabel(payload.result);
    }

    const rows: HorizonsOracleRow[] = [];
    for (let i = 0; i < epochs.length; i++) {
        const spec = epochs[i];
        const jd = jds[i];
        for (const bodyName of FIXTURE_BODY_ORDER) {
            rows.push({
                body: bodyName,
                epochLabel: spec.label,
                jd,
                sample: byBody.get(bodyName)![i],
            });
        }
    }

    return {
        rows,
        meta: {
            horizonsApiVersion,
            ephemeris,
            retrievedUtc: new Date().toISOString(),
            queryUrl: queryUrl
                .replace(/COMMAND=%27\d+%27/, "COMMAND='{COMMAND}'")
                .replace(/TLIST=[^&]+/, 'TLIST={TLIST}'),
        },
    };
}
