/**
 * Copy the offline GeoNames gazetteer into apps/web/public/atlas.
 * Rebuild when the index version or the builder sources change.
 * Existence of manifest.json alone is not enough: a format bump must
 * recompile even if a previous index is already on disk.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_VERSION = 2;
const FORMAT_SOURCES = ['scripts/build.mjs', 'scripts/normalize.mjs'];

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(webRoot, '../..');
const atlasRoot = join(repoRoot, 'packages/atlas');
const dataDir = join(atlasRoot, 'data');
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

const expectedHash = formatHash();
const stamped = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : '';
const version = readManifestVersion();
const stale = version !== EXPECTED_VERSION || stamped !== expectedHash;

if (stale) {
    console.log(
        `stage-atlas: rebuilding gazetteer (version ${version ?? 'missing'} → ${EXPECTED_VERSION}, stamp ${stamped ? 'mismatch' : 'missing'})…`,
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

if (!existsSync(manifestPath) || readManifestVersion() !== EXPECTED_VERSION) {
    console.error('stage-atlas: manifest.json missing or wrong version after build');
    process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(dataDir, dest, { recursive: true });
console.log(`stage-atlas: copied gazetteer v${EXPECTED_VERSION} to public/atlas/`);
