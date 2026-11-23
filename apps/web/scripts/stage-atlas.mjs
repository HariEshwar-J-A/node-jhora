/**
 * Copy the offline GeoNames gazetteer into apps/web/public/atlas.
 * Rebuild when the index version or the builder sources change.
 * Existence of manifest.json alone is not enough: a format bump must
 * recompile even if a previous index is already on disk.
 *
 * The published shard paths are prefixed with v<version>-<formatHash> so
 * the CDN can cache them immutably. The builder's own data/ layout stays
 * unversioned (library tests resolve index/<id>.json.gz).
 *
 * A verified build is stored under .vercel/cache, keyed by version and
 * format hash. GeoNames zip inputs are stored beside it so a format bump
 * can rebuild without hitting GeoNames again.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    readCachedDir,
    readCachedFile,
    writeCachedDir,
    writeCachedFile,
} from '../../../scripts/build-cache.mjs';

const EXPECTED_VERSION = 2;
const FORMAT_SOURCES = ['scripts/build.mjs', 'scripts/normalize.mjs'];
const GEONAMES_FILES = [
    'cities1000.zip',
    'admin1CodesASCII.txt',
    'alternateNamesV2.zip',
    'timeZones.txt',
];

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(webRoot, '../..');
const atlasRoot = join(repoRoot, 'packages/atlas');
const dataDir = join(atlasRoot, 'data');
const dumpDir = join(atlasRoot, '.cache');
const manifestPath = join(dataDir, 'manifest.json');
const stampPath = join(dataDir, '.format-stamp');
const dest = join(webRoot, 'public/atlas');

function formatHash() {
    const hash = createHash('sha256');
    hash.update(String(EXPECTED_VERSION));
    for (const rel of FORMAT_SOURCES) {
        hash.update(readFileSync(join(atlasRoot, rel)));
    }
    return hash.digest('hex').slice(0, 20);
}

function readManifestVersion() {
    if (!existsSync(manifestPath)) return null;
    try {
        const doc = JSON.parse(readFileSync(manifestPath, 'utf8'));
        return typeof doc.version === 'number' ? doc.version : null;
    } catch {
        return null;
    }
}

function isFresh() {
    const stamped = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : '';
    return readManifestVersion() === EXPECTED_VERSION && stamped === expectedHash;
}

const expectedHash = formatHash();
const dataKey = `atlas/data/v${EXPECTED_VERSION}-${expectedHash}`;
const dumpKey = 'atlas/geonames';

if (!isFresh()) {
    const cached = readCachedDir(dataKey);
    if (cached) {
        rmSync(dataDir, { recursive: true, force: true });
        mkdirSync(dataDir, { recursive: true });
        cpSync(cached, dataDir, { recursive: true });
        console.log(`stage-atlas: restored gazetteer from build cache (${dataKey}).`);
    }
}

if (!isFresh()) {
    let restoredDumps = 0;
    mkdirSync(dumpDir, { recursive: true });
    for (const name of GEONAMES_FILES) {
        const from = readCachedFile(dumpKey, name);
        const to = join(dumpDir, name);
        if (from && !existsSync(to)) {
            cpSync(from, to);
            restoredDumps += 1;
        }
    }
    if (restoredDumps > 0) {
        console.log('stage-atlas: restored GeoNames inputs from build cache.');
    }
    console.log(
        `stage-atlas: rebuilding gazetteer (version ${readManifestVersion() ?? 'missing'} → ${EXPECTED_VERSION})…`,
    );
    const result = spawnSync(process.execPath, ['scripts/build.mjs'], {
        cwd: atlasRoot,
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        console.error('stage-atlas: gazetteer build failed');
        process.exit(result.status ?? 1);
    }
    writeFileSync(stampPath, `${expectedHash}\n`);
}

if (!isFresh()) {
    console.error('stage-atlas: manifest.json missing or wrong version after build');
    process.exit(1);
}

writeCachedDir(dataKey, dataDir);
for (const name of GEONAMES_FILES) {
    const file = join(dumpDir, name);
    if (existsSync(file)) writeCachedFile(dumpKey, name, file);
}

const prefix = `v${EXPECTED_VERSION}-${expectedHash}`;
const source = JSON.parse(readFileSync(manifestPath, 'utf8'));
const indexShards = {};
for (const [id, rel] of Object.entries(source.indexShards ?? {})) {
    if (typeof rel !== 'string' || rel.includes('..') || rel.startsWith('/')) {
        console.error(`stage-atlas: refusing shard path for ${id}`);
        process.exit(1);
    }
    indexShards[id] = `${prefix}/${rel}`;
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, prefix), { recursive: true });
cpSync(join(dataDir, 'index'), join(dest, prefix, 'index'), { recursive: true });
writeFileSync(join(dest, 'manifest.json'), JSON.stringify({ ...source, indexShards }));
console.log(`stage-atlas: published gazetteer ${prefix} to public/atlas/`);
