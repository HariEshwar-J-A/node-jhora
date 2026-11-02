import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { forceNodeShimsPlugin, nodeStubPlugin } from './vite-node-stub.js';

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, '../..');

/**
 * Serve atlas shards as the raw gzip bytes. Vite's static handler would set
 * Content-Encoding: gzip, and fetch() would then stream the inflated body
 * while Content-Length stayed compressed — the progress percent would hit
 * 100 before the shard finished. GitHub Pages serves the file bytes as stored.
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
            const marker = '/atlas/index/';
            const at = path.indexOf(marker);
            if (at < 0 || !path.endsWith('.json.gz')) {
                next();
                return;
            }
            const name = path.slice(at + marker.length);
            if (name.includes('..') || name.includes('/')) {
                next();
                return;
            }
            const file = join(rootDir, 'atlas', 'index', name);
            if (!existsSync(file)) {
                next();
                return;
            }
            const size = statSync(file).size;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', String(size));
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            createReadStream(file).pipe(res);
        };
    };
    return {
        name: 'atlas-raw-gzip',
        configureServer(server) {
            server.middlewares.use(attach(join(root, 'public')));
        },
        configurePreviewServer(server) {
            server.middlewares.use(attach(join(root, 'dist')));
        },
    };
}

export default defineConfig({
    base: '/node-jhora/',
    root,
    plugins: [atlasRawGzipPlugin(), forceNodeShimsPlugin(), nodeStubPlugin(), react()],
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
