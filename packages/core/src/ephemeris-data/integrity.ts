/**
 * Byte-level integrity checks against the ephemeris manifest.
 */

import type { ChunkKey, EphemerisChunkLoader } from '../engine/provider/chunk-loader.js';
import { sha256Hex } from '../settings/sha256.js';
import { type EphemerisFileEntry, njceChunkEntry } from './manifest.js';

export class EphemerisIntegrityError extends Error {
    constructor(
        message: string,
        readonly file: string,
        readonly source?: string,
    ) {
        super(message);
        this.name = 'EphemerisIntegrityError';
    }
}

function toHex(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let out = '';
    for (const b of bytes) out += b.toString(16).padStart(2, '0');
    return out;
}

/** SHA-256 hex digest; WebCrypto when present (Node >= 20, browsers), pure JS otherwise. */
export async function sha256HexAsync(bytes: Uint8Array): Promise<string> {
    const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
    if (subtle) {
        const view =
            bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
                ? bytes
                : bytes.slice();
        return toHex(await subtle.digest('SHA-256', view as Uint8Array<ArrayBuffer>));
    }
    return sha256Hex(bytes);
}

/** Throw unless `bytes` has the entry's exact length and SHA-256 (sync digest). */
export function verifyEphemerisBytesSync(
    entry: EphemerisFileEntry,
    bytes: Uint8Array | ArrayBuffer,
    source?: string,
): void {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const from = source ? ` from ${source}` : '';
    if (view.byteLength !== entry.bytes) {
        throw new EphemerisIntegrityError(
            `${entry.file}${from}: expected ${entry.bytes} bytes, got ${view.byteLength}`,
            entry.file,
            source,
        );
    }
    const digest = sha256Hex(view);
    if (digest !== entry.sha256) {
        throw new EphemerisIntegrityError(
            `${entry.file}${from}: SHA-256 mismatch (expected ${entry.sha256}, got ${digest})`,
            entry.file,
            source,
        );
    }
}

/** Throw unless `bytes` has the entry's exact length and SHA-256. */
export async function verifyEphemerisBytes(
    entry: EphemerisFileEntry,
    bytes: Uint8Array | ArrayBuffer,
    source?: string,
): Promise<void> {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const from = source ? ` from ${source}` : '';
    if (view.byteLength !== entry.bytes) {
        throw new EphemerisIntegrityError(
            `${entry.file}${from}: expected ${entry.bytes} bytes, got ${view.byteLength}`,
            entry.file,
            source,
        );
    }
    const digest = await sha256HexAsync(view);
    if (digest !== entry.sha256) {
        throw new EphemerisIntegrityError(
            `${entry.file}${from}: SHA-256 mismatch (expected ${entry.sha256}, got ${digest})`,
            entry.file,
            source,
        );
    }
}

export interface VerifyingChunkLoaderOptions {
    /** Manifest lookup; defaults to the built-in DE431 NJCE manifest. */
    entryFor?: (key: ChunkKey) => EphemerisFileEntry | undefined;
    /** Label used in error messages, e.g. a base URL. */
    source?: string;
}

/**
 * Wrap a chunk loader so every chunk is checked against the manifest.
 * A key outside the manifest, or bytes that fail the check, throw
 * {@link EphemerisIntegrityError}; a loader miss (undefined) passes through.
 */
export function verifyingChunkLoader(
    inner: EphemerisChunkLoader,
    options: VerifyingChunkLoaderOptions = {},
): EphemerisChunkLoader {
    const entryFor = options.entryFor ?? njceChunkEntry;
    return {
        async load(key) {
            const buf = await inner.load(key);
            if (!buf) return undefined;
            const entry = entryFor(key);
            if (!entry) {
                throw new EphemerisIntegrityError(
                    `no manifest entry for chunk g${key.groupId}-c${key.century}`,
                    `g${key.groupId}-c${key.century}.njce`,
                    options.source,
                );
            }
            await verifyEphemerisBytes(entry, buf, options.source);
            return buf;
        },
        loadSync(key) {
            const buf = inner.loadSync?.(key);
            if (!buf) return undefined;
            const entry = entryFor(key);
            if (!entry) {
                throw new EphemerisIntegrityError(
                    `no manifest entry for chunk g${key.groupId}-c${key.century}`,
                    `g${key.groupId}-c${key.century}.njce`,
                    options.source,
                );
            }
            verifyEphemerisBytesSync(entry, buf, options.source);
            return buf;
        },
    };
}

/**
 * Try loaders in order and return the first hit (installed package →
 * cache → remote is the usual order).
 */
export function firstAvailableChunkLoader(
    loaders: readonly EphemerisChunkLoader[],
): EphemerisChunkLoader {
    return {
        async load(key) {
            for (const loader of loaders) {
                const buf = await loader.load(key);
                if (buf) return buf;
            }
            return undefined;
        },
        loadSync(key) {
            for (const loader of loaders) {
                const buf = loader.loadSync?.(key);
                if (buf) return buf;
            }
            return undefined;
        },
    };
}
