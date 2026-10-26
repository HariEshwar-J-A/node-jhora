import { createReadStream, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { pkgDistServePlugin } from './vite-pkg-serve.js';

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, '../..');
const ephePath = join(repoRoot, 'packages/ephe/de440s.bsp');

export default defineConfig({
    root,
    server: {
        port: 5173,
        strictPort: true,
        fs: { allow: [join(root, '../..')] },
    },
    preview: {
        port: 4173,
        strictPort: true,
    },
    build: {
        target: 'es2022',
        minify: false,
        rollupOptions: {
            input: {
                main: join(root, 'index.html'),
            },
        },
    },
    plugins: [
        pkgDistServePlugin(repoRoot),
        {
            name: 'serve-de440s',
            configureServer(server) {
                server.middlewares.use('/ephe/de440s.bsp', (_req, res, next) => {
                    if (!existsSync(ephePath)) {
                        next();
                        return;
                    }
                    res.setHeader('Content-Type', 'application/octet-stream');
                    createReadStream(ephePath).pipe(res);
                });
            },
            configurePreviewServer(server) {
                server.middlewares.use('/ephe/de440s.bsp', (_req, res, next) => {
                    if (!existsSync(ephePath)) {
                        next();
                        return;
                    }
                    res.setHeader('Content-Type', 'application/octet-stream');
                    createReadStream(ephePath).pipe(res);
                });
            },
        },
    ],
    resolve: {
        alias: [
            {
                find: /spk-node\.js$/,
                replacement: './src/stubs/spk-node-stub.ts',
            },
            {
                find: '@node-jhora/engine/browser/worker-api',
                replacement: join(repoRoot, 'packages/engine/dist/browser/worker-api.js'),
            },
            {
                find: '@node-jhora/engine/browser/worker-entry',
                replacement: join(repoRoot, 'packages/engine/dist/browser/worker-entry.js'),
            },
            {
                find: '@node-jhora/core/browser',
                replacement: join(repoRoot, 'packages/core/dist/browser/index.js'),
            },
            {
                find: '@node-jhora/engine/browser',
                replacement: join(repoRoot, 'packages/engine/dist/browser/index.js'),
            },
            {
                find: '@node-jhora/core',
                replacement: join(repoRoot, 'packages/core/dist/index.js'),
            },
            {
                find: '@node-jhora/analytics',
                replacement: join(repoRoot, 'packages/analytics/dist/index.js'),
            },
            {
                find: '@node-jhora/prediction',
                replacement: join(repoRoot, 'packages/prediction/dist/index.js'),
            },
            {
                find: '@node-jhora/engine',
                replacement: join(repoRoot, 'packages/engine/dist/index.js'),
            },
        ],
    },
    worker: {
        format: 'es',
    },
});
