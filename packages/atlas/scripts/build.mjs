/**
 * Build @node-jhora/atlas sharded JSON from GeoNames dumps (CC-BY 4.0).
 *
 * Downloads into packages/atlas/.cache/ (not committed).
 *
 * Usage:
 *   node scripts/build.mjs [--out data] [--fixture tests/fixtures/gazetteer-mini]
 */

import { execSync } from 'node:child_process';
import {
    createWriteStream,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { get as httpsGet } from 'node:https';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeSearchKey, shardIdForKey } from './normalize.mjs';

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

function shouldKeepAlternate(cols) {
    const lang = cols[2] ?? '';
    const name = cols[3] ?? '';
    if (!name || name.length > 48) return false;
    if (cols[4] === '1' || cols[6] === '1' || cols[7] === '1' || cols[8] === '1') return true;
    // 'link' rows are URLs (Wikipedia etc.), not names; never index them.
    if (lang === 'link') return false;
    if (lang === 'en' || lang === 'abbr') return true;
    if (hasIndicScript(name)) return true;
    return false;
}

function createKeyAccumulator() {
    return {
        /** placeIndex -> normalized keys already added */
        perPlace: new Map(),
        /** shard -> entries */
        keyMap: new Map(),
        pairSeen: new Set(),
    };
}

function addKey(acc, key, placeIndex) {
    const normalized = normalizeSearchKey(key);
    if (!normalized || normalized.length > 64) return;

    let placeSet = acc.perPlace.get(placeIndex);
    if (!placeSet) {
        placeSet = new Set();
        acc.perPlace.set(placeIndex, placeSet);
    }
    if (placeSet.has(normalized)) return;
    placeSet.add(normalized);

    const pair = `${normalized}\0${placeIndex}`;
    if (acc.pairSeen.has(pair)) return;
    acc.pairSeen.add(pair);

    const shard = shardIdForKey(normalized);
    if (!acc.keyMap.has(shard)) acc.keyMap.set(shard, []);
    acc.keyMap.get(shard).push([normalized, placeIndex]);
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
    for await (const line of rl) {
        if (!line) continue;
        const cols = line.split('\t');
        if (cols.length < 4) continue;
        const geonameId = Number(cols[1]);
        if (!geonameIds.has(geonameId)) continue;
        if (!shouldKeepAlternate(cols)) continue;
        const altName = cols[3];
        if (altName) onName(geonameId, altName);
    }
}

async function readCities1000(zipPath) {
    const buf = execSync(`unzip -p "${zipPath}" cities1000.txt`, { maxBuffer: 64 * 1024 * 1024 });
    const cities = [];
    for (const line of buf.toString('utf8').split('\n')) {
        if (!line) continue;
        const row = parseCitiesLine(line);
        if (row) cities.push(row);
    }
    return cities;
}

function writeShards(outDir, places, keyMap) {
    mkdirSync(outDir, { recursive: true });
    mkdirSync(join(outDir, 'index'), { recursive: true });

    writeFileSync(join(outDir, 'places.json'), JSON.stringify(places));

    const indexShards = {};
    let keyCount = 0;
    for (const [shardId, entries] of keyMap.entries()) {
        entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        const keys = [];
        const placeIndexes = [];
        for (const [k, idx] of entries) {
            keys.push(k);
            placeIndexes.push(idx);
            keyCount++;
        }
        const fileName = `index/${shardId}.json`;
        indexShards[shardId] = fileName;
        writeFileSync(join(outDir, fileName), JSON.stringify({ keys, placeIndexes }));
    }

    const manifest = {
        version: 1,
        attribution: ATTRIBUTION_TEXT,
        license: 'CC-BY-4.0',
        geonamesUrl: 'https://www.geonames.org/',
        builtAt: new Date().toISOString(),
        placeCount: places.length,
        keyCount,
        places: 'places.json',
        indexShards,
    };
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest));
    return { keyCount };
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

        addKey(acc, city.name, placeIndex);
        if (city.asciiName && city.asciiName !== city.name) {
            addKey(acc, city.asciiName, placeIndex);
        }
        const altLimit = city.population >= 50_000 ? 32 : city.population >= 5_000 ? 12 : 4;
        if (city.alternates) {
            const alts = city.alternates.split(',');
            const limit = Math.min(alts.length, altLimit);
            for (let i = 0; i < limit; i++) {
                const trimmed = alts[i].trim();
                if (trimmed) addKey(acc, trimmed, placeIndex);
            }
        }
    }

    console.log('[atlas:build] Streaming alternate names for cities1000…');
    await streamAlternateNames(altZip, geonameIds, (geonameId, altName) => {
        const placeIndex = placeIndexByGeoname.get(geonameId);
        if (placeIndex === undefined) return;
        const pop = places[placeIndex][6];
        if (pop < 5_000 && !hasIndicScript(altName)) return;
        addKey(acc, altName, placeIndex);
    });

    const { keyCount } = writeShards(outDir, places, acc.keyMap);
    console.log(`[atlas:build] Wrote ${places.length} places, ${keyCount} keys → ${outDir}`);
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
    console.log(`[atlas:build] Total data size: ${mb} MB`);
    if (bytes > 26 * 1024 * 1024) {
        console.warn('[atlas:build] Warning: output exceeds ~25 MB web budget');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
