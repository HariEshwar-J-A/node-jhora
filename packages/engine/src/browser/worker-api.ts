// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import type { SettingsInput } from '@node-jhora/core/browser';
import { ensureEphemerisBytes, EphemerisEngine, resetSpkCache } from '@node-jhora/core/browser';
import { DateTime } from 'luxon';

import { ChartSession } from '../chart-session.js';
import type { ChartSectionId, ChartSectionsSnapshot } from '../types.js';

export interface WorkerCollectRequest {
    instant: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    settings: SettingsInput;
    include: readonly ChartSectionId[];
    ephemerisUrl?: string;
}

let engine: EphemerisEngine | undefined;
let booted = false;

async function ensureEngine(ephemerisUrl?: string): Promise<EphemerisEngine> {
    if (!booted) {
        const bytes = await ensureEphemerisBytes({
            urls: ephemerisUrl ? [ephemerisUrl] : undefined,
        });
        engine = EphemerisEngine.getInstance();
        await engine.initialize({ kernel: bytes });
        booted = true;
    }
    return engine!;
}

export async function initWorker(ephemerisUrl?: string): Promise<void> {
    await ensureEngine(ephemerisUrl);
}

export async function collectInWorker(req: WorkerCollectRequest): Promise<ChartSectionsSnapshot> {
    const eph = await ensureEngine(req.ephemerisUrl);
    const session = new ChartSession({
        instant: DateTime.fromISO(req.instant, { zone: 'utc' }),
        location: {
            latitude: req.latitude,
            longitude: req.longitude,
            altitude: req.altitude,
        },
        settings: req.settings,
        ephemeris: eph,
    });
    return session.collect(req.include);
}

/** Offline reload: kernel must already be in IndexedDB / Cache API. */
export async function collectOffline(
    req: Omit<WorkerCollectRequest, 'ephemerisUrl'>,
): Promise<ChartSectionsSnapshot> {
    booted = false;
    engine = undefined;
    resetSpkCache();
    const bytes = await ensureEphemerisBytes({ offlineOnly: true });
    engine = new EphemerisEngine();
    await engine.initialize({ kernel: bytes });
    booted = true;
    const session = new ChartSession({
        instant: DateTime.fromISO(req.instant, { zone: 'utc' }),
        location: {
            latitude: req.latitude,
            longitude: req.longitude,
            altitude: req.altitude,
        },
        settings: req.settings,
        ephemeris: engine,
    });
    return session.collect(req.include);
}
