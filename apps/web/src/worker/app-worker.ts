import * as Comlink from 'comlink';
import { KPEngine } from '@node-jhora/analytics';
import { computeRiseSetTable, calculateVarga, EphemerisEngine } from '@node-jhora/core';
import {
    DE440S_BYTES,
    DE440S_SHA256,
    ensureEphemerisBytes,
    resetSpkCache,
} from '@node-jhora/core/browser';
import { ChartSession } from '@node-jhora/engine';
import { TransitScanner } from '@node-jhora/events';
import { parseNjh, serializeNjh } from '@node-jhora/format';
import { parseJhd, writeJhd } from '@node-jhora/format/jhd';
import {
    calculateAshtaKuta,
    calculateDashaKuta,
    checkMangalDosha,
    PoruthamMatch,
} from '@node-jhora/match';
import {
    DrigDasha,
    generateAshtottari,
    generateChaturashitiSama,
    generateDwadashottari,
    generateDwisaptatiSama,
    generatePanchottari,
    generateShashtiHayani,
    generateShatabdika,
    generateShodashottari,
    generateTithiAshtottari,
    generateVimshottari,
    JaiminiCore,
    JaiminiDashas,
    KalachakraDasha,
    MoolaDasha,
    NarayanaDasha,
    PatyayiniDasha,
    SudasaDasha,
    TransitEngine,
    YoginiDasha,
} from '@node-jhora/prediction';
import { DateTime } from 'luxon';

import { NAMED_VARGA_DIVISIONS } from '../lib/constants';
import { formatRiseSetOutcome } from '../lib/rise-set-display';
import type { BirthInput, InitProgress } from '../lib/worker-types';
import { resolveTimezone } from '../lib/format';
import { toWorkerPlain } from '../lib/serialize-worker';

let engine: EphemerisEngine | undefined;
let booted = false;
let ephemerisUrl = '';
let progress: InitProgress = { phase: 'checking-cache' };

function setProgress(p: InitProgress) {
    progress = p;
}

export function getInitProgress(): InitProgress {
    return progress;
}

