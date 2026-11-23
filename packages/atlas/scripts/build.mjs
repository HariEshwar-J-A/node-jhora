/**
 * Build @node-jhora/atlas sharded JSON from GeoNames dumps (CC-BY 4.0).
 *
 * Downloads into packages/atlas/.cache/ (not committed).
 *
 * Usage:
 *   node scripts/build.mjs [--out data] [--fixture tests/fixtures/gazetteer-mini]
 */

import { execSync, spawn } from 'node:child_process';
import {
    createWriteStream,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    statSync,
    rmSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { get as httpsGet } from 'node:https';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { normalizeSearchKey, shardIdForKey } from './normalize.mjs';

/** Strip CR/LF and control chars (CodeQL log injection). */
function sanitizeLogLine(value) {
    return String(value).replace(/[\r\n\x00-\x1f\x7f]/g, '');
}

const ATTRIBUTION_TEXT =
    'Data © GeoNames (https://www.geonames.org/), used under Creative Commons Attribution 4.0 International (CC-BY 4.0).';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const CACHE = join(PKG_ROOT, '.cache');

const GEONAMES = {
    cities1000: 'https://download.geonames.org/export/dump/cities1000.zip',
    admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
    alternateNames: 'https://download.geonames.org/export/dump/alternateNamesV2.zip',
    timeZones: 'https://download.geonames.org/export/dump/timeZones.txt',
};

/** 0 primary/ascii, 1 later word of that name, 2 alternate. */
const KIND_PRIMARY = 0;
const KIND_WORD = 1;
const KIND_ALT = 2;

function parseArgs(argv) {
    let outDir = join(PKG_ROOT, 'data');
    let fixturePath = null;
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--out' && argv[i + 1]) {
            outDir = argv[++i].startsWith('/') ? argv[i] : join(PKG_ROOT, argv[i]);
        } else if (argv[i] === '--fixture' && argv[i + 1]) {
            fixturePath = argv[++i];
        }
    }
    return { outDir, fixturePath };
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const partial = `${dest}.partial`;
        const file = createWriteStream(partial);
        const fail = (err) => {
            file.destroy();
            try {
                unlinkSync(partial);
            } catch {
                /* ignore */
            }
            reject(err);
        };
        httpsGet(url, (res) => {
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                download(res.headers.location, dest).then(resolve, reject);
                return;
            }
            if (status !== 200) {
                res.resume();
                fail(new Error(`HTTP ${status} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    try {
                        renameSync(partial, dest);
                    } catch (e) {
                        fail(e);
                        return;
                    }
                    resolve();
                });
            });
            file.on('error', fail);
        }).on('error', fail);
    });
}

async function ensureDownload(url, dest) {
    if (existsSync(dest) && statSync(dest).size > 0) {
        return;
    }
    mkdirSync(dirname(dest), { recursive: true });
    console.log(`[atlas:build] Downloading ${url}`);
    await download(url, dest);
}

function parseCitiesLine(line) {
    const cols = line.split('\t');
    if (cols.length < 19) return null;
    return {
        geonameId: Number(cols[0]),
        name: cols[1],
        asciiName: cols[2],
        alternates: cols[3],
        lat: Number(cols[4]),
        lon: Number(cols[5]),
        country: cols[8],
        admin1: cols[10],
        population: Number(cols[14]) || 0,
        timezone: cols[17],
    };
}

function loadAdmin1(path) {
    const map = new Map();
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
        if (!line || line.startsWith('#')) continue;
        const [code, name] = line.split('\t');
        if (code && name) map.set(code.trim(), name.trim());
    }
    return map;
}

function hasIndicScript(text) {
    return /\p{Script=Devanagari}|\p{Script=Tamil}|\p{Script=Bengali}|\p{Script=Gurmukhi}|\p{Script=Gujarati}|\p{Script=Kannada}|\p{Script=Malayalam}|\p{Script=Oriya}|\p{Script=Telugu}/u.test(
        text,
    );
}

function shouldKeepAlternate(cols, population) {
    const lang = cols[2] ?? '';
    const name = cols[3] ?? '';
    if (!name || name.length > 48) return false;
    // Codes and links are not place names.
    if (
        lang === 'link' ||
        lang === 'wkdt' ||
        lang === 'post' ||
        lang === 'iata' ||
        lang === 'icao' ||
        lang === 'faac'
    ) {
        return false;
    }
    if (hasIndicScript(name)) return true;
    const preferred = cols[4] === '1';
    const short = cols[5] === '1';
    const colloquial = cols[6] === '1';
    const historic = cols[7] === '1';
    // Unflagged Latin rows are transliterations (Chengchow, "São Paulo" on Frei Paulo).
    if (preferred || short) return true;
    if ((historic || colloquial) && population > 100_000) return true;
    return false;
}

function createKeyAccumulator() {
    return {
        /** placeIndex -> normalized keys already added */
        perPlace: new Map(),
        /** shard -> entries */
        keyMap: new Map(),
        /** `${key}\0${placeIndex}` -> kind, so a better kind replaces the row */
        kindByPair: new Map(),
    };
}

function addKey(acc, key, placeIndex, kind) {
    const normalized = normalizeSearchKey(key);
    if (!normalized || normalized.length > 64) return;

    let placeKinds = acc.perPlace.get(placeIndex);
    if (!placeKinds) {
        placeKinds = new Map();
        acc.perPlace.set(placeIndex, placeKinds);
    }
    const prevKind = placeKinds.get(normalized);
    if (prevKind !== undefined && prevKind <= kind) return;
    placeKinds.set(normalized, kind);

    const pair = `${normalized}\0${placeIndex}`;
    const previous = acc.kindByPair.get(pair);
    if (previous !== undefined && previous <= kind) return;
    acc.kindByPair.set(pair, kind);

    const shard = shardIdForKey(normalized);
    if (!acc.keyMap.has(shard)) acc.keyMap.set(shard, []);
    const bucket = acc.keyMap.get(shard);
    if (previous !== undefined) {
        const existing = bucket.find((row) => row[0] === normalized && row[1] === placeIndex);
        if (existing) existing[2] = kind;
        return;
    }
    bucket.push([normalized, placeIndex, kind]);
}

function addPrimaryKeys(acc, text, placeIndex) {
    addKey(acc, text, placeIndex, KIND_PRIMARY);
    const words = normalizeSearchKey(text).split(' ');
    for (let i = 1; i < words.length; i++) {
        if (words[i].length >= 3) addKey(acc, words[i], placeIndex, KIND_WORD);
    }
}

async function streamAlternateNames(zipPath, geonameIds, onName) {
    const txtPath = join(CACHE, 'alternateNamesV2.txt');
    if (!existsSync(txtPath)) {
        console.log('[atlas:build] Extracting alternateNamesV2.txt (one-time)…');
        mkdirSync(CACHE, { recursive: true });
        execSync(`unzip -p "${zipPath}" alternateNamesV2.txt > "${txtPath}"`, {
            maxBuffer: 1024 * 1024 * 1024,
        });
    }
    const rl = createInterface({ input: createReadStream(txtPath), crlfDelay: Infinity });
    let scanned = 0;
    for await (const line of rl) {
        scanned++;
        if (scanned % 2_000_000 === 0) {
            console.log(`[atlas:build] Scanned ${scanned} alternate-name rows…`);
        }
        if (!line) continue;
        const cols = line.split('\t');
        if (cols.length < 4) continue;
        const geonameId = Number(cols[1]);
        if (!geonameIds.has(geonameId)) continue;
        const altName = cols[3];
        if (altName) onName(geonameId, altName, cols);
    }
}

function readCities1000(zipPath) {
    const child = spawn('unzip', ['-p', zipPath, 'cities1000.txt'], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const cities = [];
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    const done = new Promise((resolve, reject) => {
        let stderr = '';
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`unzip cities1000.txt exited ${code}: ${stderr.slice(0, 500)}`));
                return;
            }
            resolve();
        });
    });
    return (async () => {
        for await (const line of rl) {
            if (!line) continue;
            const row = parseCitiesLine(line);
            if (row) cities.push(row);
        }
        await done;
        return cities;
    })();
}

function writeShards(outDir, places, keyMap) {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(join(outDir, 'index'), { recursive: true });

    const indexShards = {};
    const shardBytes = {};
    let keyCount = 0;
    let largest = 0;
    let largestId = '';
    for (const [shardId, entries] of keyMap.entries()) {
        entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        const keys = [];
        const placeIndexes = [];
        const kinds = [];
        const localPlaces = [];
        const localIndex = new Map();
        for (const [k, idx, kind] of entries) {
            let local = localIndex.get(idx);
            if (local === undefined) {
                local = localPlaces.length;
                localIndex.set(idx, local);
                localPlaces.push(places[idx]);
            }
            keys.push(k);
            placeIndexes.push(local);
            kinds.push(kind);
            keyCount++;
        }
        const fileName = `index/${shardId}.json.gz`;
        indexShards[shardId] = fileName;
        const filePath = join(outDir, fileName);
        const json = JSON.stringify({ keys, placeIndexes, kinds, places: localPlaces });
        writeFileSync(filePath, gzipSync(Buffer.from(json), { level: 9 }));
        const size = statSync(filePath).size;
        shardBytes[shardId] = size;
        if (size > largest) {
            largest = size;
            largestId = shardId;
        }
    }

    const manifest = {
        version: 2,
        attribution: ATTRIBUTION_TEXT,
        license: 'CC-BY-4.0',
        geonamesUrl: 'https://www.geonames.org/',
        builtAt: new Date().toISOString(),
        placeCount: places.length,
        keyCount,
        indexShards,
        shardBytes,
    };
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest));
    return { keyCount, largest, largestId };
}

function copyFixture(fixturePath, outDir) {
    const source = join(PKG_ROOT, fixturePath);
    mkdirSync(outDir, { recursive: true });
    for (const name of readdirSync(source)) {
        const src = join(source, name);
        const dest = join(outDir, name);
        let childNames;
        try {
            childNames = readdirSync(src);
            mkdirSync(dest, { recursive: true });
            for (const child of childNames) {
                writeFileSync(join(dest, child), readFileSync(join(src, child)));
            }
        } catch (err) {
            if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOTDIR') {
                writeFileSync(dest, readFileSync(src));
            } else {
                throw err;
            }
        }
    }
}

async function buildFull(outDir) {
    mkdirSync(CACHE, { recursive: true });
    const citiesZip = join(CACHE, 'cities1000.zip');
    const adminPath = join(CACHE, 'admin1CodesASCII.txt');
    const altZip = join(CACHE, 'alternateNamesV2.zip');

    await ensureDownload(GEONAMES.cities1000, citiesZip);
    await ensureDownload(GEONAMES.admin1, adminPath);
    await ensureDownload(GEONAMES.alternateNames, altZip);
    await ensureDownload(GEONAMES.timeZones, join(CACHE, 'timeZones.txt'));

    const admin1 = loadAdmin1(adminPath);
    const cities = await readCities1000(citiesZip);
    const geonameIds = new Set(cities.map((c) => c.geonameId));

    const places = [];
    const placeIndexByGeoname = new Map();
    const acc = createKeyAccumulator();

    for (const city of cities) {
        const adminKey = `${city.country}.${city.admin1}`;
        const adminName = admin1.get(adminKey) ?? '';
        const placeIndex = places.length;
        placeIndexByGeoname.set(city.geonameId, placeIndex);
        places.push([
            city.name,
            city.lat,
            city.lon,
            city.timezone,
            city.country,
            adminName,
            city.population,
            city.geonameId,
        ]);

        addPrimaryKeys(acc, city.name, placeIndex);
        if (
            city.asciiName &&
            normalizeSearchKey(city.asciiName) !== normalizeSearchKey(city.name)
        ) {
            addPrimaryKeys(acc, city.asciiName, placeIndex);
        }
    }

    console.log(`[atlas:build] Streaming alternate names for ${cities.length} cities1000 places…`);
    await streamAlternateNames(altZip, geonameIds, (geonameId, altName, cols) => {
        const placeIndex = placeIndexByGeoname.get(geonameId);
        if (placeIndex === undefined) return;
        const pop = places[placeIndex][6];
        if (!shouldKeepAlternate(cols, pop)) return;
        addKey(acc, altName, placeIndex, KIND_ALT);
    });

    const { keyCount, largest, largestId } = writeShards(outDir, places, acc.keyMap);
    console.log(`[atlas:build] Wrote ${places.length} places, ${keyCount} keys → ${outDir}`);
    console.log(
        `[atlas:build] Largest shard ${sanitizeLogLine(largestId)}: ${(largest / 1024).toFixed(1)} KB`,
    );
}

function dirSizeBytes(dir) {
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) total += dirSizeBytes(p);
        else total += statSync(p).size;
    }
    return total;
}

async function main() {
    const { outDir, fixturePath } = parseArgs(process.argv);

    if (fixturePath) {
        copyFixture(fixturePath, outDir);
        console.log(`[atlas:build] Copied fixture → ${outDir}`);
        return;
    }

    await buildFull(outDir);
    const bytes = dirSizeBytes(outDir);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    console.log(`[atlas:build] Total data size: ${sanitizeLogLine(mb)} MB`);
    // cities1000 is exhaustive. Passing 25 MB is expected and is not a warning.
    console.log(
        '[atlas:build] Passing 25 MB is expected for an exhaustive cities1000 atlas and is not a warning. GitHub Pages allows 100 MB per file and the site must stay well under 1 GB.',
    );
    const fileLimit = 100 * 1024 * 1024;
    const atlasLimit = 900 * 1024 * 1024;
    let oversized = false;
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
    for (const [shardId, rel] of Object.entries(manifest.indexShards)) {
        const size = statSync(join(outDir, rel)).size;
        if (size > fileLimit) {
            console.error(
                `[atlas:build] Shard ${sanitizeLogLine(shardId)} is ${(size / (1024 * 1024)).toFixed(1)} MB (limit 100 MB)`,
            );
            oversized = true;
        }
    }
    if (bytes > atlasLimit) {
        console.error(
            `[atlas:build] Atlas is ${sanitizeLogLine(mb)} MB, above the 900 MB cap (site must stay well under 1 GB)`,
        );
        oversized = true;
    }
    if (oversized) {
        console.error('[atlas:build] Output exceeds GitHub Pages limits');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(sanitizeLogLine(err?.message ?? err));
    process.exit(1);
});
