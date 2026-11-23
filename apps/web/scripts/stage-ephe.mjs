import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNEL_FILENAME } from '../site.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '../..');
const src = join(repoRoot, 'packages/ephe/de440s.bsp');
const destDir = join(root, 'public/ephe');
const dest = join(destDir, KERNEL_FILENAME);

if (!existsSync(src)) {
    console.warn('stage-ephe: de440s.bsp missing; run pnpm install at repo root');
    process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const name of readdirSync(destDir)) {
    if (name.endsWith('.bsp') && name !== KERNEL_FILENAME) {
        unlinkSync(join(destDir, name));
    }
}
copyFileSync(src, dest);
console.log(`stage-ephe: copied ${KERNEL_FILENAME} to public/ephe/`);
