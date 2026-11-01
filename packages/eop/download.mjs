/**
 * Fetch and verify IERS finals2000A.all and IANA leap-seconds.list for @node-jhora/eop.
 */

import { createHash } from 'node:crypto';
import {
    createReadStream,
    createWriteStream,
    existsSync,
    readFileSync,
    renameSync,
    statSync,
    unlinkSync,
} from 'node:fs';
import { get as httpsGet } from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const FINALS_NAME = 'finals2000A.all';
export const LEAP_NAME = 'leap-seconds.list';

/** SHA-256 of USNO finals2000A.all as of build (see build-pack.mjs header). Updated by pack-data. */
export let FINALS_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';
export let LEAP_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';

try {
    const pin = JSON.parse(readFileSync(join(__dirname, 'pins.json'), 'utf8'));
    FINALS_SHA256 = pin.finalsSha256;
    LEAP_SHA256 = pin.leapSha256;
} catch {
    /* first run */
}

const FINALS_SOURCES = [
    'https://maia.usno.navy.mil/ser7/finals2000A.all',
    'https://datacenter.iers.org/data/latestVersion/finals2000A.all',
];

const LEAP_URL = 'https://data.iana.org/time-zones/data/leap-seconds.list';

function sha256(path) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(path);
        stream.on('error', reject);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function matchesPinned(path, expected) {
    if (!expected || expected.startsWith('0000')) return existsSync(path);
    if (!existsSync(path)) return false;
    return (await sha256(path)) === expected;
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const partial = `${dest}.partial`;
        const file = createWriteStream(partial);
        httpsGet(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                unlinkSync(partial);
                download(res.headers.location, dest).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                file.close();
                unlinkSync(partial);
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    try {
                        renameSync(partial, dest);
                        resolve(undefined);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        }).on('error', reject);
    });
}

async function fetchOne(name, sources, expectedSha) {
    const dest = join(__dirname, name);
    if (await matchesPinned(dest, expectedSha)) {
        console.log(`${name}: already present (pinned SHA-256)`);
        return dest;
    }
    for (const url of sources) {
        try {
            console.log(`Fetching ${name} from ${url}`);
            await download(url, dest);
            const got = await sha256(dest);
            if (expectedSha && !expectedSha.startsWith('0000') && got !== expectedSha) {
                unlinkSync(dest);
                throw new Error(
                    `SHA-256 mismatch for ${name}: got ${got}, expected ${expectedSha}`,
                );
            }
            console.log(`${name}: ${statSync(dest).size} bytes, sha256=${got}`);
            return dest;
        } catch (e) {
            console.warn(`${url}: ${e.message}`);
        }
    }
    throw new Error(`Could not fetch ${name}`);
}

export async function fetchEopSources() {
    await fetchOne(FINALS_NAME, FINALS_SOURCES, FINALS_SHA256);
    await fetchOne(LEAP_NAME, [LEAP_URL], LEAP_SHA256);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    fetchEopSources().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
