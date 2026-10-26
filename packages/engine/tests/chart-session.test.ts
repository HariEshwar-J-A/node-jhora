import { jest } from '@jest/globals';
import { DateTime } from 'luxon';
import {
    EphemerisEngine,
    SETTINGS_HASH_HEX_LENGTH,
    createResultEnvelope,
    calculateHouseCusps,
    calculatePanchanga,
    calculateVarga,
} from '@node-jhora/core';
import { ChartSession } from '../src/chart-session.js';
import { CHART_SECTION_IDS } from '../src/types.js';

const CHENNAI = {
    instant: DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' }),
    location: { latitude: 13.0827, longitude: 80.2707 },
    settings: 'node-jhora-default' as const,
};

describe('ChartSession', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
    }, 60_000);

    function session(overrides: Partial<ConstructorParameters<typeof ChartSession>[0]> = {}) {
        return new ChartSession({ ...CHENNAI, ephemeris: engine, ...overrides });
    }

    test('sections are structured-clone friendly', () => {
        const s = session();
        const slice = s.collect(['planets', 'panchanga']);
        const cloned = structuredClone(slice);
        expect(cloned.planets?.length).toBe(slice.planets?.length);
        expect(cloned.settingsHash).toBe(slice.settingsHash);
    });

    test('memoises planets across calls', () => {
        const s = session();
        const spy = jest.spyOn(engine, 'getPlanets');
        s.getPlanets();
        s.getPlanets();
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    test('houses alone does not load planets or panchanga', () => {
        const houseCusps = jest.fn(calculateHouseCusps);
        const panchanga = jest.fn(calculatePanchanga);
        const s = session({
            deps: { calculateHouseCusps: houseCusps, calculatePanchanga: panchanga },
        });
        const planetSpy = jest.spyOn(engine, 'getPlanets');

        s.getHouses();

        expect(planetSpy).not.toHaveBeenCalled();
        expect(houseCusps).toHaveBeenCalledTimes(1);
        expect(panchanga).not.toHaveBeenCalled();

        planetSpy.mockRestore();
    });

    test('panchanga alone does not compute houses or vargas', () => {
        const houseCusps = jest.fn(calculateHouseCusps);
        const varga = jest.fn(calculateVarga);
        const s = session({
            deps: { calculateHouseCusps: houseCusps, calculateVarga: varga },
        });

        s.getPanchanga();

        expect(houseCusps).not.toHaveBeenCalled();
        expect(varga).not.toHaveBeenCalled();
    });

    test('collect runs only requested sections', () => {
        const houseCusps = jest.fn(calculateHouseCusps);
        const panchanga = jest.fn(calculatePanchanga);
        const s = session({
            deps: { calculateHouseCusps: houseCusps, calculatePanchanga: panchanga },
        });

        s.collect(['planets']);

        expect(panchanga).not.toHaveBeenCalled();
        expect(houseCusps).not.toHaveBeenCalled();
    });

    test('settings hash is stable for the same settings input', () => {
        const a = session();
        const b = session();
        expect(a.settingsHash).toBe(b.settingsHash);
        expect(a.settingsHash).toHaveLength(SETTINGS_HASH_HEX_LENGTH);
    });

    test.each(CHART_SECTION_IDS)('%s survives structuredClone unchanged', id => {
        const section = session().getSection(id);
        expect(section).toBeDefined();
        expect(structuredClone(section)).toEqual(section);
    });

    test.each(CHART_SECTION_IDS)('%s is memoised (same object on repeat calls)', id => {
        const s = session();
        expect(s.getSection(id)).toBe(s.getSection(id));
    });

    test('full snapshot survives structuredClone and JSON round-trip', () => {
        const snap = session().toJSON();
        expect(structuredClone(snap)).toEqual(snap);
        expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });

    test('collect attaches the core result envelope without computedAt', () => {
        const s = session();
        const snap = s.collect(['planets']);
        const envelope = createResultEnvelope({ settingsHash: s.settingsHash });
        expect(snap).toMatchObject(envelope);
        expect(snap).not.toHaveProperty('computedAt');
        expect(snap.houses).toBeUndefined();
    });
});
