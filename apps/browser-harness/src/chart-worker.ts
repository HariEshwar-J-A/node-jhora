import * as Comlink from 'comlink';

type WorkerApi = typeof import('@node-jhora/engine/browser/worker-api');

let apiPromise: Promise<WorkerApi> | undefined;

function loadApi(): Promise<WorkerApi> {
    if (!apiPromise) {
        const url = '/pkg/engine/browser/worker-api.js';
        apiPromise = import(/* @vite-ignore */ url) as Promise<WorkerApi>;
    }
    return apiPromise;
}

async function initWorker(ephemerisUrl?: string) {
    return (await loadApi()).initWorker(ephemerisUrl);
}

async function collectInWorker(req: Parameters<WorkerApi['collectInWorker']>[0]) {
    return (await loadApi()).collectInWorker(req);
}

async function collectOffline(req: Parameters<WorkerApi['collectOffline']>[0]) {
    return (await loadApi()).collectOffline(req);
}

Comlink.expose({ initWorker, collectInWorker, collectOffline });
