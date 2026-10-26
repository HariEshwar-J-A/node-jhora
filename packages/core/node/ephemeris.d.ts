import type { ChunkKey, EphemerisChunkLoader, EphemerisEngine } from '../dist/index.js';

export interface PinnedFile {
    readonly file: string;
    readonly bytes: number;
    readonly sha256: string;
}

export const DE440S_FILE: PinnedFile & { readonly urls: readonly string[] };

export interface ResolveDe440sOptions {
    /** Cache root; defaults to {@link defaultCacheDir}. */
    cacheDir?: string;
    /** Never download; defaults to NODE_JHORA_OFFLINE. */
    offline?: boolean;
    /** Download mirrors tried in order; defaults to the JPL SSD URLs. */
    urls?: readonly string[];
    fetchImpl?: typeof fetch;
}

export function defaultCacheDir(): string;
export function sha256File(path: string): string;
export function sha256Bytes(bytes: Uint8Array): string;
export function verifyFile(path: string, entry: PinnedFile, options?: { full?: boolean }): void;
export function writeVerified(
    dest: string,
    bytes: Uint8Array,
    entry: PinnedFile,
    source: string,
): void;
export function de440sCachePath(cacheDir?: string): string;
export function findLocalDe440s(options?: {
    cacheDir?: string;
}): { path: string; tier: 'env' | 'package' | 'cache' } | undefined;
export function downloadDe440s(
    options?: Omit<ResolveDe440sOptions, 'offline'> & { log?: (message: string) => void },
): Promise<string>;
export function resolveDe440sPath(options?: ResolveDe440sOptions): Promise<string>;

export interface NodeChunkLoaderOptions {
    /** Extra directories holding g{G}-c{C}.njce files (checked first). */
    dirs?: readonly string[];
    cacheDir?: string;
    /** Self-hosted directory URL holding the chunk files. */
    baseUrl?: string;
    /** Remote URL per chunk; overrides baseUrl. */
    urlFor?: (key: ChunkKey) => string;
    /** Fetch from jsDelivr's copy of the published data packages. */
    cdn?: boolean;
    offline?: boolean;
    fetchImpl?: typeof fetch;
}

export function njceCacheDir(cacheDir: string | undefined, version: string): string;
export function createNodeChunkLoader(
    options?: NodeChunkLoaderOptions,
): Promise<EphemerisChunkLoader>;
export function centuriesForYears(fromYear: number, toYear: number): number[];
export function prefetchChunks(
    options: NodeChunkLoaderOptions & { fromYear: number; toYear: number },
): Promise<Array<{ century: number; groupId: number; ok: boolean; bytes: number; error?: string }>>;
export function registerNodeChunkStore(
    engine: Pick<EphemerisEngine, 'setChunkStore'>,
    options?: NodeChunkLoaderOptions,
): Promise<void>;
