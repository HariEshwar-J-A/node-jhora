#!/usr/bin/env node
/**
 * PR5 edge gate: Node reference vs workerd worker using initialize({ kernel }) and
 * in-memory NJCE chunks for year −9999 (window files only, no century BSP).
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';

import { computeEdgeHexReference } from './edge-hex.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'package.json'));
const requireFromCore = createRequire(join(root, 'packages/core/package.json'));
const { DateTime } = requireFromCore('luxon');
const workerdBin = join(root, 'node_modules/workerd/bin/workerd');

function reservePort() {
    return new Promise((resolve, reject) => {
        const probe = createNetServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

async function reservePorts(count) {
    const ports = [];
    for (let i = 0; i < count; i++) {
        ports.push(await reservePort());
    }
    return ports;
}

function loadKernelBytes() {
    return new Uint8Array(readFileSync(join(root, 'packages/ephe/de440s.bsp')));
}

function chunk441Dir() {
    const fromEnv = process.env.NJCE441_DIR;
    if (fromEnv) return fromEnv;
    const dist = join(root, 'packages/ephe441/dist');
    if (!existsSync(join(dist, 'g0-c-100.njce'))) {
        throw new Error(
            'NJCE441 chunks missing (need packages/ephe441/dist for year −9999 window). Set NJCE441_DIR.',
        );
    }
    return dist;
}

function loadNjceWindow(dir, keys) {
    const { njceMapKey } = require(
        join(root, 'packages/core/dist/engine/provider/edge-bootstrap.js'),
    );
    const map = new Map();
    const seen = new Set();
    for (const key of keys) {
        const id = njceMapKey(key.groupId, key.century);
        if (seen.has(id)) continue;
        seen.add(id);
        const file = `g${key.groupId}-c${key.century}.njce`;
        const buf = readFileSync(join(dir, file));
        map.set(id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    }
    return map;
}

async function nodeReference() {
    const coreUrl = pathToFileURL(join(root, 'packages/core/dist/index.js')).href;
    const deltaUrl = pathToFileURL(join(root, 'packages/core/dist/engine/deltat.js')).href;
    const edgeUrl = pathToFileURL(
        join(root, 'packages/core/dist/engine/provider/edge-bootstrap.js'),
    ).href;
    const { EphemerisEngine } = await import(coreUrl);
    const { deltaT } = await import(deltaUrl);
    const { createDe441ChunkStoreFromMemory, de441ChunkKeysForJdTdb, njceMapKey } = await import(
        edgeUrl
    );
    const dir = chunk441Dir();
    return computeEdgeHexReference({
        loadKernelBytes,
        chunk441Dir: dir,
        DateTime,
        EphemerisEngine,
        deltaT,
        createDe441ChunkStoreFromMemory,
        de441ChunkKeysForJdTdb,
        njceMapKey,
        loadNjceWindow: (d, keys) => loadNjceWindow(d, keys),
    });
}

async function buildDeepChunkManifest() {
    const coreUrl = pathToFileURL(join(root, 'packages/core/dist/index.js')).href;
    const deltaUrl = pathToFileURL(join(root, 'packages/core/dist/engine/deltat.js')).href;
    const edgeUrl = pathToFileURL(
        join(root, 'packages/core/dist/engine/provider/edge-bootstrap.js'),
    ).href;
    const { EphemerisEngine } = await import(coreUrl);
    const { deltaT } = await import(deltaUrl);
    const { de441ChunkKeysForJdTdb, njceMapKey } = await import(edgeUrl);
    const engine = new EphemerisEngine();
    await engine.initialize({ kernel: loadKernelBytes() });
    const instant = DateTime.utc(-9999, 6, 15, 12, 0, 0);
    const jdUt = engine.julday(instant);
    const jdTdb = jdUt + deltaT(jdUt) / 86_400;
    const keys = de441ChunkKeysForJdTdb(jdTdb);
    const chunkDir = chunk441Dir();
    const manifest = [];
    const seen = new Set();
    for (const key of keys) {
        const id = njceMapKey(key.groupId, key.century);
        if (seen.has(id)) continue;
        seen.add(id);
        manifest.push({ id, file: `g${key.groupId}-c${key.century}.njce` });
    }
    return { manifest, chunkDir };
}

function startAssetServer(assetRoot, assetPort) {
    return createServer((req, res) => {
        try {
            const url = new URL(req.url ?? '/', `http://127.0.0.1:${assetPort}`);
            if (url.pathname === '/de440s.bsp') {
                const data = readFileSync(join(assetRoot, 'de440s.bsp'));
                res.writeHead(200, { 'content-type': 'application/octet-stream' });
                res.end(data);
                return;
            }
            if (url.pathname === '/chunks/manifest.json') {
                const data = readFileSync(join(assetRoot, 'chunks/manifest.json'));
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(data);
                return;
            }
            const chunkMatch = url.pathname.match(/^\/chunks\/(g[01]-c-?\d+\.njce)$/);
            if (chunkMatch) {
                const data = readFileSync(join(assetRoot, 'chunks', chunkMatch[1]));
                res.writeHead(200, { 'content-type': 'application/octet-stream' });
                res.end(data);
                return;
            }
            res.writeHead(404);
            res.end('not found');
        } catch (err) {
            res.writeHead(500);
            res.end(err instanceof Error ? err.message : 'internal error');
        }
    }).listen(assetPort, '127.0.0.1');
}

async function bundleWorker(outFile, assetOrigin) {
    const luxonPath = requireFromCore.resolve('luxon');
    await esbuild.build({
        entryPoints: [join(dirname(fileURLToPath(import.meta.url)), 'worker-edge.mjs')],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        outfile: outFile,
        define: {
            __NJH_EDGE_ASSET_ORIGIN__: JSON.stringify(assetOrigin),
        },
        alias: {
            '@node-jhora/core': join(root, 'packages/core/dist/index.js'),
            luxon: luxonPath,
        },
        plugins: [
            {
                name: 'empty-node-builtins',
                setup(build) {
                    const empty = {
                        contents:
                            'export default {}; export const readFileSync = () => { throw new Error("fs unavailable in worker"); }; export const existsSync = () => false;',
                        loader: 'js',
                    };
                    const emptyPromises = {
                        contents:
                            'export const readFile = async () => { throw new Error("fs unavailable in worker"); };',
                        loader: 'js',
                    };
                    const emptyPath = {
                        contents:
                            'export const join = (...p) => p.join("/"); export default { join };',
                        loader: 'js',
                    };
                    build.onResolve({ filter: /^(node:)?fs$/ }, () => ({
                        path: 'empty-fs',
                        namespace: 'shim',
                    }));
                    build.onResolve({ filter: /^(node:)?fs\/promises$/ }, () => ({
                        path: 'empty-fsp',
                        namespace: 'shim',
                    }));
                    build.onResolve({ filter: /^(node:)?path$/ }, () => ({
                        path: 'empty-path',
                        namespace: 'shim',
                    }));
                    build.onLoad({ filter: /empty-fs/, namespace: 'shim' }, () => empty);
                    build.onLoad({ filter: /empty-fsp/, namespace: 'shim' }, () => emptyPromises);
                    build.onLoad({ filter: /empty-path/, namespace: 'shim' }, () => emptyPath);
                },
            },
        ],
        logLevel: 'silent',
    });
}

async function runWorkerd(workDir, workerPort) {
    const config = `
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    ( name = "assetNet", network = ( allow = ["public", "local"] ) ),
    ( name = "http", worker = (
      modules = [
        ( name = "worker.js", esModule = embed "worker.js" ),
      ],
      compatibilityDate = "2024-01-01",
      globalOutbound = "assetNet",
    )),
  ],
  sockets = [
    ( name = "http", address = "*:${workerPort}", http = (), service = "http" ),
  ],
);
`;
    writeFileSync(join(workDir, 'config.capnp'), config.trim());

    let stderr = '';
    let proc;
    try {
        proc = spawn(workerdBin, ['serve', join(workDir, 'config.capnp'), 'config'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: workDir,
        });
        proc.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        const deadline = Date.now() + 180_000;
        while (Date.now() < deadline) {
            try {
                const res = await fetch(`http://127.0.0.1:${workerPort}/`);
                if (res.ok) {
                    const body = await res.json();
                    return body;
                }
                if (res.status === 500) {
                    const errBody = await res.json().catch(() => ({}));
                    const msg = errBody.error ?? res.status;
                    if (!String(msg).includes('internal error')) {
                        console.error(
                            'workerd worker error:',
                            JSON.stringify(errBody).slice(0, 2000),
                        );
                        throw new Error(`workerd worker failed: ${msg}`);
                    }
                }
            } catch (err) {
                if (err instanceof Error && err.message.startsWith('workerd worker failed')) {
                    throw err;
                }
                await new Promise((r) => setTimeout(r, 250));
            }
        }
        if (stderr) console.error('workerd stderr:', stderr.slice(-4000));
        throw new Error('workerd HTTP timed out');
    } finally {
        proc?.kill('SIGTERM');
    }
}

async function main() {
    if (!existsSync(workerdBin)) {
        throw new Error('workerd binary missing — run pnpm install');
    }
    if (!existsSync(join(root, 'packages/core/dist/index.js'))) {
        throw new Error('packages/core not built — run pnpm build first');
    }

    console.log('PR5 edge gate: computing Node reference…');
    const ref = await nodeReference();
    console.log('Node reference:', JSON.stringify(ref));

    const { manifest, chunkDir } = await buildDeepChunkManifest();
    const workDir = mkdtempSync(join(tmpdir(), 'njh-edge-'));
    mkdirSync(join(workDir, 'chunks'), { recursive: true });
    copyFileSync(join(root, 'packages/ephe/de440s.bsp'), join(workDir, 'de440s.bsp'));
    writeFileSync(join(workDir, 'chunks/manifest.json'), JSON.stringify(manifest));
    for (const entry of manifest) {
        copyFileSync(join(chunkDir, entry.file), join(workDir, 'chunks', entry.file));
    }

    const [assetPort, workerPort] = await reservePorts(2);
    const assetOrigin = `http://127.0.0.1:${assetPort}`;
    const assetServer = startAssetServer(workDir, assetPort);
    const workerOut = join(workDir, 'worker.js');
    await bundleWorker(workerOut, assetOrigin);

    console.log(
        `PR5 edge gate: starting workerd (${manifest.length} window NJCE files, no century BSP)…`,
    );
    let workerBody;
    try {
        workerBody = await runWorkerd(workDir, workerPort);
    } finally {
        assetServer.close();
    }

    console.log('Workerd result:', JSON.stringify(workerBody));

    if (workerBody.benchSunHex !== ref.benchSunHex) {
        throw new Error(
            `bench Sun hex mismatch worker=${workerBody.benchSunHex} node=${ref.benchSunHex}`,
        );
    }
    if (workerBody.deepSunHex !== ref.deepSunHex) {
        throw new Error(
            `deep (−9999) Sun hex mismatch worker=${workerBody.deepSunHex} node=${ref.deepSunHex}`,
        );
    }

    console.log('PR5 edge gate: PASS (workerd matches Node on bench chart and year −9999)');
    rmSync(workDir, { recursive: true, force: true });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