async function fetchKernelWithProgress(url: string): Promise<Uint8Array> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ephemeris`);
    const total = Number(res.headers.get('content-length')) || DE440S_BYTES;
    if (!res.body) {
        const buf = new Uint8Array(await res.arrayBuffer());
        setProgress({ phase: 'ready', loadedBytes: buf.byteLength, totalBytes: total });
        return buf;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    setProgress({ phase: 'downloading', loadedBytes: 0, totalBytes: total });
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        setProgress({ phase: 'downloading', loadedBytes: loaded, totalBytes: total });
    }
    const out = new Uint8Array(loaded);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
    }
    if (out.byteLength !== DE440S_BYTES) {
        throw new Error(
            `de440s.bsp size mismatch: expected ${DE440S_BYTES}, got ${out.byteLength}`,
        );
    }
    return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
        ),
    ]);
}

async function ensureEngine(url: string): Promise<EphemerisEngine> {
    if (booted && engine && ephemerisUrl === url) return engine;
    ephemerisUrl = url;
    setProgress({ phase: 'checking-cache' });
    try {
        let bytes: Uint8Array;
        try {
            bytes = await withTimeout(
                ensureEphemerisBytes({ urls: [url], offlineOnly: true }),
                12_000,
                'Reading cached ephemeris',
            );
            setProgress({
                phase: 'ready',
                loadedBytes: bytes.byteLength,
                totalBytes: bytes.byteLength,
            });
        } catch {
            setProgress({ phase: 'downloading', loadedBytes: 0, totalBytes: DE440S_BYTES });
            bytes = await withTimeout(
                fetchKernelWithProgress(url),
                120_000,
                'Downloading ephemeris',
            );
            try {
                await withTimeout(
                    ensureEphemerisBytes({ urls: [url] }),
                    15_000,
                    'Persisting ephemeris cache',
                );
            } catch {
                /* init proceeds with in-memory bytes even if persist fails */
            }
            setProgress({
                phase: 'ready',
                loadedBytes: bytes.byteLength,
                totalBytes: bytes.byteLength,
            });
        }
        engine = EphemerisEngine.getInstance();
        await engine.initialize({ kernel: bytes });
        booted = true;
        return engine;
    } catch (err) {
        setProgress({ phase: 'error', message: String(err) });
        booted = false;
        engine = undefined;
        throw err;
    }
}

function nakshatraIndex(moonLon: number): number {
    return Math.floor((((moonLon % 360) + 360) % 360) / (360 / 27));
}

function sign1(lon: number): number {
    return Math.floor((((lon % 360) + 360) % 360) / 30) + 1;
}

const api = {
    getInitProgress,

    async init(url: string) {
        resetSpkCache();
        booted = false;
        engine = undefined;
        await ensureEngine(url);
        return getInitProgress();
    },

    async computeFull(input: BirthInput) {
        const eph = await ensureEngine(input.ephemerisUrl);
        const tz = resolveTimezone(input.timezone);
        if (!tz.ok) {
            throw new Error(tz.message);
        }
        const instant = DateTime.fromISO(input.instantIso, { zone: 'utc' });
        const birthLocal = instant.setZone(tz.zone);

        const session = new ChartSession({
            instant,
            location: {
                latitude: input.latitude,
                longitude: input.longitude,
                altitude: input.altitude,
            },
            settings: input.settings,
            ephemeris: eph,
            houseSystemOverride: input.houseSystem,
            dasha: { depth: Math.min(input.dashaDepth ?? 3, 5) },
        });

        const snapshot = await session.collect([
            'planets',
            'houses',
            'panchanga',
            'vargas',
            'dasha',
            'shadbala',
            'yogas',
            'ashtakavarga',
        ]);

        const planets = snapshot.planets ?? [];
        const moon = planets.find((p) => p.name === 'Moon');
        const sun = planets.find((p) => p.name === 'Sun');
        const asc = snapshot.houses?.ascendant ?? 0;
        const moonLon = moon?.longitude ?? 0;
        const sunLon = sun?.longitude ?? 0;

        const extraVargas: { division: number; points: unknown[] }[] = [];
        const divisions = [...NAMED_VARGA_DIVISIONS];
        const vargaDivisors: number[] = [...divisions];
        if (input.customVarga && !vargaDivisors.includes(input.customVarga)) {
            vargaDivisors.push(input.customVarga);
        }
        const sessionDivs = new Set([1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]);
        for (const div of vargaDivisors) {
            if (sessionDivs.has(div)) continue;
            extraVargas.push({
                division: div,
                points: planets.map((p) => ({
                    planet: p.name,
                    ...calculateVarga(p.longitude, div),
                })),
            });
        }

        const jdStart = instant.toUTC().toMillis() / 86400000 + 2440587.5;
        const riseSetTable = computeRiseSetTable(eph, 0, jdStart, {
            latitude: input.latitude,
            longitude: input.longitude,
        });
        const sunRiseSet = {
            rise: formatRiseSetOutcome(riseSetTable.rise, tz.zone),
            set: formatRiseSetOutcome(riseSetTable.set, tz.zone),
        };

        const planetPositions = planets.map((p) => ({
            id: p.id,
            name: p.name,
            longitude: p.longitude,
            latitude: p.latitude,
            speed: p.speed,
            distance: p.distance,
            declination: p.declination,
        }));

        const karakas = JaiminiCore.calculateCharaKarakas(planetPositions);
        const lagnaSign = Math.floor(asc / 30);
        const charaDasha = JaiminiDashas.calculateCharaDasha(lagnaSign, planetPositions);

        const chartForRasi = {
            ascendant: asc,
            planets: planetPositions,
            cusps: snapshot.houses?.cusps ?? [],
        };

        const dashaDepth = Math.min(input.dashaDepth ?? 3, 5);
        const dashas = {
            vimshottari: generateVimshottari(birthLocal, moonLon, dashaDepth),
            yogini: YoginiDasha.calculate(moonLon, birthLocal),
            kalachakra: KalachakraDasha.calculate(birthLocal, moonLon, 2),
            ashtottari: generateAshtottari(birthLocal, moonLon, 2),
            shodashottari: generateShodashottari(birthLocal, moonLon, 2),
            dwadashottari: generateDwadashottari(birthLocal, moonLon, 2),
            panchottari: generatePanchottari(birthLocal, moonLon, 2),
            shatabdika: generateShatabdika(birthLocal, moonLon, 2),
            chaturashiti: generateChaturashitiSama(birthLocal, moonLon, 2),
            dwisaptati: generateDwisaptatiSama(birthLocal, moonLon, 2),
            shashtihayani: generateShashtiHayani(birthLocal, moonLon, 2),
            tithiAshtottari: generateTithiAshtottari(birthLocal, moonLon, sunLon, 2),
            narayana: NarayanaDasha.calculate(chartForRasi, birthLocal, 12),
            drig: DrigDasha.calculate(chartForRasi, birthLocal, 1),
            sudasa: SudasaDasha.calculate(chartForRasi, birthLocal, moonLon, 1),
            moola: MoolaDasha.calculate(chartForRasi, birthLocal),
            patyayini: PatyayiniDasha.calculate(chartForRasi, birthLocal),
            chara: charaDasha,
        };

        const housesForMatch = snapshot.houses
            ? {
                  ascendant: snapshot.houses.ascendant,
                  mc: snapshot.houses.mc,
                  cusps: snapshot.houses.cusps,
                  armc: snapshot.houses.armc ?? snapshot.houses.mc,
                  vertex: snapshot.houses.vertex ?? snapshot.houses.ascendant,
              }
            : undefined;

        const kp = {
            planets: KPEngine.getAllPlanetSignificators(planetPositions),
            houses: housesForMatch ? KPEngine.getAllHouseSignificators(housesForMatch) : [],
        };

        const transitEngine = new TransitEngine(eph);
        const scanEnd = birthLocal.plus({ days: 30 });
        const mercuryRaw = await transitEngine.findTransits(2, birthLocal, scanEnd, 6);
        const mercuryTransits = mercuryRaw.map((e) => ({
            planetId: e.planetId,
            type: e.type,
            prevSign: e.prevValue,
            newSign: e.newValue,
            instant: e.time.toUTC().toISO(),
        }));
        const scanner = new TransitScanner(eph);
        const marsIngress = await scanner.findIngress(4, 0, birthLocal, scanEnd);
        const transits = {
            mercuryTransits,
            marsIngress: marsIngress
                ? {
                      planetId: 4,
                      targetSign: 0,
                      instant: marsIngress.toUTC().toISO(),
                  }
                : null,
        };

        const boyStar = nakshatraIndex(moonLon);
        const boySign = sign1(moonLon);
        const girlStar = (boyStar + 5) % 27;
        const girlSign = ((boySign + 3 - 1) % 12) + 1;
        const matching = {
            ashtaKuta: calculateAshtaKuta(boyStar, girlStar, boySign, girlSign),
            dashaKuta: calculateDashaKuta(boyStar, girlStar, boySign, girlSign),
            porutham: PoruthamMatch.match(boyStar, girlStar, boySign, girlSign),
            mangalDosha: housesForMatch
                ? checkMangalDosha(
                      { planets: planetPositions, houses: housesForMatch },
                      { planets: planetPositions, houses: housesForMatch },
                  )
                : null,
            sampleNote:
                'Demonstration scores only: girl chart uses offset nakshatra/sign, not a second birth time.',
        };

        return toWorkerPlain({
            snapshot,
            extraVargas,
            sunRiseSet,
            karakas,
            dashas,
            kp,
            transits,
            matching,
            kernelMeta: { sha256: DE440S_SHA256, bytes: DE440S_BYTES },
            meta: { resolvedZone: tz.zone, localIso: birthLocal.toISO() },
        });
    },

    parseJhdText(text: string) {
        return toWorkerPlain(parseJhd(text));
    },
    writeJhdText(chart: Parameters<typeof writeJhd>[0]) {
        return writeJhd(chart);
    },
    parseNjhText(text: string) {
        return toWorkerPlain(parseNjh(text));
    },
    serializeNjhText(doc: Parameters<typeof serializeNjh>[0]) {
        return serializeNjh(doc);
    },
};

export type AppWorkerApi = typeof api;

Comlink.expose(api);
