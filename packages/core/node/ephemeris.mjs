/**
 * Node.js resolution of ephemeris data files, with integrity checks.
 *
 * Order for every file (DE440s kernel and DE431 NJCE chunks):
 *   1. an explicit path or directory (options or env)
 *   2. an installed data package (@node-jhora/ephe, @node-jhora/ephe-de431-*)
 *   3. the user cache directory
 *   4. a remote URL (opt-out with `offline: true` or NODE_JHORA_OFFLINE=1),
 *      verified against the pinned SHA-256 and written atomically to the cache
 *
 * Nothing here runs at install time; npm v12 and pnpm skip dependency
 * lifecycle scripts by default. See docs/decisions/0006-*.md.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pinned DE440s kernel; tests assert this equals DE440S_ENTRY in src/ephemeris-data. */
export const DE440S_FILE = Object.freeze({
    file: 'de440s.bsp',
    bytes: 32_726_016,
    sha256: 'c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2',
    urls: Object.freeze([
        'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp',
        'https://ssd.jpl.nasa.gov/pub/eph/planets/bsp/de440s.bsp',
        // Same bytes, mirrored by jsDelivr from the immutable @node-jhora/ephe@440.2.0 tarball.
        'https://cdn.jsdelivr.net/npm/@node-jhora/ephe@440.2.0/de440s.bsp',
    ]),
});

function envFlag(name) {
    const v = process.env[name];
    return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false';
}

/**
 * Cache root: NODE_JHORA_CACHE_DIR, else $XDG_CACHE_HOME/node-jhora,
 * else %LOCALAPPDATA%\node-jhora\Cache on Windows, ~/Library/Caches/node-jhora
 * on macOS, ~/.cache/node-jhora elsewhere.
 */
export function defaultCacheDir() {
    if (process.env.NODE_JHORA_CACHE_DIR) return process.env.NODE_JHORA_CACHE_DIR;
    if (process.env.XDG_CACHE_HOME) return join(process.env.XDG_CACHE_HOME, 'node-jhora');
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
        return join(process.env.LOCALAPPDATA, 'node-jhora', 'Cache');
    }
    if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'node-jhora');
    return join(homedir(), '.cache', 'node-jhora');
}

