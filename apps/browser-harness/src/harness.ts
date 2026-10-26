import * as Comlink from 'comlink';
import type { ChartSectionId } from '@node-jhora/engine/browser';
import type { ChartWorkerApi } from '@node-jhora/engine/browser';
import { encodeLosslessNumbers, decodeLosslessNumbers } from './parity-wire.js';
import { collectNumericDiffs } from './parity-diff.js';

const EPHE_URL = `${location.origin}/ephe/de440s.bsp`;

import ChartWorker from './chart-worker?worker';

const workerApi = Comlink.wrap<ChartWorkerApi>(new ChartWorker());

export type HarnessRequest = {
    instant: string;
    latitude: number;
    longitude: number;
    settings: 'node-jhora-default';
    include: ChartSectionId[];
    offline?: boolean;
};

export async function runHarness(req: HarnessRequest) {
    if (req.offline) {
        return workerApi.collectOffline({
            instant: req.instant,
            latitude: req.latitude,
            longitude: req.longitude,
            settings: req.settings,
            include: req.include,
        });
    }
    await workerApi.initWorker(EPHE_URL);
    return workerApi.collectInWorker({
        instant: req.instant,
        latitude: req.latitude,
        longitude: req.longitude,
        settings: req.settings,
        include: req.include,
        ephemerisUrl: EPHE_URL,
    });
}

declare global {
    interface Window {
        __njhRunHarness: typeof runHarness;
        __njhEncodeLossless: typeof encodeLosslessNumbers;
        __njhDecodeLossless: typeof decodeLosslessNumbers;
        __njhCollectNumericDiffs: typeof collectNumericDiffs;
    }
}

window.__njhRunHarness = runHarness;
window.__njhEncodeLossless = encodeLosslessNumbers;
window.__njhDecodeLossless = decodeLosslessNumbers;
window.__njhCollectNumericDiffs = collectNumericDiffs;

const status = document.getElementById('status');
if (status) status.textContent = 'ready';
