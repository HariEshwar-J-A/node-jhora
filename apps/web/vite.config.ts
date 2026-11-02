import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { forceNodeShimsPlugin, nodeStubPlugin } from './vite-node-stub.js';

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, '../..');

export default defineConfig({
    base: '/node-jhora/',
    root,
    plugins: [forceNodeShimsPlugin(), nodeStubPlugin(), react()],
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
                    if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
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
