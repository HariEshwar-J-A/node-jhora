import {
    EPOCH_SPECS,
    FIXTURE_BODY_ORDER,
    HORIZONS_API_ORIGIN,
    HORIZONS_COMMAND,
    HORIZONS_REQUEST_PARAMS,
} from './config.js';
import { jdFromUtc } from './julday.js';

export interface HorizonsSample {
    lon: number;
    lat: number;
}

export interface HorizonsFetchMeta {
    horizonsApiVersion: string;
    ephemeris: string;
}

function buildQuery(command: string, tlist: string): string {
    const params = new URLSearchParams({
        ...HORIZONS_REQUEST_PARAMS,
        COMMAND: `'${command}'`,
        TLIST: tlist,
    });
    return `${HORIZONS_API_ORIGIN}?${params.toString()}`;
}

/** Canonical query URL template (TLIST and COMMAND are placeholders). */
export function horizonsQueryUrlTemplate(): string {
    const params = new URLSearchParams({
        ...HORIZONS_REQUEST_PARAMS,
        COMMAND: "'{COMMAND}'",
        TLIST: '{TLIST}',
    });
    return `${HORIZONS_API_ORIGIN}?${params.toString()}`;
}

function parseObserverRow(line: string): HorizonsSample {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 3) throw new Error(`Unrecognized Horizons row: ${line}`);
    const lon = Number(cols[cols.length - 2]);
    const lat = Number(cols[cols.length - 1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        throw new Error(`Non-numeric Horizons row: ${line}`);
    }
    return { lon, lat };
}

export function parseHorizonsObserverTable(result: string): HorizonsSample[] {
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
    return rows.map(parseObserverRow);
}

export function parseEphemerisLabel(result: string): string {
    const m = result.match(/\{source:\s*(DE\d+)\}/);
    return m?.[1] ?? 'unknown';
}

export interface FetchOptions {
    fetchImpl?: typeof fetch;
}

export async function fetchBodyEphemeris(
    bodyName: string,
    jds: readonly number[],
    options: FetchOptions = {},
): Promise<{
    samples: HorizonsSample[];
    queryUrl: string;
    result: string;
    signature: HorizonsFetchMeta;
}> {
    const command = HORIZONS_COMMAND[bodyName];
    if (!command) throw new Error(`No Horizons COMMAND for ${bodyName}`);
    const tlist = jds.map((jd) => jd.toFixed(9)).join(',');
    const queryUrl = buildQuery(command, tlist);
    const fetchFn = options.fetchImpl ?? fetch;
    const response = await fetchFn(queryUrl);
    if (!response.ok) throw new Error(`Horizons HTTP ${response.status} for ${bodyName}`);
    const payload = (await response.json()) as {
        result?: string;
        error?: string;
        signature?: { version?: string; source?: string };
    };
    if (payload.error) throw new Error(`Horizons error for ${bodyName}: ${payload.error}`);
    if (!payload.result) throw new Error(`Horizons empty result for ${bodyName}`);
    const samples = parseHorizonsObserverTable(payload.result);
    if (samples.length !== jds.length) {
        throw new Error(`Horizons row count ${samples.length} != ${jds.length} for ${bodyName}`);
    }
    const ephemeris = parseEphemerisLabel(payload.result);
    const horizonsApiVersion = payload.signature?.version ?? 'unknown';
    return {
        samples,
        queryUrl,
        result: payload.result,
        signature: { horizonsApiVersion, ephemeris },
    };
}

export interface FetchedEpochBody {
    name: string;
    lon: number;
    lat: number;
}

export interface FetchedEpoch {
    label: string;
    jd: number;
    utc: (typeof EPOCH_SPECS)[number]['utc'];
    bodies: FetchedEpochBody[];
}

export async function fetchHorizonsFixture(options: FetchOptions = {}): Promise<{
    epochs: FetchedEpoch[];
    provenance: {
        horizonsApiVersion: string;
        ephemeris: string;
        queryUrlTemplate: string;
        requestParameters: Readonly<Record<string, string>>;
    };
}> {
    const jds = EPOCH_SPECS.map((spec) => jdFromUtc(spec.utc));
    const byBody = new Map<string, HorizonsSample[]>();
    let horizonsApiVersion = 'unknown';
    let ephemeris = 'unknown';

    for (const bodyName of FIXTURE_BODY_ORDER) {
        const { samples, signature } = await fetchBodyEphemeris(bodyName, jds, options);
        byBody.set(bodyName, samples);
        horizonsApiVersion = signature.horizonsApiVersion;
        ephemeris = signature.ephemeris;
    }

    const epochs: FetchedEpoch[] = EPOCH_SPECS.map((spec, epochIndex) => ({
        label: spec.label,
        jd: jds[epochIndex],
        utc: spec.utc,
        bodies: FIXTURE_BODY_ORDER.map((name) => {
            const sample = byBody.get(name)![epochIndex];
            return { name, lon: sample.lon, lat: sample.lat };
        }),
    }));

    return {
        epochs,
        provenance: {
            horizonsApiVersion,
            ephemeris,
            queryUrlTemplate: horizonsQueryUrlTemplate(),
            requestParameters: HORIZONS_REQUEST_PARAMS,
            retrievedAtUtc: new Date().toISOString().slice(0, 10),
        },
    };
}
