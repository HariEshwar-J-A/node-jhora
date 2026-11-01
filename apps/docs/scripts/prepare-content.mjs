/**
 * Build-time sync: canonical Markdown under the repo root → Starlight content.
 * Sources are not duplicated in git; this script runs before dev/build.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, CONTENT_DOCS, GENERATED_GUIDES } from './lib/paths.mjs';

const DOC_SLUG = (basename) => basename.replace(/\.md$/i, '').toLowerCase().replace(/_/g, '-');

/** Map repo doc basename → Starlight URL path (no trailing slash). */
const slugToUrl = new Map();

function registerSlug(basename) {
    const slug = DOC_SLUG(basename);
    const url = basename === 'README.md' ? '/getting-started' : `/guides/${slug}`;
    slugToUrl.set(basename.replace(/\.md$/i, '').toUpperCase(), url);
    slugToUrl.set(basename, url);
    return { slug, url };
}

function decisionSlug(name) {
    const base = name.replace(/\.md$/i, '');
    return `decisions-${base.toLowerCase()}`;
}

export function rewriteLinksForTest(body) {
    return rewriteLinks(body);
}

function rewriteLinks(body) {
    let out = body;
    // README / root docs → site routes
    out = out.replace(/\]\(\.\/README\.md([^)]*)\)/gi, '](/getting-started$1)');
    out = out.replace(/\]\(\.\/CONTRIBUTING\.md([^)]*)\)/gi, '](/guides/contributing$1)');
    out = out.replace(/\]\(\.\/CONFIGURATION\.md([^)]*)\)/gi, '](/guides/configuration$1)');
    // docs/decisions/*.md (ADRs) from the repo root README
    out = out.replace(/\]\(\.\/docs\/decisions\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${decisionSlug(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(\.\/docs\/guides\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
    });
    out = out.replace(
        /\]\(\.\/docs\/getting-started\/([^)/#]+)\.md([^)]*)\)/gi,
        (_, name, anchor) => {
            return `](/getting-started-${DOC_SLUG(name)}${anchor || ''})`;
        },
    );
    // docs/*.md at repo root (accuracy, architecture, …)
    out = out.replace(/\]\(\.\/docs\/([^)#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        const url = `/guides/${DOC_SLUG(name)}${anchor || ''}`;
        return `](${url})`;
    });
    out = out.replace(/\]\(\.\.\/docs\/guides\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(\.\.\/guides\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(\.\/guides\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(\.\.\/decisions\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${decisionSlug(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(\.\.\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        const lower = name.toLowerCase();
        if (lower === 'architecture' || lower === 'accuracy' || lower === 'performance') {
            return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
        }
        if (lower === 'license' || lower === 'contributing') {
            return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
        }
        return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(\.\.\/docs\/([^)#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        const url = `/guides/${DOC_SLUG(name)}${anchor || ''}`;
        return `](${url})`;
    });
    // Cross-links between files in docs/ (e.g. ./GOLDENS.md)
    out = out.replace(/\]\(\.\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        const lower = name.toLowerCase();
        if (lower === 'readme') return `](/getting-started${anchor || ''})`;
        if (lower === 'contributing') return `](/guides/contributing${anchor || ''})`;
        if (lower === 'configuration') return `](/guides/configuration${anchor || ''})`;
        if (['node', 'bun', 'deno', 'edge-workers', 'browser'].includes(lower)) {
            return `](/getting-started-${lower}${anchor || ''})`;
        }
        return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(([A-Za-z0-9_-]+)\.md([^)]*)\)/gi, (match, name, anchor) => {
        if (match.includes('://') || match.includes('/')) return match;
        const url = `/guides/${DOC_SLUG(name)}${anchor || ''}`;
        return `](${url})`;
    });
    out = out.replace(/\]\(decisions\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${decisionSlug(name)}${anchor || ''})`;
    });
    out = out.replace(/\]\(\.\.\/CLEAN_ROOM\.md([^)]*)\)/gi, (_, anchor) => {
        return `](/guides/clean-room${anchor || ''})`;
    });
    out = out.replace(/\]\(docs\/([^)/#]+)\.md([^)]*)\)/gi, (_, name, anchor) => {
        return `](/guides/${DOC_SLUG(name)}${anchor || ''})`;
    });
    // ADR cross-links (0001-record-…)
    out = out.replace(/\]\((\d{4}-[a-z0-9-]+)([#][^)]*)?\)/gi, (_, name, hash) => {
        return `](/guides/${decisionSlug(name)}/${hash || ''})`;
    });
    out = out.replace(/\]\(\/guides\/(\d{4}-[a-z0-9-]+)(\/[^)]*)?\)/gi, (_, name, rest) => {
        return `](/guides/${decisionSlug(name)}${rest || '/'})`;
    });
    out = out.replace(/\]\(\/guides\/readme([^)]*)\)/gi, (_, anchor) => {
        return `](/guides/decisions-readme${anchor || ''})`;
    });
    return out;
}

function frontmatter({ title, description }) {
    const desc = description ? `\ndescription: ${JSON.stringify(description)}` : '';
    return `---\ntitle: ${JSON.stringify(title)}${desc}\n---\n\n`;
}

async function writePage(filePath, title, body, description) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const text = frontmatter({ title, description }) + rewriteLinks(body);
    await fs.writeFile(filePath, text, 'utf8');
}

async function readUtf8(filePath) {
    return fs.readFile(filePath, 'utf8');
}

function titleFromMarkdown(md, fallback) {
    const m = md.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : fallback;
}

async function emptyDir(dir) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
}

export async function prepareContent() {
    await emptyDir(GENERATED_GUIDES);

    const readmePath = path.join(REPO_ROOT, 'README.md');
    const readme = await readUtf8(readmePath);
    registerSlug('README.md');
    await writePage(
        path.join(CONTENT_DOCS, 'getting-started.md'),
        titleFromMarkdown(readme, 'Getting started'),
        readme,
        'Install the SDK, run a first chart, and find package entry points.',
    );

    const extraRoot = ['CONTRIBUTING.md', 'CONFIGURATION.md'];
    for (const name of extraRoot) {
        const full = path.join(REPO_ROOT, name);
        try {
            const body = await readUtf8(full);
            const { slug } = registerSlug(name);
            await writePage(
                path.join(GENERATED_GUIDES, `${slug}.md`),
                titleFromMarkdown(body, slug),
                body,
            );
        } catch {
            // optional
        }
    }

    const docsDir = path.join(REPO_ROOT, 'docs');

    async function syncDocFile(full, relFromDocs) {
        const body = await readUtf8(full);
        const base = path.basename(full);
        let slug;
        if (relFromDocs.startsWith('getting-started/')) {
            slug = `getting-started-${DOC_SLUG(base)}`;
        } else if (relFromDocs.startsWith('reference/')) {
            slug = `reference-${DOC_SLUG(base)}`;
        } else {
            slug = DOC_SLUG(base);
        }
        const outDir = relFromDocs.startsWith('getting-started/') ? CONTENT_DOCS : GENERATED_GUIDES;
        const outName =
            base.toLowerCase() === 'readme.md' && relFromDocs === 'README.md'
                ? 'documentation-index.md'
                : `${slug}.md`;
        await writePage(path.join(outDir, outName), titleFromMarkdown(body, slug), body);
    }

    async function walkDocs(dir, rel = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (ent.name === 'decisions') continue;
            const relPath = rel ? `${rel}/${ent.name}` : ent.name;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                await walkDocs(full, relPath);
                continue;
            }
            if (!ent.name.endsWith('.md')) continue;
            await syncDocFile(full, relPath);
        }
    }

    await walkDocs(docsDir);

    // decisions/*.md
    const decisionsDir = path.join(docsDir, 'decisions');
    try {
        const decisions = await fs.readdir(decisionsDir);
        for (const name of decisions.sort()) {
            if (!name.endsWith('.md')) continue;
            const body = await readUtf8(path.join(decisionsDir, name));
            const slug = `decisions-${DOC_SLUG(name)}`;
            await writePage(
                path.join(GENERATED_GUIDES, `${slug}.md`),
                titleFromMarkdown(body, name),
                body,
            );
        }
    } catch {
        // no decisions dir
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    prepareContent().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
