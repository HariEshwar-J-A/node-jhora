/**
 * download.mjs — postinstall script for @node-jhora/ephe
 *
 * Downloads de440s.bsp from JPL's public servers.
 *
 *   de440s.bsp:
 *     Coverage : 1849-12-26 to 2150-01-22
 *     Size     : ~32 MB
 *     License  : U.S. Government public domain — no restrictions
 *     Citation : Park et al. (2021), AJ 161 105, "The JPL Planetary and
 *                Lunar Ephemerides DE440 and DE441"
 *
 *   Canonical URL: https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp
 */

import { createWriteStream, existsSync, statSync, unlinkSync } from 'fs';
import { get as httpsGet }  from 'https';
import { fileURLToPath }    from 'url';
import { dirname, join }    from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST      = join(__dirname, 'de440s.bsp');
const MIN_SIZE  = 30 * 1024 * 1024;   // 30 MB sanity-check floor

const SOURCES = [
    'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp',
    'https://ssd.jpl.nasa.gov/pub/eph/planets/bsp/de440s.bsp',
];

// ── Already present? ──────────────────────────────────────────────────────
if (existsSync(DEST) && statSync(DEST).size > MIN_SIZE) {
    console.log('[node-jhora/ephe] de440s.bsp already present — skipping download.');
    process.exit(0);
}

// ── Download helper ───────────────────────────────────────────────────────
function download(url) {
    return new Promise((resolve, reject) => {
        console.log(`[node-jhora/ephe] Downloading de440s.bsp from ${url} …`);
        const stream = createWriteStream(DEST);

        httpsGet(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                stream.destroy();
                download(res.headers.location).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                stream.destroy();
                reject(new Error(`HTTP ${res.statusCode} from ${url}`));
                return;
            }

            const total  = parseInt(res.headers['content-length'] ?? '0', 10);
            let received = 0, lastPct = -1;

            res.on('data', (chunk) => {
                received += chunk.length;
                if (total > 0) {
                    const pct = Math.floor(received / total * 100);
                    if (pct !== lastPct && pct % 10 === 0) {
                        process.stdout.write(`\r[node-jhora/ephe] ${pct}% (${(received / 1e6).toFixed(1)} MB)`);
                        lastPct = pct;
                    }
                }
            });

            res.pipe(stream);
            stream.on('finish', () => {
                process.stdout.write('\n');
                const size = statSync(DEST).size;
                if (size < MIN_SIZE) {
                    try { unlinkSync(DEST); } catch {}
                    reject(new Error(`Downloaded file too small (${size} bytes) — corrupted?`));
                } else {
                    console.log(`[node-jhora/ephe] de440s.bsp ready (${(size / 1e6).toFixed(1)} MB).`);
                    resolve();
                }
            });
        }).on('error', (err) => {
            try { unlinkSync(DEST); } catch {}
            reject(err);
        });

        stream.on('error', (err) => { reject(err); });
    });
}

// ── Try each source in order ──────────────────────────────────────────────
async function main() {
    for (const url of SOURCES) {
        try {
            await download(url);
            process.exit(0);
        } catch (err) {
            console.warn(`[node-jhora/ephe] Failed: ${err.message} — trying next source…`);
        }
    }
    console.error([
        '[node-jhora/ephe] ERROR: Could not download de440s.bsp from any source.',
        '  Download manually from: https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp',
        `  Place it at: ${DEST}`,
    ].join('\n'));
    process.exit(1);
}

main();