export function sha256File(path) {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function sha256Bytes(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

/** Size check always; full SHA-256 when `full` is true or NODE_JHORA_VERIFY=full. */
export function verifyFile(path, entry, { full = false } = {}) {
    const size = statSync(path).size;
    if (size !== entry.bytes) {
        throw new Error(`${path}: expected ${entry.bytes} bytes for ${entry.file}, got ${size}`);
    }
    if (full || process.env.NODE_JHORA_VERIFY === 'full') {
        const digest = sha256File(path);
        if (digest !== entry.sha256) {
            throw new Error(
                `${path}: SHA-256 mismatch for ${entry.file} (expected ${entry.sha256}, got ${digest})`,
            );
        }
    }
}

function resolvePackageDir(name) {
    const bases = [import.meta.url, join(process.cwd(), 'package.json')];
    for (const base of bases) {
        try {
            return dirname(createRequire(base).resolve(`${name}/package.json`));
        } catch {
            /* not installed from this base */
        }
    }
    return undefined;
}

/** Write bytes atomically after checking them against `entry`. */
export function writeVerified(dest, bytes, entry, source) {
    if (bytes.byteLength !== entry.bytes) {
        throw new Error(
            `${entry.file} from ${source}: expected ${entry.bytes} bytes, got ${bytes.byteLength}`,
        );
    }
    const digest = sha256Bytes(bytes);
    if (digest !== entry.sha256) {
        throw new Error(
            `${entry.file} from ${source}: SHA-256 mismatch (expected ${entry.sha256}, got ${digest})`,
        );
    }
    mkdirSync(dirname(dest), { recursive: true });
    const partial = `${dest}.${randomBytes(6).toString('hex')}.partial`;
    try {
        writeFileSync(partial, bytes);
        renameSync(partial, dest);
    } finally {
        try {
            unlinkSync(partial);
        } catch {
            /* renamed */
        }
    }
}

async function fetchBytes(url, fetchImpl = globalThis.fetch) {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return new Uint8Array(await res.arrayBuffer());
}

/** Cache path for DE440s (versioned by content hash so revisions never collide). */
export function de440sCachePath(cacheDir = defaultCacheDir()) {
    return join(cacheDir, 'de440s', DE440S_FILE.sha256.slice(0, 16), DE440S_FILE.file);
}

/**
 * Local DE440s path without network: env NODE_JHORA_EPHE_PATH, installed
 * @node-jhora/ephe, the monorepo copy, then the cache. Undefined if none.
 */
export function findLocalDe440s({ cacheDir } = {}) {
    if (process.env.NODE_JHORA_EPHE_PATH) {
        return { path: process.env.NODE_JHORA_EPHE_PATH, tier: 'env' };
    }
    const pkgDir = resolvePackageDir('@node-jhora/ephe');
    if (pkgDir && existsSync(join(pkgDir, DE440S_FILE.file))) {
        return { path: join(pkgDir, DE440S_FILE.file), tier: 'package' };
    }
    const dev = fileURLToPath(new URL('../../ephe/de440s.bsp', import.meta.url));
    if (existsSync(dev)) return { path: dev, tier: 'package' };
    const legacyDev = fileURLToPath(new URL('../../../de440s.bsp', import.meta.url));
    if (existsSync(legacyDev)) return { path: legacyDev, tier: 'package' };
    const cached = de440sCachePath(cacheDir);
    if (existsSync(cached)) return { path: cached, tier: 'cache' };
    return undefined;
}

/**
 * Download DE440s from JPL (or `urls`) into the cache, verifying SHA-256.
 * Returns the cache path. No-op when a verified copy is already cached.
 */
export async function downloadDe440s({
    cacheDir,
    urls = DE440S_FILE.urls,
    fetchImpl,
    log = () => {},
} = {}) {
    const dest = de440sCachePath(cacheDir);
    if (existsSync(dest)) {
        try {
            verifyFile(dest, DE440S_FILE, { full: true });
            return dest;
        } catch {
            unlinkSync(dest);
        }
    }
    const errors = [];
    for (const url of urls) {
        try {
            log(`downloading ${DE440S_FILE.file} from ${url}`);
            writeVerified(dest, await fetchBytes(url, fetchImpl), DE440S_FILE, url);
            return dest;
        } catch (err) {
            errors.push(`${url}: ${err.message}`);
        }
    }
    throw new Error(`could not download ${DE440S_FILE.file}:\n  ${errors.join('\n  ')}`);
}

/**
 * Resolve the DE440s kernel path, downloading into the cache when nothing is
 * installed (unless offline). Package and env copies get a size check; cache
 * copies are hashed in full.
 */
export async function resolveDe440sPath({
    cacheDir,
    offline = envFlag('NODE_JHORA_OFFLINE'),
    urls,
    fetchImpl,
} = {}) {
    const local = findLocalDe440s({ cacheDir });
    if (local) {
        verifyFile(local.path, DE440S_FILE, { full: local.tier === 'cache' });
        return local.path;
    }
    if (offline) {
        throw new Error(
            'EphemerisEngine: de440s.bsp not found and offline mode is on.\n' +
                '  Install the data package:  npm install @node-jhora/ephe\n' +
                '  Or prefetch into the cache: npx node-jhora-ephe prefetch de440s\n' +
                '  Or set:  NODE_JHORA_EPHE_PATH=/path/to/de440s.bsp',
        );
    }
    return downloadDe440s({ cacheDir, urls, fetchImpl });
}

// ---------------------------------------------------------------------------
// DE431 NJCE chunks
// ---------------------------------------------------------------------------

async function loadManifest() {
    return import('../dist/ephemeris-data/index.js');
}

export function njceCacheDir(cacheDir = defaultCacheDir(), version) {
    return join(cacheDir, 'de431-njce', version);
}

export function njce441CacheDir(cacheDir = defaultCacheDir(), version) {
    return join(cacheDir, 'de441-njce', version);
}

function toArrayBuffer(buf) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * EphemerisChunkLoader for Node. Every chunk is checked against the manifest
 * (size and SHA-256) whichever tier it comes from.
 *
 * @param {object} [options]
 * @param {string[]} [options.dirs] extra directories holding g{G}-c{C}.njce files
 * @param {string} [options.cacheDir] cache root (defaults to {@link defaultCacheDir})
 * @param {string} [options.baseUrl] remote directory holding the chunk files (self-hosted mirror)
 * @param {(key: {century:number, groupId:number}) => string} [options.urlFor] remote URL per chunk; overrides baseUrl
 * @param {boolean} [options.cdn] use jsDelivr URLs for the published data packages
 * @param {boolean} [options.offline] never touch the network (default NODE_JHORA_OFFLINE)
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.kernel] de431 or de441 (default de431)
 */
export async function createNodeChunkLoader(options = {}) {
    const m = await loadManifest();
    const kernel = options.kernel ?? 'de431';
    const is441 = kernel === 'de441';
    const offline = options.offline ?? envFlag('NODE_JHORA_OFFLINE');
    const dataVersion = is441 ? m.NJCE441_DATA_VERSION : m.NJCE_DATA_VERSION;
    const cacheRoot = (is441 ? njce441CacheDir : njceCacheDir)(
        options.cacheDir ?? defaultCacheDir(),
        dataVersion,
    );
    const dirs = [
        ...(is441
            ? process.env.NODE_JHORA_EPHE_LONG441_DIR
                ? [process.env.NODE_JHORA_EPHE_LONG441_DIR]
                : []
            : process.env.NODE_JHORA_EPHE_LONG_DIR
              ? [process.env.NODE_JHORA_EPHE_LONG_DIR]
              : []),
        ...(options.dirs ?? []),
    ];
    const fileName = is441 ? m.njce441FileName : m.njceFileName;
    const packageName = is441 ? m.njce441PackageName : m.njcePackageName;
    const cdnUrl = is441 ? m.njce441CdnUrl : m.njceCdnUrl;
    const chunkEntry = is441 ? m.njce441ChunkEntry : m.njceChunkEntry;
    const manifestLabel = is441 ? 'DE441' : 'DE431';
    const urlFor =
        options.urlFor ??
        (options.baseUrl
            ? (key) => `${options.baseUrl.replace(/\/?$/, '/')}${fileName(key)}`
            : options.cdn
              ? (key) => cdnUrl(key)
              : undefined);

    function readVerified(path, entry) {
        if (!existsSync(path)) return undefined;
        const buf = readFileSync(path);
        if (buf.length !== entry.bytes || sha256Bytes(buf) !== entry.sha256) {
            throw new m.EphemerisIntegrityError(
                `${path}: does not match the ${manifestLabel} manifest`,
                entry.file,
                path,
            );
        }
        return toArrayBuffer(buf);
    }

    return {
        loadSync(key) {
            const entry = chunkEntry(key);
            if (!entry) return undefined;
            for (const dir of dirs) {
                const hit = readVerified(join(dir, entry.file), entry);
                if (hit) return hit;
            }
            const pkgDir = resolvePackageDir(packageName(key.century));
            if (pkgDir) {
                const hit = readVerified(join(pkgDir, entry.file), entry);
                if (hit) return hit;
            }
            const cachePath = join(cacheRoot, entry.file);
            if (existsSync(cachePath)) {
                try {
                    return readVerified(cachePath, entry);
                } catch {
                    unlinkSync(cachePath);
                }
            }
            return undefined;
        },
        async load(key) {
            const entry = chunkEntry(key);
            if (!entry) return undefined;
            for (const dir of dirs) {
                const hit = readVerified(join(dir, entry.file), entry);
                if (hit) return hit;
            }
            const pkgDir = resolvePackageDir(packageName(key.century));
            if (pkgDir) {
                const hit = readVerified(join(pkgDir, entry.file), entry);
                if (hit) return hit;
            }
            const cachePath = join(cacheRoot, entry.file);
            if (existsSync(cachePath)) {
                try {
                    return readVerified(cachePath, entry);
                } catch {
                    unlinkSync(cachePath);
                }
            }
            if (offline || !urlFor) return undefined;
            const url = urlFor(key);
            const bytes = await fetchBytes(url, options.fetchImpl);
            try {
                writeVerified(cachePath, bytes, entry, url);
            } catch (err) {
                throw new m.EphemerisIntegrityError(err.message, entry.file, url);
            }
            return bytes.slice().buffer;
        },
    };
}

/** Centuries (inclusive) covering astronomical years [fromYear, toYear]. */
export function centuriesForYears(fromYear, toYear) {
    const lo = Math.max(-100, Math.floor(Math.min(fromYear, toYear) / 100));
    const hi = Math.min(99, Math.floor(Math.max(fromYear, toYear) / 100));
    const out = [];
    for (let c = lo; c <= hi; c++) out.push(c);
    return out;
}

/** Fill the cache for a year range; returns per-chunk results. */
export async function prefetchChunks({ fromYear, toYear, kernel = 'de431', ...loaderOptions }) {
    const loader = await createNodeChunkLoader({ ...loaderOptions, kernel });
    const results = [];
    for (const century of centuriesForYears(fromYear, toYear)) {
        for (const groupId of [0, 1]) {
            try {
                const buf = await loader.load({ century, groupId });
                results.push({ century, groupId, ok: !!buf, bytes: buf?.byteLength ?? 0 });
            } catch (err) {
                results.push({ century, groupId, ok: false, bytes: 0, error: err.message });
            }
        }
    }
    return results;
}

/** Set a verified Node DE431 chunk store on the engine. */
export async function registerNodeChunkStore(engine, options = {}) {
    const core = await import('../dist/index.js');
    const loader = await createNodeChunkLoader({ ...options, kernel: 'de431' });
    engine.setChunkStore(new core.De431ChunkStore(new core.CachingChunkLoader(loader)));
}

/** Set a verified Node DE441 chunk store on the engine. */
export async function registerNodeDe441ChunkStore(engine, options = {}) {
    const core = await import('../dist/index.js');
    const loader = await createNodeChunkLoader({ ...options, kernel: 'de441' });
    engine.setDe441ChunkStore(new core.De441ChunkStore(new core.CachingChunkLoader(loader)));
}
