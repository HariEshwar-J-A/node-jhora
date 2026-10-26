import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DOCS_APP_ROOT = path.resolve(here, '..', '..');
export const REPO_ROOT = path.resolve(DOCS_APP_ROOT, '..', '..');
export const CONTENT_DOCS = path.join(DOCS_APP_ROOT, 'src', 'content', 'docs');
export const GENERATED_GUIDES = path.join(CONTENT_DOCS, 'guides');
export const GENERATED_CATALOGUES = path.join(CONTENT_DOCS, 'catalogues');
export const TYPEDOC_HTML = path.join(DOCS_APP_ROOT, 'public', 'api-reference');
