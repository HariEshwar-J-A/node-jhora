/**
 * download.mjs — postinstall script for @node-jhora/ephe
 *
 * Downloads Swiss Ephemeris .se1 data files from Astrodienst.
 * These files are freely available and carry NO GPL restriction
 * (only the SE C library is AGPL; the data files are separate).
 *
 * Files downloaded:
 *   sepl_18.se1  — planets (Sun, Moon-node, Mercury-Pluto) 1800–2400 AD (~484 KB)
 *   semo_18.se1  — Moon 1800–2400 AD (~1.3 MB)
 *
 * Source: https://www.astro.com/ftp/swisseph/ephe/
 */

import { createWriteStream, existsSync, statSync, unlinkSync } from 'fs';
import { get as httpsGet } from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FILES = [
    {
        name:    'sepl_18.se1',
        dest:    join(__dirname, 'sepl_18.se1'),
        minSize: 400_000,   // ~484 KB
        urls: [
            'https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1',
            'https://github.com/aloistr/swisseph/raw/master/ephe/sepl_18.se1',
        ],
    },
    {
        name:    'semo_18.se1',
        dest:    join(__dirname, 'semo_18.se1'),
        minSize: 1_000_000, // ~1.3 MB
        urls: [
            'https://www.astro.com/ftp/swisseph/ephe/semo_18.se1',
            'https://github.com/aloistr/swisseph/raw/master/ephe/semo_18.se1',
        ],
    },
];

function download(url, dest, minSize) {
    return new Promise((resolve, reject) => {
        console.log(`[node-jhora/ephe] Downloading ${url} …`);
        const proto  = url.startsWith('https') ? httpsGet : undefined;
        if (!proto) { reject(new Error('Only HTTPS supported')); return; }

        const stream = createWriteStream(dest);
        const req = httpsGet(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                stream.destroy();
                download(res.headers.location, dest, minSize).then(resolve).catch(reject);
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
                    if (pct !== lastPct && pct % 20 === 0) {
                        process.stdout.write(`\r  ${pct}% (${(received / 1024).toFixed(0)} KB)`);
                        lastPct = pct;
                    }
                }
            });

            res.pipe(stream);
            stream.on('finish', () => {
                process.stdout.write('\n');
                const size = statSync(dest).size;
                if (size < minSize) {
                    try { unlinkSync(dest); } catch {}
                    reject(new Error(`File too small (${size} bytes) — download corrupted?`));
                } else {
                    console.log(`  OK: ${dest} (${(size / 1024).toFixed(0)} KB)`);
                    resolve();
                }
            });
        });

        req.on('error', (err) => { try { unlinkSync(dest); } catch {} reject(err); });
        stream.on('error', (err) => { req.destroy(); reject(err); });
    });
}

async function ensureFile(spec) {
    if (existsSync(spec.dest) && statSync(spec.dest).size >= spec.minSize) {
        console.log(`[node-jhora/ephe] ${spec.name} already present — skipping.`);
        return;
    }
    for (const url of spec.urls) {
        try {
            await download(url, spec.dest, spec.minSize);
            return;
        } catch (err) {
            console.warn(`  Failed (${err.message}), trying next source…`);
        }
    }
    console.error(
        `[node-jhora/ephe] ERROR: Could not download ${spec.name}.\n` +
        `  Download manually from https://www.astro.com/ftp/swisseph/ephe/${spec.name}\n` +
        `  and place it at: ${spec.dest}`,
    );
    process.exit(1);
}

async function main() {
    console.log('[node-jhora/ephe] Checking Swiss Ephemeris data files…');
    for (const spec of FILES) {
        await ensureFile(spec);
    }
    console.log('[node-jhora/ephe] All SE data files ready.');
    process.exit(0);
}

main();
