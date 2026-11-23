/**
 * Keep the DE440s kernel and the atlas between Vercel builds.
 *
 * Vercel restores `.vercel/cache` before install and build. There is no
 * vercel.json field for extra paths, and the static builder does not promise
 * to keep `node_modules`. Files written under `.vercel/cache` (other than
 * pnpm's own cache) are the documented way to persist them.
 *
 * A second copy under `node_modules/.cache` is read and written so a runner
 * that does restore `node_modules` still hits. Callers verify the kernel
 * SHA-256 before trusting a restored file. Directory keys include the atlas
 * version and format hash, so a builder change misses and rebuilds.
 */
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function roots() {
    return [
        join(repoRoot, '.vercel/cache/node-jhora'),
        join(repoRoot, 'node_modules/.cache/node-jhora'),
    ];
}

/** First matching file under either cache root, or null. */
export function readCachedFile(key, name) {
    for (const root of roots()) {
        const path = join(root, key, name);
        if (existsSync(path)) return path;
    }
    return null;
}

/** Copy `src` into both caches. A file already present for this key is kept. */
export function writeCachedFile(key, name, src) {
    for (const root of roots()) {
        const dest = join(root, key, name);
        if (existsSync(dest)) continue;
        const partial = `${dest}.partial`;
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, partial);
        renameSync(partial, dest);
    }
}

/** Directory previously marked complete, or null. */
export function readCachedDir(key) {
    for (const root of roots()) {
        const dir = join(root, key);
        if (existsSync(join(dir, '.complete'))) return dir;
    }
    return null;
}

/** Copy `src` into both caches and mark the copy complete. */
export function writeCachedDir(key, src) {
    for (const root of roots()) {
        const dest = join(root, key);
        if (existsSync(join(dest, '.complete'))) continue;
        rmSync(dest, { recursive: true, force: true });
        mkdirSync(dest, { recursive: true });
        cpSync(src, dest, { recursive: true });
        writeFileSync(join(dest, '.complete'), 'ok\n');
    }
}
