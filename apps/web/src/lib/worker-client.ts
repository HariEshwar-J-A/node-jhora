import * as Comlink from 'comlink';
import type { InitProgress } from './worker-types';

import AppWorker from '../worker/app-worker?worker';

export type AppWorkerApi = Comlink.Remote<{
    getInitProgress: () => Promise<InitProgress>;
    init: (url: string) => Promise<InitProgress>;
    computeFull: (input: import('./worker-types').BirthInput) => Promise<unknown>;
    parseJhdText: (text: string) => Promise<unknown>;
    writeJhdText: (chart: unknown) => Promise<string>;
    parseNjhText: (text: string) => Promise<unknown>;
    serializeNjhText: (doc: unknown) => Promise<string>;
}>;

let worker: Comlink.Remote<AppWorkerApi> | undefined;
let progressPoll: ReturnType<typeof setInterval> | undefined;

export function getWorker(): Comlink.Remote<AppWorkerApi> {
    if (!worker) {
        worker = Comlink.wrap<AppWorkerApi>(new AppWorker());
    }
    return worker;
}

export async function initEphemeris(
    url: string,
    onProgress: (p: InitProgress) => void,
): Promise<void> {
    const w = getWorker();
    if (progressPoll) clearInterval(progressPoll);
    progressPoll = setInterval(async () => {
        onProgress(await w.getInitProgress());
    }, 200);
    try {
        await w.init(url);
        onProgress(await w.getInitProgress());
    } finally {
        if (progressPoll) clearInterval(progressPoll);
    }
}
