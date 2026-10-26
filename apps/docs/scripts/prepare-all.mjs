import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareContent } from './prepare-content.mjs';
import { generateCatalogues } from './generate-catalogues.mjs';
import { generateApi } from './generate-api.mjs';
import { CONTENT_DOCS } from './lib/paths.mjs';

// Remove stale TypeDoc markdown output if a previous build left it behind.
await fs.rm(path.join(CONTENT_DOCS, 'api'), { recursive: true, force: true });
await fs.rm(path.join(CONTENT_DOCS, 'reference'), { recursive: true, force: true });

await prepareContent();
await generateCatalogues();
await generateApi();
