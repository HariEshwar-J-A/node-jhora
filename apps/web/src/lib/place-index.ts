import type { GazetteerManifest, PlaceHit } from '@node-jhora/atlas';
import { normalizeSearchKey, shardIdForKey } from '@node-jhora/atlas';
import type { PlaceWorkerRequest, PlaceWorkerResponse } from '../worker/place-worker';
import PlaceWorker from '../worker/place-worker?worker';

const PREFETCH_DELAY_MS = 800;

type ProgressFn = (percent: number) => void;
type Priority = 'high' | 'low';
type WorkerCall = PlaceWorkerRequest extends infer T
    ? T extends unknown
        ? Omit<T, 'id'>
        : never
    : never;

type ShardJob = {
    promise: Promise<{ buffer: ArrayBuffer; fromCache: boolean }>;
    listeners: Set<ProgressFn>;
    phase: 'probe' | 'network' | 'cache';
    percent: number;
    users: number;
};

let manifest: GazetteerManifest | null = null;
let manifestTask: Promise<GazetteerManifest> | null = null;
const manifestListeners = new Set<ProgressFn>();
let shardCache: Cache | null = null;
let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, (response: PlaceWorkerResponse) => void>();
const jobs = new Map<string, ShardJob>();
const ingested = new Set<string>();
const ingesting = new Map<string, Promise<void>>();
let urgent = 0;
let prefetchScheduled = false;

export function manifestUrl(): string {
    return new URL(`${import.meta.env.BASE_URL}atlas/manifest.json`, window.location.origin).href;
}

function emitManifest(percent: number): void {
    for (const listener of manifestListeners) listener(percent);
}

async function openShardCache(builtAt: string): Promise<void> {
    if (typeof caches === 'undefined') return;
    const name = `node-jhora-atlas-${builtAt}`;
    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter((key) => key.startsWith('node-jhora-atlas-') && key !== name)
            .map((key) => caches.delete(key)),
    );
    shardCache = await caches.open(name);
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
}

function readStream(
    response: Response,
    expected: number | undefined,
    onProgress: ProgressFn | null,
): Promise<Uint8Array> {
    const header = Number(response.headers.get('content-length'));
    const total =
        expected && expected > 0 ? expected : Number.isFinite(header) && header > 0 ? header : 0;
    const reader = response.body?.getReader();
    if (!reader) return Promise.reject(new Error('Place index response has no body'));
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    onProgress?.(0);
    const pump = async (): Promise<Uint8Array> => {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            chunks.push(value);
            loaded += value.byteLength;
            const denom = total > 0 ? total : loaded;
            onProgress?.(Math.max(0, Math.min(100, Math.round((100 * loaded) / denom))));
        }
        const bytes = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        onProgress?.(100);
        return bytes;
    };
    return pump();
}

