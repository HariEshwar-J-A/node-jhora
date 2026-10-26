import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** `./packages/events` and `./packages/events/tsconfig.json` both become `packages/events`. */
function referencePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/tsconfig\.json$/, '').replace(/\/$/, '');
}

describe('TypeScript project references', () => {
    it('references every packages/*/tsconfig.json from the root tsconfig', () => {
        const packagesDir = join(repoRoot, 'packages');
        const packagesWithTsconfig = readdirSync(packagesDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && existsSync(join(packagesDir, entry.name, 'tsconfig.json')))
            .map((entry) => `packages/${entry.name}`)
            .sort();

        const root = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.json'), 'utf8')) as {
            references?: { path: string }[];
        };
        const referenced = new Set((root.references ?? []).map((ref) => referencePath(ref.path)));

        const missing = packagesWithTsconfig.filter((pkg) => !referenced.has(pkg));
        expect(missing).toEqual([]);
    });
});
