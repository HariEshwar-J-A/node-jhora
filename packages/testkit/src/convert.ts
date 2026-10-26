/**
 * Lossless mapping between the legacy TypeScript fixtures and golden cases.
 *
 * Choices the legacy modules do not record, fixed here so every case still
 * satisfies the schema:
 * - altitude is 0 m
 * - the Chennai chart uses `Asia/Kolkata` (the fixture's +5.5 h offset)
 * - Horizons rows are geocentric: lat 0, lon 0, timezone `UTC`
 * - `provenance.toolVersion` is `unrecorded` and `capturedAt` is null
 * - panchanga percent slack stays on `meta.panchanga.tolerancePercent`
 *   because the tolerance kinds are only arcsec, seconds, and exact
 * - dasha `toleranceDays` is stored as seconds on each boundary
 */

import {
    type ExpectedEntry,
    type GoldenCase,
    GoldenCaseSchema,
    hashSettings,
    type SettingsDocument,
} from './schema.js';

const BODY_ORDER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
const CLOCK_PARTS = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

const LEGACY_PROVENANCE = { toolVersion: 'unrecorded', capturedAt: null } as const;

export const JHORA_CASE_ID = 'jhora-chennai-2000-01-01';
export const JHORA_TIMEZONE = 'Asia/Kolkata';
export const JHORA_PRESET_ID = 'jhora-true-citra-geometric-true-node';
export const HORIZONS_PRESET_ID = 'horizons-apparent-geocentric';
export const LEGACY_ALTITUDE_M = 0;

export interface DateParts {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
}

export interface JhoraBody {
    readonly name: string;
    readonly printed: string;
    readonly sign: number;
    readonly longitude: number;
    readonly retrograde?: boolean;
    readonly toleranceArcsec: number;
}

export interface JhoraAngle {
    readonly printed: string;
    readonly sign: number;
    readonly longitude: number;
    readonly toleranceArcsec: number;
}

export interface JhoraFixture {
    readonly birth: {
        readonly local: DateParts & { readonly utcOffset: number };
        readonly utc: DateParts;
        readonly lat: number;
        readonly lon: number;
        readonly jd: number;
    };
    readonly conventions: {
        readonly ayanamsaMode: number;
        readonly positionMode: string;
        readonly nodeType: string;
    };
    readonly ayanamsa: {
        readonly printed: string;
        readonly value: number;
        readonly mode: number;
        readonly toleranceArcsec: number;
    };
    readonly d1: readonly JhoraBody[];
    readonly ascendant: JhoraAngle;
    readonly siderealTime: { readonly printed: string; readonly hours: number; readonly toleranceSeconds: number };
    readonly d9: readonly JhoraBody[];
    readonly d9Ascendant: JhoraAngle;
    readonly panchanga: {
        readonly tithi: { readonly name: string; readonly index: number; readonly percentLeft: number };
        readonly nakshatra: { readonly name: string; readonly index: number; readonly pada: number; readonly percentLeft: number };
        readonly yoga: { readonly name: string; readonly percentLeft: number };
        readonly karana: { readonly name: string; readonly percentLeft: number };
        readonly vara: { readonly name: string; readonly index: number };
        readonly tolerancePercent: number;
    };
    readonly dasha: {
        readonly startLord: string;
        readonly boundaries: readonly { readonly lord: string; readonly endsOn: string }[];
        readonly toleranceDays: number;
    };
    readonly d10Scheme: string;
    readonly d10Label: string;
    readonly d10: readonly JhoraBody[];
    readonly d10Ascendant: JhoraAngle;
    readonly d10EvenSignBodies: readonly string[];
}

export interface HorizonsFixture {
    readonly epochs: readonly {
        readonly label: string;
        readonly jd: number;
        readonly utc: DateParts;
        readonly bodies: readonly { readonly name: string; readonly lon: number; readonly lat: number }[];
    }[];
    readonly toleranceArcsec: { readonly longitude: number; readonly latitude: number };
    readonly futureToleranceArcsec: { readonly longitude: number; readonly latitude: number };
    readonly lastObservedDeltaTYear: number;
}

type ExpectedMap = Record<string, ExpectedEntry>;

function putExact(out: ExpectedMap, path: string, value: string | number | boolean): void {
    out[path] = { value, tolerance: { type: 'exact' } };
}

function putArcsec(out: ExpectedMap, path: string, value: number, arcsec: number): void {
    out[path] = { value, tolerance: { type: 'arcsec', arcsec } };
}

