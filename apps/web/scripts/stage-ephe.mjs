import { createHash } from 'node:crypto';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DE440S_BYTES, DE440S_SHA256 } from '../../../packages/ephe/constants.mjs';
import { KERNEL_FILENAME } from '../site.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '../..');
const src = join(repoRoot, 'packages/ephe/de440s.bsp');
const destDir = join(root, 'public/ephe');
const dest = join(destDir, KERNEL_FILENAME);

function verify(path) {
    if (!existsSync(path)) return 'missing';
    const size = statSync(path).size;
    if (size !== DE440S_BYTES) return `wrong size (${size} bytes, expected ${DE440S_BYTES})`;
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (digest !== DE440S_SHA256) return `sha256 mismatch (${digest})`;
    return null;
}

// The web prebuild runs packages/ephe/download.mjs first, which restores or
// fetches the kernel. A site without a verified kernel cannot calculate, so
// this step fails the build instead of shipping one.
const srcProblem = verify(src);
if (srcProblem) {
    console.error(`stage-ephe: packages/ephe/de440s.bsp ${srcProblem}.`);
    console.error('  Run `node packages/ephe/download.mjs` at the repo root, then rebuild.');
    process.exit(1);
}

mkdirSync(destDir, { recursive: true });
for (const name of readdirSync(destDir)) {
    if (name.endsWith('.bsp') && name !== KERNEL_FILENAME) {
        unlinkSync(join(destDir, name));
    }
}
copyFileSync(src, dest);
const destProblem = verify(dest);
if (destProblem) {
    console.error(`stage-ephe: staged ${KERNEL_FILENAME} ${destProblem}.`);
    process.exit(1);
}
console.log(`stage-ephe: copied ${KERNEL_FILENAME} to public/ephe/`);
