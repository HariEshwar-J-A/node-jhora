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
let rawWorker: Worker | undefined;
let progressPoll: ReturnType<typeof setInterval> | undefined;

const INIT_TIMEOUT_MS = 90_000;
const MAX_INIT_ATTEMPTS = 3;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

export function resetWorker(): void {
    if (progressPoll) {
        clearInterval(progressPoll);
        progressPoll = undefined;
    }
    rawWorker?.terminate();
    rawWorker = undefined;
    worker = undefined;
}

export function getWorker(): Comlink.Remote<AppWorkerApi> {
    if (!worker) {
        rawWorker = new AppWorker();
        worker = Comlink.wrap<AppWorkerApi>(rawWorker);
    }
    return worker;
}

function startProgressPoll(onProgress: (p: InitProgress) => void, w: Comlink.Remote<AppWorkerApi>) {
    if (progressPoll) clearInterval(progressPoll);
    progressPoll = setInterval(() => {
        void w
            .getInitProgress()
            .then(onProgress)
            .catch(() => {});
    }, 150);
}

export async function initEphemeris(
    url: string,
    onProgress: (p: InitProgress) => void,
): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt++) {
        if (attempt > 1) {
            resetWorker();
            await sleep(400 * attempt);
        }
        const w = getWorker();
        startProgressPoll(onProgress, w);
        onProgress({ phase: 'checking-cache', message: `Attempt ${attempt}/${MAX_INIT_ATTEMPTS}` });
        try {
            const initPromise = w.init(url);
            const result = await Promise.race([
                initPromise,
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    `Ephemeris init timed out after ${INIT_TIMEOUT_MS / 1000}s`,
                                ),
                            ),
                        INIT_TIMEOUT_MS,
                    ),
                ),
            ]);
            onProgress(result);
            const final = await w.getInitProgress();
            onProgress(final);
            if (final.phase === 'error') {
                throw new Error(final.message ?? 'Ephemeris init failed');
            }
            if (final.phase !== 'ready') {
                throw new Error(`Ephemeris init ended in phase ${final.phase}`);
            }
            return;
        } catch (err) {
            lastErr = err;
            onProgress({
                phase: 'error',
                message: String(err instanceof Error ? err.message : err),
            });
        } finally {
            if (progressPoll) {
                clearInterval(progressPoll);
                progressPoll = undefined;
            }
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
