/**
 * Bundled subpaths must match Node after tree-shaking (sideEffects contract).
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

import type { Plugin } from 'esbuild';

import { evalCheby } from '../../src/engine/chebyshev.js';
import { calculateVarga, type VargaPoint } from '../../src/vedic/vargas.js';
import { bundleCoreEntry } from '../helpers/bundle-core-entry.mjs';

const CORE_SRC = fileURLToPath(new URL('../../src', import.meta.url));

const VARGA_DIVISIONS = [
    1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 150,
] as const;

function float64Hex(n: number): string {
    const buf = Buffer.allocUnsafe(8);
    buf.writeDoubleLE(n, 0);
    return buf.toString('hex');
}

function vargaHex(v: VargaPoint): string {
    const base = `${v.sign}:${float64Hex(v.longitude)}:${float64Hex(v.degree)}`;
    return v.deity ? `${base}:${v.deity}` : base;
}

/** ≥50 longitudes with sign-boundary coverage (0°, 30°, … and ±ε). */
function vargaLongitudeCorpus(): number[] {
    const out: number[] = [];
    for (let sign = 0; sign < 12; sign++) {
        const base = sign * 30;
        out.push(base, base + 0.001, base + 14.999, base + 29.999);
    }
    out.push(359.999, 0.0001, 119.5, 240.333333);
    return out;
}

function digestVargaCorpus(calc: (lon: number, d: number) => VargaPoint): string {
    const h = createHash('sha256');
    for (const lon of vargaLongitudeCorpus()) {
        for (const d of VARGA_DIVISIONS) {
            h.update(vargaHex(calc(lon, d)));
            h.update(';');
        }
    }
    return h.digest('hex');
}

function digestChebyshevCorpus(evalFn: (coeffs: number[], s: number) => number): string {
    const h = createHash('sha256');
    for (let i = 0; i < 64; i++) {
        const coeffs = [1, i * 0.01, -0.5, 0.25, 0.125].slice(0, 3 + (i % 3));
        const s = -0.9 + (i / 63) * 1.8;
        h.update(float64Hex(evalFn(coeffs, s)));
        h.update(';');
    }
    return h.digest('hex');
}

async function runBundledDigest(
    js: Uint8Array,
    runnerSource: string,
    cwd: string,
): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'njh-bundle-'));
    const bundlePath = join(dir, 'bundle.mjs');
    const runnerPath = join(dir, 'run.mjs');
    await writeFile(bundlePath, js);
    await writeFile(runnerPath, runnerSource.replace('__BUNDLE__', './bundle.mjs'));
    const { stdout } = await execFileAsync(process.execPath, [runnerPath], {
        cwd,
        env: process.env,
    });
    return stdout.trim();
}

const VARGA_RUNNER = `
import { createHash } from 'node:crypto';
import { calculateVarga } from '__BUNDLE__';
const DIVISIONS = [${VARGA_DIVISIONS.join(',')}];
function float64Hex(n){const b=Buffer.allocUnsafe(8);b.writeDoubleLE(n,0);return b.toString('hex');}
function vargaHex(v){const b=\`\${v.sign}:\${float64Hex(v.longitude)}:\${float64Hex(v.degree)}\`;return v.deity?\`\${b}:\${v.deity}\`:b;}
function longitudes(){const out=[];for(let s=0;s<12;s++){const base=s*30;out.push(base,base+0.001,base+14.999,base+29.999);}out.push(359.999,0.0001,119.5,240.333333);return out;}
const h=createHash('sha256');
for(const lon of longitudes())for(const d of DIVISIONS){h.update(vargaHex(calculateVarga(lon,d)));h.update(';');}
process.stdout.write(h.digest('hex'));
`;

const CHEBY_RUNNER = `
import { createHash } from 'node:crypto';
import { evalCheby } from '__BUNDLE__';
function float64Hex(n){const b=Buffer.allocUnsafe(8);b.writeDoubleLE(n,0);return b.toString('hex');}
const h=createHash('sha256');
for(let i=0;i<64;i++){const coeffs=[1,i*0.01,-0.5,0.25,0.125].slice(0,3+(i%3));const s=-0.9+(i/63)*1.8;h.update(float64Hex(evalCheby(coeffs,s)));h.update(';');}
process.stdout.write(h.digest('hex'));
`;

/** Simulates a bundler dropping the entire precise module (parity must fail). */
const dropPreciseModulePlugin: Plugin = {
    name: 'drop-precise-module',
    setup(b) {
        b.onLoad({ filter: /[/\\]core[/\\]precise\.(ts|js)$/ }, () => ({
            contents: `throw new Error('precise.ts dropped by tree-shaking');`,
            loader: 'js',
        }));
    },
};

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

describe('bundled entry tree-shake parity', () => {
    const nodeVargaDigest = digestVargaCorpus(calculateVarga);
    const nodeChebyDigest = digestChebyshevCorpus(evalCheby);

    test('vargas subpath bundle matches Node on varga corpus', async () => {
        const { js } = await bundleCoreEntry({
            entry: join(CORE_SRC, 'vedic/vargas.ts'),
            external: [],
        });
        const digest = await runBundledDigest(js, VARGA_RUNNER, REPO_ROOT);
        expect(digest).toBe(nodeVargaDigest);
    });

    test('chebyshev subpath bundle matches Node on chebyshev corpus', async () => {
        const { js } = await bundleCoreEntry({
            entry: join(CORE_SRC, 'engine/chebyshev.ts'),
            external: [],
        });
        const digest = await runBundledDigest(js, CHEBY_RUNNER, REPO_ROOT);
        expect(digest).toBe(nodeChebyDigest);
    });

    test('browser entry bundle vargas matches Node on varga corpus', async () => {
        const { js } = await bundleCoreEntry({
            entry: join(CORE_SRC, 'browser/index.ts'),
            external: [],
        });
        const digest = await runBundledDigest(js, VARGA_RUNNER, REPO_ROOT);
        expect(digest).toBe(nodeVargaDigest);
    });

    test('bundled vargas retains configured Decimal (clone / 34-digit) in output', async () => {
        const { js } = await bundleCoreEntry({
            entry: join(CORE_SRC, 'vedic/vargas.ts'),
            external: ['decimal.js'],
        });
        const text = Buffer.from(js).toString('utf8');
        expect(text).toMatch(/clone\(|precision:\s*34|34.*precision/);
    });

    test('dropping precise.ts makes bundled vargas fail (guard sanity)', async () => {
        const { js } = await bundleCoreEntry({
            entry: join(CORE_SRC, 'vedic/vargas.ts'),
            external: [],
            extraPlugins: [dropPreciseModulePlugin],
        });
        await expect(runBundledDigest(js, VARGA_RUNNER, REPO_ROOT)).rejects.toThrow();
    });
});
