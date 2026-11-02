/**
 * Copy the offline GeoNames gazetteer into apps/web/public/atlas.
 * The raw dumps stay in packages/atlas/.cache/ (gitignored). The built index
 * is also gitignored; this script fetches and compiles it the same way the
 * ephemeris kernel is staged, then the site serves it as a static asset.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(webRoot, '../..');
const atlasRoot = join(repoRoot, 'packages/atlas');
const dataDir = join(atlasRoot, 'data');
const manifest = join(dataDir, 'manifest.json');
const dest = join(webRoot, 'public/atlas');

if (!existsSync(manifest)) {
    console.log('stage-atlas: building @node-jhora/atlas gazetteer (GeoNames CC BY 4.0)…');
    const result = spawnSync(process.execPath, ['scripts/build.mjs'], {
        cwd: atlasRoot,
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        console.error('stage-atlas: gazetteer build failed');
        process.exit(result.status ?? 1);
    }
}

if (!existsSync(manifest)) {
    console.error('stage-atlas: manifest.json missing after build');
    process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(dataDir, dest, { recursive: true });
console.log('stage-atlas: copied gazetteer to public/atlas/');