function putSeconds(out: ExpectedMap, path: string, value: string | number, seconds: number): void {
    out[path] = { value, tolerance: { type: 'seconds', seconds } };
}

function sorted<T>(record: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
}

function finish(draft: GoldenCase): GoldenCase {
    const parsed = GoldenCaseSchema.parse(draft);
    return { ...parsed, settings: sorted(parsed.settings), expected: sorted(parsed.expected) };
}

function utcInstant(utc: DateParts): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${String(utc.year).padStart(4, '0')}-${pad(utc.month)}-${pad(utc.day)}T${pad(utc.hour)}:${pad(utc.minute)}:${pad(utc.second)}Z`;
}

function writeClock(out: ExpectedMap, prefix: string, clock: DateParts): void {
    for (const part of CLOCK_PARTS) putExact(out, `${prefix}.${part}`, clock[part]);
}

function writeBodies(out: ExpectedMap, varga: string, bodies: readonly JhoraBody[]): void {
    for (const body of bodies) {
        const base = `${varga}.planets.${body.name}`;
        putArcsec(out, `${base}.lon`, body.longitude, body.toleranceArcsec);
        putExact(out, `${base}.sign`, body.sign);
        putExact(out, `${base}.printed`, body.printed);
        if (body.retrograde !== undefined) putExact(out, `${base}.retrograde`, body.retrograde);
    }
}

function writeAngle(out: ExpectedMap, prefix: string, angle: JhoraAngle): void {
    putArcsec(out, `${prefix}.lon`, angle.longitude, angle.toleranceArcsec);
    putExact(out, `${prefix}.sign`, angle.sign);
    putExact(out, `${prefix}.printed`, angle.printed);
}

function requireEntry(expected: ExpectedMap, path: string): ExpectedEntry {
    const found = expected[path];
    if (!found) throw new Error(`Golden case is missing ${path}`);
    return found;
}

function exactValue<T extends string | number | boolean>(expected: ExpectedMap, path: string): T {
    const found = requireEntry(expected, path);
    if (found.tolerance.type !== 'exact') throw new Error(`${path} must use exact tolerance`);
    return found.value as T;
}

function angleOf(expected: ExpectedMap, prefix: string): JhoraAngle {
    const longitude = requireEntry(expected, `${prefix}.lon`);
    if (longitude.tolerance.type !== 'arcsec' || typeof longitude.value !== 'number') {
        throw new Error(`${prefix}.lon must be an arcsecond angle`);
    }
    return {
        printed: exactValue(expected, `${prefix}.printed`),
        sign: exactValue(expected, `${prefix}.sign`),
        longitude: longitude.value,
        toleranceArcsec: longitude.tolerance.arcsec,
    };
}

function bodiesOf(expected: ExpectedMap, varga: string): JhoraBody[] {
    const bodies: JhoraBody[] = [];
    for (const name of BODY_ORDER) {
        const base = `${varga}.planets.${name}`;
        if (!(`${base}.lon` in expected)) continue;
        const angle = angleOf(expected, base);
        const body: JhoraBody = {
            name,
            printed: angle.printed,
            sign: angle.sign,
            longitude: angle.longitude,
            toleranceArcsec: angle.toleranceArcsec,
        };
        if (`${base}.retrograde` in expected) {
            bodies.push({ ...body, retrograde: exactValue<boolean>(expected, `${base}.retrograde`) });
        } else {
            bodies.push(body);
        }
    }
    return bodies;
}

function clockOf(expected: ExpectedMap, prefix: string): DateParts {
    return {
        year: exactValue(expected, `${prefix}.year`),
        month: exactValue(expected, `${prefix}.month`),
        day: exactValue(expected, `${prefix}.day`),
        hour: exactValue(expected, `${prefix}.hour`),
        minute: exactValue(expected, `${prefix}.minute`),
        second: exactValue(expected, `${prefix}.second`),
    };
}

export function toJhoraGoldenCase(fixture: JhoraFixture): GoldenCase {
    const expected: ExpectedMap = {};
    writeClock(expected, 'meta.birth.utc', fixture.birth.utc);
    writeClock(expected, 'meta.birth.local', fixture.birth.local);
    putExact(expected, 'meta.birth.utcOffsetHours', fixture.birth.local.utcOffset);
    putExact(expected, 'time.jd', fixture.birth.jd);
    putArcsec(expected, 'ayanamsa.value', fixture.ayanamsa.value, fixture.ayanamsa.toleranceArcsec);
    putExact(expected, 'ayanamsa.printed', fixture.ayanamsa.printed);
    putExact(expected, 'ayanamsa.mode', fixture.ayanamsa.mode);
    writeBodies(expected, 'd1', fixture.d1);
    writeAngle(expected, 'd1.ascendant', fixture.ascendant);
    putSeconds(expected, 'siderealTime.hours', fixture.siderealTime.hours, fixture.siderealTime.toleranceSeconds);
    putExact(expected, 'siderealTime.printed', fixture.siderealTime.printed);
    writeBodies(expected, 'd9', fixture.d9);
    writeAngle(expected, 'd9.ascendant', fixture.d9Ascendant);
    const panchanga = fixture.panchanga;
    putExact(expected, 'panchanga.tithi.name', panchanga.tithi.name);
    putExact(expected, 'panchanga.tithi.index', panchanga.tithi.index);
    putExact(expected, 'panchanga.tithi.percentLeft', panchanga.tithi.percentLeft);
    putExact(expected, 'panchanga.nakshatra.name', panchanga.nakshatra.name);
    putExact(expected, 'panchanga.nakshatra.index', panchanga.nakshatra.index);
    putExact(expected, 'panchanga.nakshatra.pada', panchanga.nakshatra.pada);
    putExact(expected, 'panchanga.nakshatra.percentLeft', panchanga.nakshatra.percentLeft);
    putExact(expected, 'panchanga.yoga.name', panchanga.yoga.name);
    putExact(expected, 'panchanga.yoga.percentLeft', panchanga.yoga.percentLeft);
    putExact(expected, 'panchanga.karana.name', panchanga.karana.name);
    putExact(expected, 'panchanga.karana.percentLeft', panchanga.karana.percentLeft);
    putExact(expected, 'panchanga.vara.name', panchanga.vara.name);
    putExact(expected, 'panchanga.vara.index', panchanga.vara.index);
    putExact(expected, 'meta.panchanga.tolerancePercent', panchanga.tolerancePercent);
    putExact(expected, 'dasa.vimshottari.startLord', fixture.dasha.startLord);
    const slackSeconds = fixture.dasha.toleranceDays * 86400;
    fixture.dasha.boundaries.forEach((boundary, index) => {
        putExact(expected, `dasa.vimshottari[${index}].lord`, boundary.lord);
        putSeconds(expected, `dasa.vimshottari[${index}].end`, boundary.endsOn, slackSeconds);
    });
    putExact(expected, 'd10.scheme', fixture.d10Scheme);
    putExact(expected, 'd10.label', fixture.d10Label);
    writeBodies(expected, 'd10', fixture.d10);
    writeAngle(expected, 'd10.ascendant', fixture.d10Ascendant);
    fixture.d10EvenSignBodies.forEach((name, index) => {
        putExact(expected, `d10.evenSignBodies[${index}]`, name);
    });

    const settings: SettingsDocument = {
        ayanamsaMode: fixture.conventions.ayanamsaMode,
        dasamsaScheme: fixture.d10Scheme,
        nodeType: fixture.conventions.nodeType,
        positionMode: fixture.conventions.positionMode,
    };
    return finish({
        id: JHORA_CASE_ID,
        provenance: { source: 'jhora', ...LEGACY_PROVENANCE },
        input: {
            instant: utcInstant(fixture.birth.utc),
            timezone: JHORA_TIMEZONE,
            lat: fixture.birth.lat,
            lon: fixture.birth.lon,
            alt: LEGACY_ALTITUDE_M,
            settingsPresetId: JHORA_PRESET_ID,
            settingsHash: hashSettings(settings),
        },
        settings,
        expected,
    });
}

export function fromJhoraGoldenCase(golden: GoldenCase): JhoraFixture {
    const expected = golden.expected;
    const seconds = boundarySeconds(expected);
    const boundaries: { lord: string; endsOn: string }[] = [];
    for (let index = 0; `dasa.vimshottari[${index}].lord` in expected; index += 1) {
        const end = requireEntry(expected, `dasa.vimshottari[${index}].end`);
        if (end.tolerance.type !== 'seconds' || end.tolerance.seconds !== seconds) {
            throw new Error(`dasa.vimshottari[${index}].end slack is not ${seconds} seconds`);
        }
        if (typeof end.value !== 'string') throw new Error(`dasa.vimshottari[${index}].end must be a date`);
        boundaries.push({ lord: exactValue(expected, `dasa.vimshottari[${index}].lord`), endsOn: end.value });
    }
    const evenSignBodies: string[] = [];
    for (let index = 0; `d10.evenSignBodies[${index}]` in expected; index += 1) {
        evenSignBodies.push(exactValue(expected, `d10.evenSignBodies[${index}]`));
    }
    const sidereal = requireEntry(expected, 'siderealTime.hours');
    if (sidereal.tolerance.type !== 'seconds' || typeof sidereal.value !== 'number') {
        throw new Error('siderealTime.hours must be a numeric seconds tolerance');
    }
    return {
        birth: {
            local: { ...clockOf(expected, 'meta.birth.local'), utcOffset: exactValue(expected, 'meta.birth.utcOffsetHours') },
            utc: clockOf(expected, 'meta.birth.utc'),
            lat: golden.input.lat,
            lon: golden.input.lon,
            jd: exactValue(expected, 'time.jd'),
        },
        conventions: {
            ayanamsaMode: Number(golden.settings.ayanamsaMode),
            positionMode: String(golden.settings.positionMode),
            nodeType: String(golden.settings.nodeType),
        },
        ayanamsa: readAyanamsa(expected),
        d1: bodiesOf(expected, 'd1'),
        ascendant: angleOf(expected, 'd1.ascendant'),
        siderealTime: {
            printed: exactValue(expected, 'siderealTime.printed'),
            hours: sidereal.value,
            toleranceSeconds: sidereal.tolerance.seconds,
        },
        d9: bodiesOf(expected, 'd9'),
        d9Ascendant: angleOf(expected, 'd9.ascendant'),
        panchanga: {
            tithi: {
                name: exactValue(expected, 'panchanga.tithi.name'),
                index: exactValue(expected, 'panchanga.tithi.index'),
                percentLeft: exactValue(expected, 'panchanga.tithi.percentLeft'),
            },
            nakshatra: {
                name: exactValue(expected, 'panchanga.nakshatra.name'),
                index: exactValue(expected, 'panchanga.nakshatra.index'),
                pada: exactValue(expected, 'panchanga.nakshatra.pada'),
                percentLeft: exactValue(expected, 'panchanga.nakshatra.percentLeft'),
            },
            yoga: {
                name: exactValue(expected, 'panchanga.yoga.name'),
                percentLeft: exactValue(expected, 'panchanga.yoga.percentLeft'),
            },
            karana: {
                name: exactValue(expected, 'panchanga.karana.name'),
                percentLeft: exactValue(expected, 'panchanga.karana.percentLeft'),
            },
            vara: {
                name: exactValue(expected, 'panchanga.vara.name'),
                index: exactValue(expected, 'panchanga.vara.index'),
            },
            tolerancePercent: exactValue(expected, 'meta.panchanga.tolerancePercent'),
        },
        dasha: {
            startLord: exactValue(expected, 'dasa.vimshottari.startLord'),
            boundaries,
            toleranceDays: seconds / 86400,
        },
        d10Scheme: exactValue(expected, 'd10.scheme'),
        d10Label: exactValue(expected, 'd10.label'),
        d10: bodiesOf(expected, 'd10'),
        d10Ascendant: angleOf(expected, 'd10.ascendant'),
        d10EvenSignBodies: evenSignBodies,
    };
}

function readAyanamsa(expected: ExpectedMap): JhoraFixture['ayanamsa'] {
    const value = requireEntry(expected, 'ayanamsa.value');
    if (value.tolerance.type !== 'arcsec' || typeof value.value !== 'number') {
        throw new Error('ayanamsa.value must be an arcsecond angle');
    }
    return {
        printed: exactValue(expected, 'ayanamsa.printed'),
        value: value.value,
        mode: exactValue(expected, 'ayanamsa.mode'),
        toleranceArcsec: value.tolerance.arcsec,
    };
}

function boundarySeconds(expected: ExpectedMap): number {
    const first = requireEntry(expected, 'dasa.vimshottari[0].end');
    if (first.tolerance.type !== 'seconds') throw new Error('dasa boundary tolerance must be seconds');
    return first.tolerance.seconds;
}

function horizonsId(label: string): string {
    const date = /^(\d{4}-\d{2}-\d{2})/.exec(label);
    if (!date) throw new Error(`Horizons label ${JSON.stringify(label)} has no date`);
    return `horizons-${date[1]}`;
}

function writeContract(out: ExpectedMap, fixture: HorizonsFixture): void {
    putExact(out, 'meta.contract.tolerance.longitude', fixture.toleranceArcsec.longitude);
    putExact(out, 'meta.contract.tolerance.latitude', fixture.toleranceArcsec.latitude);
    putExact(out, 'meta.contract.futureTolerance.longitude', fixture.futureToleranceArcsec.longitude);
    putExact(out, 'meta.contract.futureTolerance.latitude', fixture.futureToleranceArcsec.latitude);
    putExact(out, 'meta.contract.lastObservedDeltaTYear', fixture.lastObservedDeltaTYear);
}

export function toHorizonsGoldenCases(fixture: HorizonsFixture): GoldenCase[] {
    const settings: SettingsDocument = { frame: 'tropical-of-date', positionMode: 'apparent' };
    const settingsHash = hashSettings(settings);
    return fixture.epochs.map((epoch) => {
        const expected: ExpectedMap = {};
        putExact(expected, 'meta.epoch.label', epoch.label);
        epoch.bodies.forEach((body, index) => {
            putExact(expected, `meta.epoch.bodies[${index}]`, body.name);
        });
        writeClock(expected, 'meta.birth.utc', epoch.utc);
        putExact(expected, 'time.jd', epoch.jd);
        writeContract(expected, fixture);
        const tolerance = epoch.utc.year > fixture.lastObservedDeltaTYear
            ? fixture.futureToleranceArcsec
            : fixture.toleranceArcsec;
        for (const body of epoch.bodies) {
            putArcsec(expected, `horizons.planets.${body.name}.lon`, body.lon, tolerance.longitude);
            putArcsec(expected, `horizons.planets.${body.name}.lat`, body.lat, tolerance.latitude);
        }
        return finish({
            id: horizonsId(epoch.label),
            provenance: { source: 'horizons', ...LEGACY_PROVENANCE },
            input: {
                instant: utcInstant(epoch.utc),
                timezone: 'UTC',
                lat: 0,
                lon: 0,
                alt: LEGACY_ALTITUDE_M,
                settingsPresetId: HORIZONS_PRESET_ID,
                settingsHash,
            },
            settings,
            expected,
        });
    });
}

export function fromHorizonsGoldenCases(cases: readonly GoldenCase[]): HorizonsFixture {
    const first = cases[0];
    if (!first) throw new Error('Horizons corpus is empty');
    const contract = readContract(first.expected);
    const epochs = cases.map((golden) => {
        const same = JSON.stringify(readContract(golden.expected)) === JSON.stringify(contract);
        if (!same) throw new Error(`${golden.id} contract does not match ${first.id}`);
        return {
            label: exactValue<string>(golden.expected, 'meta.epoch.label'),
            jd: exactValue<number>(golden.expected, 'time.jd'),
            utc: clockOf(golden.expected, 'meta.birth.utc'),
            bodies: indexedNames(golden.expected, 'meta.epoch.bodies').map((name) => {
                const lon = requireEntry(golden.expected, `horizons.planets.${name}.lon`);
                const lat = requireEntry(golden.expected, `horizons.planets.${name}.lat`);
                if (lon.tolerance.type !== 'arcsec' || lat.tolerance.type !== 'arcsec') {
                    throw new Error(`${name} angle tolerance must be arcsec`);
                }
                if (typeof lon.value !== 'number' || typeof lat.value !== 'number') {
                    throw new Error(`${name} angle must be numeric`);
                }
                return { name, lon: lon.value, lat: lat.value };
            }),
        };
    });
    return { epochs, ...contract };
}

function indexedNames(expected: ExpectedMap, prefix: string): string[] {
    const names: string[] = [];
    for (let index = 0; `${prefix}[${index}]` in expected; index += 1) {
        names.push(exactValue(expected, `${prefix}[${index}]`));
    }
    return names;
}

function readContract(expected: ExpectedMap): Pick<HorizonsFixture, 'toleranceArcsec' | 'futureToleranceArcsec' | 'lastObservedDeltaTYear'> {
    return {
        toleranceArcsec: {
            longitude: exactValue(expected, 'meta.contract.tolerance.longitude'),
            latitude: exactValue(expected, 'meta.contract.tolerance.latitude'),
        },
        futureToleranceArcsec: {
            longitude: exactValue(expected, 'meta.contract.futureTolerance.longitude'),
            latitude: exactValue(expected, 'meta.contract.futureTolerance.latitude'),
        },
        lastObservedDeltaTYear: exactValue(expected, 'meta.contract.lastObservedDeltaTYear'),
    };
}