export function loadManifest(onProgress?: ProgressFn): Promise<GazetteerManifest> {
    if (manifest) return Promise.resolve(manifest);
    if (onProgress) manifestListeners.add(onProgress);
    if (!manifestTask) {
        manifestTask = (async () => {
            const response = await fetch(manifestUrl(), { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Place index manifest HTTP ${response.status}`);
            }
            const bytes = await readStream(response, undefined, (percent) => emitManifest(percent));
            const parsed = JSON.parse(new TextDecoder().decode(bytes)) as GazetteerManifest;
            manifest = parsed;
            await openShardCache(parsed.builtAt);
            return parsed;
        })().catch((err: unknown) => {
            manifestTask = null;
            throw err;
        });
    }
    return manifestTask.finally(() => {
        if (onProgress) manifestListeners.delete(onProgress);
    });
}

function shardUrl(shardId: string): string {
    if (!manifest) throw new Error('Place index manifest is not loaded');
    const relative = manifest.indexShards[shardId];
    if (!relative) throw new Error(`Unknown place shard ${shardId}`);
    return new URL(relative, manifestUrl()).href;
}

function notify(job: ShardJob, percent: number): void {
    job.percent = percent;
    if (job.phase !== 'network') return;
    for (const listener of job.listeners) listener(percent);
}

function listen(job: ShardJob, onProgress?: ProgressFn): void {
    if (!onProgress || job.phase === 'cache') return;
    job.listeners.add(onProgress);
    if (job.phase === 'network') onProgress(job.percent);
}

function beginLoad(shardId: string, priority: Priority): ShardJob {
    const existing = jobs.get(shardId);
    if (existing) {
        existing.users += 1;
        return existing;
    }
    let resolveJob: (result: { buffer: ArrayBuffer; fromCache: boolean }) => void = () => {};
    let rejectJob: (err: unknown) => void = () => {};
    const promise = new Promise<{ buffer: ArrayBuffer; fromCache: boolean }>((resolve, reject) => {
        resolveJob = resolve;
        rejectJob = reject;
    });
    const job: ShardJob = {
        promise,
        listeners: new Set(),
        phase: 'probe',
        percent: 0,
        users: 1,
    };
    jobs.set(shardId, job);
    void (async () => {
        try {
            const url = shardUrl(shardId);
            if (shardCache) {
                const hit = await shardCache.match(url);
                if (hit) {
                    job.phase = 'cache';
                    job.listeners.clear();
                    resolveJob({ buffer: await hit.arrayBuffer(), fromCache: true });
                    return;
                }
            }
            job.phase = 'network';
            const response = await fetch(url, {
                cache: 'no-store',
                priority,
            } as RequestInit);
            if (!response.ok) throw new Error(`Place shard ${shardId} HTTP ${response.status}`);
            const expected = manifest?.shardBytes?.[shardId];
            const bytes = await readStream(response, expected, (percent) => notify(job, percent));
            const buffer = exactBuffer(bytes);
            if (shardCache) {
                await shardCache.put(
                    url,
                    new Response(buffer.slice(0), {
                        headers: {
                            'Content-Type': 'application/octet-stream',
                            'Content-Length': String(buffer.byteLength),
                        },
                    }),
                );
            }
            resolveJob({ buffer, fromCache: false });
        } catch (err) {
            jobs.delete(shardId);
            rejectJob(err);
        }
    })();
    return job;
}

async function ensureBytes(
    shardId: string,
    priority: Priority,
    onProgress?: ProgressFn,
): Promise<{ buffer: ArrayBuffer; fromCache: boolean }> {
    if (priority === 'high') urgent += 1;
    const job = beginLoad(shardId, priority);
    listen(job, onProgress);
    try {
        const result = await job.promise;
        return { buffer: result.buffer.slice(0), fromCache: result.fromCache };
    } finally {
        job.listeners.delete(onProgress as ProgressFn);
        job.users -= 1;
        if (job.users <= 0) jobs.delete(shardId);
        if (priority === 'high') urgent -= 1;
    }
}

function placeWorker(): Worker {
    if (!worker) {
        worker = new PlaceWorker();
        worker.onmessage = (event: MessageEvent<PlaceWorkerResponse>) => {
            const resolve = pending.get(event.data.id);
            if (!resolve) return;
            pending.delete(event.data.id);
            resolve(event.data);
        };
    }
    return worker;
}

function call(message: WorkerCall): Promise<PlaceWorkerResponse> {
    const id = nextId++;
    const body = { ...message, id } as PlaceWorkerRequest;
    return new Promise((resolve) => {
        pending.set(id, resolve);
        if (body.type === 'ingest') placeWorker().postMessage(body, [body.bytes]);
        else placeWorker().postMessage(body);
    });
}

function ensureWorker(current: GazetteerManifest): Promise<void> {
    if (!workerReady) {
        workerReady = call({ type: 'open', manifest: current }).then((response) => {
            if (response.error) throw new Error(response.error);
        });
    }
    return workerReady;
}

async function ingest(shardId: string, buffer: ArrayBuffer): Promise<void> {
    if (ingested.has(shardId)) return;
    const existing = ingesting.get(shardId);
    if (existing) {
        await existing;
        return;
    }
    const task = (async () => {
        const response = await call({ type: 'ingest', shardId, bytes: buffer });
        if (response.error) throw new Error(response.error);
        ingested.add(shardId);
    })();
    ingesting.set(shardId, task);
    try {
        await task;
    } finally {
        ingesting.delete(shardId);
    }
}

async function prepareShard(
    shardId: string,
    onProgress: ProgressFn | undefined,
    priority: Priority,
): Promise<void> {
    if (ingested.has(shardId)) return;
    const { buffer } = await ensureBytes(shardId, priority, onProgress);
    await ingest(shardId, buffer);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

async function prefetchAll(): Promise<void> {
    const current = await loadManifest();
    for (const shardId of Object.keys(current.indexShards)) {
        while (urgent > 0) await delay(40);
        if (ingested.has(shardId)) continue;
        try {
            await ensureBytes(shardId, 'low');
        } catch {
            /* A failed background shard is fetched again on search. */
        }
    }
}

/** After the field is focused, pull the other shards at idle priority into the Cache API. */
export function schedulePrefetch(): void {
    if (prefetchScheduled) return;
    prefetchScheduled = true;
    window.setTimeout(() => {
        const start = () => {
            void prefetchAll();
        };
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(start, { timeout: 4000 });
        } else {
            start();
        }
    }, PREFETCH_DELAY_MS);
}

export async function searchPlaces(
    query: string,
    onProgress?: ProgressFn,
): Promise<{ hits: PlaceHit[]; error?: string }> {
    try {
        const current = await loadManifest(manifest ? undefined : onProgress);
        await ensureWorker(current);
        const prefix = normalizeSearchKey(query);
        if (prefix.length < 2) return { hits: [] };
        const shardId = shardIdForKey(prefix);
        if (current.indexShards[shardId]) {
            await prepareShard(shardId, onProgress, 'high');
        }
        const response = await call({ type: 'search', query });
        return { hits: response.hits ?? [], error: response.error };
    } catch (err) {
        return { hits: [], error: err instanceof Error ? err.message : String(err) };
    }
}
