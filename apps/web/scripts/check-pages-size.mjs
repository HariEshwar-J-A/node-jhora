/**
 * GitHub Pages accepts files up to 100 MB and sites up to 1 GB.
 * The exhaustive cities1000 atlas is expected to pass 25 MB; that is logged,
 * not warned. Fail only when a file exceeds 100 MB or the site is no longer
 * well under 1 GB.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const FILE_LIMIT = 100 * 1024 * 1024;
const SITE_LIMIT = 900 * 1024 * 1024;

const files = [];

function walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        const st = statSync(path);
        if (st.isDirectory()) walk(path);
        else files.push({ path, size: st.size });
    }
}

walk(dist);

let total = 0;
let atlas = 0;
let largest = files[0];
let failed = false;
for (const file of files) {
    total += file.size;
    if (file.path.includes(`${join('dist', 'atlas')}`) || file.path.includes('/atlas/')) {
        atlas += file.size;
    }
    if (!largest || file.size > largest.size) largest = file;
    if (file.size > FILE_LIMIT) {
        console.error(
            `[pages] ${relative(dist, file.path)} is ${(file.size / (1024 * 1024)).toFixed(1)} MB (limit 100 MB)`,
        );
        failed = true;
    }
}

const mb = (total / (1024 * 1024)).toFixed(2);
const atlasMb = (atlas / (1024 * 1024)).toFixed(2);
console.log(
    `[pages] Site ${mb} MB, atlas ${atlasMb} MB. A site above 25 MB is expected (DE440s kernel plus the exhaustive cities1000 atlas) and is not a budget warning.`,
);
if (largest) {
    console.log(
        `[pages] Largest file ${relative(dist, largest.path)} ${(largest.size / (1024 * 1024)).toFixed(2)} MB`,
    );
}
if (total > SITE_LIMIT) {
    console.error(
        `[pages] Site is ${mb} MB, above 900 MB. GitHub Pages must stay well under 1 GB.`,
    );
    failed = true;
}
if (failed) process.exit(1);
