/**
 * download.mjs — fetch and verify de440s.bsp for @node-jhora/ephe
 *
 * Runs as `prepack` (so a packed tarball always carries the verified kernel)
 * and from the monorepo root `postinstall`. It is not a lifecycle script of
 * the published package.
 *
 * Downloads de440s.bsp from JPL's public servers.
 *
 *   de440s.bsp:
 *     Coverage : 1849-12-26 to 2150-01-22
 *     Size     : 32,726,016 bytes
 *     License  : U.S. Government public domain — no restrictions
 *     Citation : Park et al. (2021), AJ 161 105, "The JPL Planetary and
 *                Lunar Ephemerides DE440 and DE441"
 *
 *   Canonical URL: https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp
 *
 * The bytes are pinned. NAIF publishes MD5 3917ee56769db332790c751e2168843d
 * for this kernel in aa_checksums.txt (directory dated 2020-12-21). The
 * SHA-256 lives in constants.mjs, checked against the SSD mirror on
 * 2026-10-26. A file already at DEST with this digest is left in place.
 * A verified copy under .vercel/cache (keyed by the full SHA-256) is
 * restored before any JPL request, so a Vercel rebuild does not re-download.
 */

import { createHash } from 'crypto';
import {
    copyFileSync,
    createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
    realpathSync,
    renameSync,
    statSync,
    unlinkSync,
} from 'fs';
import { get as httpsGet } from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DE440S_BYTES, DE440S_SHA256, DE440S_URLS } from './constants.mjs';
import { readCachedFile, writeCachedFile } from '../../scripts/build-cache.mjs';

/** Strip CR/LF and control chars so error messages cannot forge log lines (CodeQL). */
function sanitizeLogLine(value) {
    return String(value).replace(/[\r\n\x00-\x1f\x7f]/g, '');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = join(__dirname, 'de440s.bsp');
const PARTIAL = `${DEST}.partial`;
const CACHE_KEY = `ephe/${DE440S_SHA256}`;
const SOURCES = DE440S_URLS;

function sha256(path) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(path);
        stream.on('error', reject);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function matchesPinnedChecksum(path) {
    if (!existsSync(path)) return false;
    try {
        if (statSync(path).size !== DE440S_BYTES) return false;
        return (await sha256(path)) === DE440S_SHA256;
    } catch {
        return false;
    }
}

function removeQuiet(path) {
    try {
        unlinkSync(path);
    } catch {
        /* already gone */
    }
}

function download(url) {
    return new Promise((resolve, reject) => {
        console.log(`[node-jhora/ephe] Downloading de440s.bsp from ${url} …`);
        const stream = createWriteStream(PARTIAL);

        const fail = (err) => {
            stream.destroy();
            removeQuiet(PARTIAL);
            reject(err);
        };

        httpsGet(url, (res) => {
            const status = res.statusCode ?? 0;
            if (
                status === 301 ||
                status === 302 ||
                status === 303 ||
                status === 307 ||
                status === 308
            ) {
                const location = res.headers.location;
                res.resume();
                stream.close();
                removeQuiet(PARTIAL);
                if (!location) {
                    reject(new Error(`HTTP ${status} from ${url} with no Location`));
                    return;
                }
                download(new URL(location, url).href).then(resolve).catch(reject);
                return;
            }
            if (status !== 200) {
                res.resume();
                fail(new Error(`HTTP ${status} from ${url}`));
                return;
            }

            const total = parseInt(res.headers['content-length'] ?? '0', 10);
            let received = 0,
                lastPct = -1;

            res.on('data', (chunk) => {
                received += chunk.length;
                if (total > 0) {
                    const pct = Math.floor((received / total) * 100);
                    if (pct !== lastPct && pct % 10 === 0) {
                        process.stdout.write(
                            `\r[node-jhora/ephe] ${pct}% (${(received / 1e6).toFixed(1)} MB)`,
                        );
                        lastPct = pct;
                    }
                }
            });

            res.pipe(stream);
            stream.on('finish', () => {
                process.stdout.write('\n');
                resolve();
            });
            stream.on('error', fail);
            res.on('error', fail);
        }).on('error', fail);
    });
}

async function acceptDownload() {
    const size = existsSync(PARTIAL) ? statSync(PARTIAL).size : 0;
    const digest = size === DE440S_BYTES ? await sha256(PARTIAL) : '';
    if (digest !== DE440S_SHA256) {
        removeQuiet(PARTIAL);
        throw new Error(`checksum mismatch (sha256 ${digest || 'n/a'}, ${size} bytes)`);
    }
    renameSync(PARTIAL, DEST);
    console.log(
        `[node-jhora/ephe] de440s.bsp ready (${(size / 1e6).toFixed(1)} MB, sha256 ${digest.slice(0, 12)}…).`,
    );
}

function remember(src) {
    writeCachedFile(CACHE_KEY, 'de440s.bsp', src);
}

async function restoreFromCache() {
    for (;;) {
        const cached = readCachedFile(CACHE_KEY, 'de440s.bsp');
        if (!cached) return false;
        if (await matchesPinnedChecksum(cached)) {
            mkdirSync(dirname(DEST), { recursive: true });
            copyFileSync(cached, DEST);
            console.log(
                '[node-jhora/ephe] Restored de440s.bsp from build cache (sha256 verified).',
            );
            return true;
        }
        console.warn('[node-jhora/ephe] cached kernel failed sha256 — ignoring.');
        removeQuiet(cached);
    }
}

async function main() {
    if (await matchesPinnedChecksum(DEST)) {
        remember(DEST);
        console.log('[node-jhora/ephe] de440s.bsp checksum matches — skipping download.');
        return;
    }
    if (await restoreFromCache()) return;
    if (existsSync(DEST)) {
        console.warn('[node-jhora/ephe] de440s.bsp checksum does not match — downloading again.');
        removeQuiet(DEST);
    }

    for (const url of SOURCES) {
        try {
            await download(url);
            await acceptDownload();
            remember(DEST);
            return;
        } catch (err) {
            removeQuiet(PARTIAL);
            const failDetail = String(err?.message ?? err).replace(/[\r\n\x00-\x1f\x7f]/g, '');
            console.warn(`[node-jhora/ephe] Failed: ${failDetail} — trying next source…`);
        }
    }
    console.error(
        [
            '[node-jhora/ephe] ERROR: Could not download de440s.bsp from any source.',
            '  Download manually from: https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp',
            `  Place it at: ${DEST}`,
            `  Expected sha256: ${DE440S_SHA256}`,
        ].join('\n'),
    );
    process.exit(1);
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : '';
const self = realpathSync(fileURLToPath(import.meta.url));
if (entry === self) {
    main().catch((err) => {
        console.error(`[node-jhora/ephe] ERROR: ${sanitizeLogLine(err?.message ?? err)}`);
        process.exit(1);
    });
}
