import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(root, '../..');
const src = join(repoRoot, 'packages/ephe/de440s.bsp');
const destDir = join(root, 'public/ephe');
const dest = join(destDir, 'de440s.bsp');

if (!existsSync(src)) {
    console.warn('stage-ephe: de440s.bsp missing; run pnpm install at repo root');
    process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('stage-ephe: copied de440s.bsp to public/ephe/');
