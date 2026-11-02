import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(webRoot, '../..');

export default async function globalSetup() {
    execSync('pnpm build', { cwd: repoRoot, stdio: 'inherit' });
    execSync('pnpm --filter @node-jhora/web build', { cwd: repoRoot, stdio: 'inherit' });
}
