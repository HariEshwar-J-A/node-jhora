import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { SITE_BASE_PATH, SITE_CANONICAL } from './site.mjs';
import { forceNodeShimsPlugin, nodeStubPlugin } from './vite-node-stub.js';

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, '../..');
const outDir = join(root, 'dist/astrology');

/**
 * Serve atlas shards as the raw gzip bytes. Vite's static handler would set
 * Content-Encoding: gzip, and fetch() would then stream the inflated body
 * while Content-Length stayed compressed — the progress percent would hit
 * 100 before the shard finished. The host must serve the stored bytes
 * with no Content-Encoding.
 */
function atlasRawGzipPlugin(): Plugin {
    const attach = (rootDir: string) => {
        return (
            req: { url?: string },
            res: NodeJS.WritableStream & {
                statusCode?: number;
                setHeader: (name: string, value: string) => void;
            },
            next: () => void,
        ) => {
            const path = req.url?.split('?')[0] ?? '';
            const match = path.match(
                /\/atlas\/((?:v\d+-[a-f0-9]+\/)?index\/[a-z0-9-]+\.json\.gz)$/,
            );
            if (!match || match[1].includes('..')) {
                next();
                return;
            }
            const file = join(rootDir, 'atlas', match[1]);
            if (!existsSync(file)) {
                next();
                return;
            }
            const size = statSync(file).size;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', String(size));
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            createReadStream(file).pipe(res);
        };
    };
    return {
        name: 'atlas-raw-gzip',
        configureServer(server) {
            server.middlewares.use(attach(join(root, 'public')));
        },
        configurePreviewServer(server) {
            server.middlewares.use(attach(outDir));
        },
    };
}

/**
 * `.bsp` is not a type Vite knows. Serve it as binary so a preview matches
 * the Vercel header (and so `nosniff` cannot blank the kernel).
 */
function kernelTypePlugin(): Plugin {
    const attach = (rootDir: string) => {
        return (
            req: { url?: string },
            res: NodeJS.WritableStream & {
                statusCode?: number;
                setHeader: (name: string, value: string) => void;
            },
            next: () => void,
        ) => {
            const path = req.url?.split('?')[0] ?? '';
            const marker = '/ephe/';
            const at = path.indexOf(marker);
            if (at < 0 || !path.endsWith('.bsp')) {
                next();
                return;
            }
            const name = path.slice(at + marker.length);
            if (name.includes('..') || name.includes('/')) {
                next();
                return;
            }
            const file = join(rootDir, 'ephe', name);
            if (!existsSync(file)) {
                next();
                return;
            }
            const size = statSync(file).size;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', String(size));
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            createReadStream(file).pipe(res);
        };
    };
    return {
        name: 'kernel-content-type',
        configureServer(server) {
            server.middlewares.use(attach(join(root, 'public')));
        },
        configurePreviewServer(server) {
            server.middlewares.use(attach(outDir));
        },
    };
}

/** Canonical, robots, sitemap, manifest, and 404 all come from site.mjs. */
function siteFilesPlugin(): Plugin {
    const notFound = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>Page not found — node-jhora</title>
        <link rel="canonical" href="${SITE_CANONICAL}" />
        <meta http-equiv="refresh" content="0;url=${SITE_BASE_PATH}" />
        <link rel="icon" href="${SITE_BASE_PATH}favicon.svg" type="image/svg+xml" />
    </head>
    <body>
        <p><a href="${SITE_BASE_PATH}">node-jhora</a></p>
    </body>
</html>
`;
    const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_CANONICAL}/sitemap.xml\n`;
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>${SITE_CANONICAL}/</loc></url>
</urlset>
`;
    const manifest = JSON.stringify(
        {
            name: 'node-jhora',
            short_name: 'node-jhora',
            start_url: SITE_BASE_PATH,
            scope: SITE_BASE_PATH,
            display: 'standalone',
            background_color: '#09090b',
            theme_color: '#09090b',
            icons: [{ src: `${SITE_BASE_PATH}favicon.svg`, type: 'image/svg+xml', sizes: 'any' }],
        },
        null,
        2,
    );
    return {
        name: 'site-files',
        buildStart() {
            rmSync(join(root, 'dist'), { recursive: true, force: true });
        },
        transformIndexHtml(html) {
            return html.replaceAll('__SITE_CANONICAL__', SITE_CANONICAL);
        },
        closeBundle() {
            mkdirSync(outDir, { recursive: true });
            writeFileSync(join(outDir, 'robots.txt'), robots);
            writeFileSync(join(outDir, 'sitemap.xml'), sitemap);
            writeFileSync(join(outDir, 'site.webmanifest'), `${manifest}\n`);
            writeFileSync(join(outDir, '404.html'), notFound);
            writeFileSync(join(root, 'dist/404.html'), notFound);
        },
    };
}

export default defineConfig({
    base: SITE_BASE_PATH,
    root,
    plugins: [
        atlasRawGzipPlugin(),
        kernelTypePlugin(),
        siteFilesPlugin(),
        forceNodeShimsPlugin(),
        nodeStubPlugin(),
        react(),
    ],
    resolve: {
        alias: {
            '@': join(root, 'src'),
            'spk-node.js': join(root, 'src/shims/spk-node-stub.ts'),
            'node:fs/promises': join(root, 'src/shims/node-empty.ts'),
            'node:fs': join(root, 'src/shims/node-empty.ts'),
            'node:path': join(root, 'src/shims/node-empty.ts'),
            'node:module': join(root, 'src/shims/node-empty.ts'),
        },
        dedupe: ['react', 'react-dom'],
    },
    build: {
        outDir: 'dist/astrology',
        emptyOutDir: true,
        target: 'es2022',
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
            external: [],
            output: {
                manualChunks(id) {
                    if (
                        id.includes('node_modules/react') ||
                        id.includes('node_modules/react-dom')
                    ) {
                        return 'react';
                    }
                    if (id.includes('node_modules/react-router')) return 'router';
                    if (id.includes('node_modules/framer-motion')) return 'motion';
                    if (id.includes('node_modules/three') || id.includes('runSpaceScene')) {
                        return 'three';
                    }
                    if (id.includes('packages/core/dist')) return 'njh-core';
                    if (id.includes('packages/prediction/dist')) return 'njh-prediction';
                    if (id.includes('packages/analytics/dist')) return 'njh-analytics';
                    if (id.includes('packages/engine/dist')) return 'njh-engine';
                    if (id.includes('packages/match/dist')) return 'njh-match';
                    if (id.includes('packages/events/dist')) return 'njh-events';
                    return undefined;
                },
            },
        },
    },
    worker: {
        format: 'es',
        rollupOptions: {
            output: {
                sourcemap: false,
            },
        },
        plugins: () => [forceNodeShimsPlugin(), nodeStubPlugin()],
    },
    server: {
        port: 5180,
        strictPort: true,
        fs: { allow: [repoRoot] },
    },
    preview: {
        host: '127.0.0.1',
        port: Number(process.env.PORT) || 4173,
        strictPort: false,
    },
    optimizeDeps: {
        exclude: [
            '@node-jhora/core',
            '@node-jhora/core/browser',
            '@node-jhora/engine',
            '@node-jhora/analytics',
            '@node-jhora/prediction',
            '@node-jhora/match',
            '@node-jhora/events',
            '@node-jhora/format',
        ],
    },
});
