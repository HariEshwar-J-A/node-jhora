import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DOCS_APP_ROOT, REPO_ROOT } from './lib/paths.mjs';

const ENTRY_PACKAGES = [
  'core',
  'analytics',
  'prediction',
  'match',
  'events',
  'reporting',
  'api',
];

const OUT_DIR = path.join(DOCS_APP_ROOT, 'public', 'api-reference');

export async function generateApi() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const entryPoints = ENTRY_PACKAGES.map((pkg) =>
    path.join(REPO_ROOT, 'packages', pkg, 'src', 'index.ts'),
  );

  const typedocJson = {
    $schema: 'https://typedoc.org/schema.json',
    name: 'Node-Jhora API',
    entryPoints,
    entryPointStrategy: 'resolve',
    out: OUT_DIR,
    readme: 'none',
    sort: ['source-order'],
    skipErrorChecking: true,
    tsconfig: path.join(REPO_ROOT, 'tsconfig.json'),
  };

  const configPath = path.join(DOCS_APP_ROOT, '.typedoc-temp.json');
  await fs.writeFile(configPath, JSON.stringify(typedocJson, null, 2));

  await new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      ['exec', 'typedoc', '--options', configPath],
      { cwd: DOCS_APP_ROOT, stdio: 'inherit', shell: false },
    );
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`typedoc exit ${code}`))));
  });

  await fs.unlink(configPath).catch(() => {});
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateApi().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
