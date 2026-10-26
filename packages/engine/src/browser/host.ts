import * as Comlink from 'comlink';

import type { ChartSectionsSnapshot } from '../types.js';
import type { WorkerCollectRequest } from './worker-api.js';

export interface ChartWorkerApi {
    initWorker(ephemerisUrl?: string): Promise<void>;
    collectInWorker(req: WorkerCollectRequest): Promise<ChartSectionsSnapshot>;
    collectOffline(req: Omit<WorkerCollectRequest, 'ephemerisUrl'>): Promise<ChartSectionsSnapshot>;
}

export type ChartWorkerHandle = Comlink.Remote<ChartWorkerApi>;

function wrapPort(port: MessagePort): ChartWorkerHandle {
    port.start();
    return Comlink.wrap<ChartWorkerApi>(port);
}

/**
 * Spawn a SharedWorker when available, otherwise a dedicated Worker.
 * Pass a module URL (for example from `new URL('./worker-entry.js', import.meta.url)`).
 */
export function connectChartWorker(workerUrl: string | URL): ChartWorkerHandle {
    const url = typeof workerUrl === 'string' ? workerUrl : workerUrl.href;

    if (typeof SharedWorker !== 'undefined') {
        try {
            const shared = new SharedWorker(url, { type: 'module', name: 'node-jhora-chart' });
            return wrapPort(shared.port);
        } catch {
            // Fall through to dedicated Worker (Safari, file://, etc.).
        }
    }

    const dedicated = new Worker(url, { type: 'module' });
    return Comlink.wrap<ChartWorkerApi>(dedicated);
}

/** Wrap an already-instantiated dedicated worker (Vite `?worker` constructor). */
export function connectDedicatedWorker(worker: Worker): ChartWorkerHandle {
    return Comlink.wrap<ChartWorkerApi>(worker);
}
