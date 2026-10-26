import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const requireFromCore = createRequire(
    join(fileURLToPath(new URL('.', import.meta.url)), '../../packages/core/package.json'),
);

function packageRoot(pkg: string): string {
    return dirname(requireFromCore.resolve(`${pkg}/package.json`));
}

const IMPORT_MAP: Record<string, string> = {
    '@node-jhora/core/browser': '/pkg/core/browser/index.js',
    '@node-jhora/core': '/pkg/core/index.js',
    '@node-jhora/analytics': '/pkg/analytics/index.js',
    '@node-jhora/prediction': '/pkg/prediction/index.js',
    '@node-jhora/engine/browser/worker-api': '/pkg/engine/browser/worker-api.js',
    '@node-jhora/engine/browser': '/pkg/engine/browser/index.js',
    '@node-jhora/engine': '/pkg/engine/index.js',
    luxon: '/pkg/vendor/luxon/luxon.js',
    'decimal.js': '/pkg/vendor/decimal.js/decimal.mjs',
    zod: '/pkg/vendor/zod/index.js',
    comlink: '/pkg/vendor/comlink/dist/esm/comlink.mjs',
};

const VENDOR_ROOTS: Record<string, string> = {
    '/pkg/vendor/luxon': join(packageRoot('luxon'), 'src'),
    '/pkg/vendor/zod': packageRoot('zod'),
    '/pkg/vendor/decimal.js': packageRoot('decimal.js'),
    '/pkg/vendor/comlink': packageRoot('comlink'),
};

export function pkgDistServePlugin(repoRoot: string): Plugin {
    function mount(server: {
        middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void };
    }) {
        server.middlewares.use((req, res, next) => {
            const url = req.url?.split('?')[0] ?? '';
            for (const [prefix, root] of Object.entries(VENDOR_ROOTS)) {
                if (url === prefix || url.startsWith(`${prefix}/`)) {
                    const rel = normalize(url.slice(prefix.length + 1) || '.');
                    if (rel.startsWith('..')) {
                        res.statusCode = 403;
                        res.end('Forbidden');
                        return;
                    }
                    const file = join(root, rel === '.' ? 'index.js' : rel);
                    if (!existsSync(file)) {
                        next();
                        return;
                    }
                    res.setHeader('Content-Type', 'application/javascript');
                    res.end(rewriteBareImports(readFileSync(file, 'utf8')));
                    return;
                }
            }
            const match = url.match(/^\/pkg\/(core|engine|analytics|prediction)\/(.*)$/);
            if (!match) {
                next();
                return;
            }
            const rel = normalize(match[2]);
            if (rel.startsWith('..')) {
                res.statusCode = 403;
                res.end('Forbidden');
                return;
            }
            const file = join(repoRoot, 'packages', match[1], 'dist', rel);
            if (!existsSync(file)) {
                next();
                return;
            }
            res.setHeader('Content-Type', 'application/javascript');
            let body = readFileSync(file, 'utf8');
            body = rewriteBareImports(body);
            res.end(body);
        });
    }

    function rewriteBareImports(source: string): string {
        const map: Record<string, string> = {
            luxon: '/pkg/vendor/luxon/luxon.js',
            'decimal.js': '/pkg/vendor/decimal.js/decimal.mjs',
            zod: '/pkg/vendor/zod/index.js',
            '@node-jhora/core/browser': '/pkg/core/browser/index.js',
            '@node-jhora/core': '/pkg/core/index.js',
            '@node-jhora/analytics': '/pkg/analytics/index.js',
            '@node-jhora/prediction': '/pkg/prediction/index.js',
            '@node-jhora/engine/browser/worker-api': '/pkg/engine/browser/worker-api.js',
            '@node-jhora/engine/browser': '/pkg/engine/browser/index.js',
            '@node-jhora/engine': '/pkg/engine/index.js',
        };
        let out = source;
        for (const [bare, url] of Object.entries(map)) {
            out = out.replaceAll(`from '${bare}'`, `from '${url}'`);
            out = out.replaceAll(`from "${bare}"`, `from "${url}"`);
        }
        return out;
    }

    return {
        name: 'pkg-dist-serve',
        configureServer: mount,
        configurePreviewServer: mount,
        transformIndexHtml(html) {
            return html.replace(
                '<head>',
                `<head>\n        <script type="importmap">${JSON.stringify({ imports: IMPORT_MAP }, null, 2)}</script>`,
            );
        },
    };
}
