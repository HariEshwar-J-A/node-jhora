import * as Comlink from 'comlink';
import { KPEngine } from '@node-jhora/analytics';
import {
    computeRiseSetTable,
    calculateVarga,
    EphemerisEngine,
} from '@node-jhora/core';
import { DE440S_BYTES, DE440S_SHA256, ensureEphemerisBytes, resetSpkCache } from '@node-jhora/core/browser';
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
import type { BirthInput, InitProgress } from '../lib/worker-types';

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
        throw new Error(`de440s.bsp size mismatch: expected ${DE440S_BYTES}, got ${out.byteLength}`);
    }
    return out;
}

async function ensureEngine(url: string): Promise<EphemerisEngine> {
    if (booted && engine && ephemerisUrl === url) return engine;
    ephemerisUrl = url;
    setProgress({ phase: 'checking-cache' });
    try {
        let bytes: Uint8Array;
        try {
            bytes = await ensureEphemerisBytes({ urls: [url], offlineOnly: true });
            setProgress({
                phase: 'ready',
                loadedBytes: bytes.byteLength,
                totalBytes: bytes.byteLength,
            });
        } catch {
            setProgress({ phase: 'downloading', loadedBytes: 0, totalBytes: DE440S_BYTES });
            bytes = await fetchKernelWithProgress(url);
            await ensureEphemerisBytes({ urls: [url] });
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
        const instant = DateTime.fromISO(input.instantIso, { zone: 'utc' });
        const birthLocal = instant.setZone(input.timezone);

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
        if (input.customVarga && !divisions.includes(input.customVarga as (typeof divisions)[number])) {
            divisions.push(input.customVarga);
        }
        const sessionDivs = new Set([1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]);
        for (const div of divisions) {
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
        const sunRiseSet = computeRiseSetTable(eph, 0, jdStart, {
            latitude: input.latitude,
            longitude: input.longitude,
        });

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

        const kp = {
            planets: KPEngine.getAllPlanetSignificators(planetPositions),
            houses: snapshot.houses
                ? KPEngine.getAllHouseSignificators({
                      ascendant: snapshot.houses.ascendant,
                      mc: snapshot.houses.mc,
                      cusps: snapshot.houses.cusps,
                      system: snapshot.houses.system,
                  })
                : [],
        };

        const transitEngine = new TransitEngine(eph);
        const scanEnd = birthLocal.plus({ days: 30 });
        const mercuryTransits = transitEngine.findTransits(2, birthLocal, scanEnd, 6);
        const scanner = new TransitScanner(eph);
        const marsIngress = await scanner.findIngress(4, 0, birthLocal, scanEnd);

        const boyStar = nakshatraIndex(moonLon);
        const boySign = sign1(moonLon);
        const girlStar = (boyStar + 5) % 27;
        const girlSign = ((boySign + 3 - 1) % 12) + 1;
        const matching = {
            ashtaKuta: calculateAshtaKuta(boyStar, girlStar, boySign, girlSign),
            dashaKuta: calculateDashaKuta(boyStar, girlStar, boySign, girlSign),
            porutham: PoruthamMatch.match(boyStar, girlStar, boySign, girlSign),
            mangalDosha: snapshot.houses
                ? checkMangalDosha(
                      { planets: planetPositions, houses: snapshot.houses },
                      { planets: planetPositions, houses: snapshot.houses },
                  )
                : null,
            sampleNote:
                'Demonstration scores only: girl chart uses offset nakshatra/sign, not a second birth time.',
        };

        return {
            snapshot,
            extraVargas,
            sunRiseSet,
            karakas,
            dashas,
            kp,
            transits: { mercuryTransits, marsIngress },
            matching,
            kernelMeta: { sha256: DE440S_SHA256, bytes: DE440S_BYTES },
        };
    },

    parseJhdText(text: string) {
        return parseJhd(text);
    },
    writeJhdText(chart: Parameters<typeof writeJhd>[0]) {
        return writeJhd(chart);
    },
    parseNjhText(text: string) {
        return parseNjh(text);
    },
    serializeNjhText(doc: Parameters<typeof serializeNjh>[0]) {
        return serializeNjh(doc);
    },
};

export type AppWorkerApi = typeof api;

Comlink.expose(api);
