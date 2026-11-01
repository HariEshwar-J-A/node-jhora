#!/usr/bin/env node
/**
 * Fail when any production (non-dev) dependency in workspace libraries carries
 * an AGPL or GPL SPDX identifier. Swiss Ephemeris and similar copyleft stacks
 * must never enter the runtime graph.
 *
 *   node tools/check-runtime-licenses.mjs [repoRoot]
 *
 * Allowlist: tools/runtime-license-allowlist.json (packages.name@version → reason).
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { execCliSync } from './spawn-cli.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @typedef {{ name: string, version: string, path: string, license: string }} RuntimePackage */

/**
 * Returns true when the SPDX expression (or legacy string) is AGPL or GPL.
 * Compound expressions (OR/AND) fail if any branch is copyleft.
 *
 * @param {string | string[] | undefined} license
 */
export function isForbiddenCopyleftLicense(license) {
    if (license == null) {
        return false;
    }
    const parts = Array.isArray(license) ? license : [license];
    for (const raw of parts) {
        const text = String(raw).trim();
        if (!text || text === 'UNLICENSED') {
            continue;
        }
        const branches = text.split(/\s+(?:OR|AND)\s+/i);
        for (const branch of branches) {
            const token = branch.replace(/[()]/g, '').trim().toUpperCase();
            if (token.startsWith('AGPL')) {
                return true;
            }
            if (token === 'GPL' || token.startsWith('GPL-')) {
                return true;
            }
        }
    }
    return false;
}

/**
 * @param {unknown} node
 * @param {Map<string, RuntimePackage>} out
 */
function walkPnpmTree(node, out) {
    if (!node || typeof node !== 'object') {
        return;
    }
    if (
        typeof node.name === 'string' &&
        typeof node.version === 'string' &&
        typeof node.path === 'string'
    ) {
        const key = `${node.name}@${node.version}`;
        if (!out.has(key)) {
            out.set(key, {
                name: node.name,
                version: node.version,
                path: node.path,
                license: '',
            });
        }
    }
    const deps = node.dependencies;
    if (deps && typeof deps === 'object') {
        for (const child of Object.values(deps)) {
            walkPnpmTree(child, out);
        }
    }
}

/**
 * @param {string} repoRoot
 * @returns {Map<string, RuntimePackage>}
 */
export function collectProductionPackages(repoRoot) {
    const json = execCliSync('pnpm', ['list', '-r', '--prod', '--depth=Infinity', '--json'], {
        cwd: repoRoot,
        maxBuffer: 64 * 1024 * 1024,
    });
    const trees = JSON.parse(json);
    const packages = new Map();
    for (const tree of trees) {
        if (tree.private && !tree.dependencies) {
            continue;
        }
        walkPnpmTree(tree, packages);
        if (tree.dependencies) {
            for (const child of Object.values(tree.dependencies)) {
                walkPnpmTree(child, packages);
            }
        }
    }
    for (const pkg of packages.values()) {
        if (pkg.name.startsWith('@node-jhora/')) {
            packages.delete(`${pkg.name}@${pkg.version}`);
            continue;
        }
        try {
            const manifest = JSON.parse(readFileSync(join(pkg.path, 'package.json'), 'utf8'));
            const license = manifest.license;
            pkg.license = Array.isArray(license)
                ? license.join(' OR ')
                : String(license ?? 'UNKNOWN');
        } catch {
            pkg.license = 'UNKNOWN';
        }
    }
    return packages;
}

/**
 * @param {string} repoRoot
 */
export function loadAllowlist(repoRoot) {
    const path = join(repoRoot, 'tools/runtime-license-allowlist.json');
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return data.packages && typeof data.packages === 'object' ? data.packages : {};
}

/**
 * @param {string} repoRoot
 * @returns {{ violations: RuntimePackage[], allowed: RuntimePackage[] }}
 */
export function scanRuntimeLicenses(repoRoot) {
    const allowlist = loadAllowlist(repoRoot);
    const packages = collectProductionPackages(repoRoot);
    const violations = [];
    const allowed = [];
    for (const pkg of packages.values()) {
        if (!isForbiddenCopyleftLicense(pkg.license)) {
            continue;
        }
        const key = `${pkg.name}@${pkg.version}`;
        if (allowlist[key]) {
            allowed.push(pkg);
            continue;
        }
        violations.push(pkg);
    }
    violations.sort((a, b) => a.name.localeCompare(b.name));
    return { violations, allowed };
}

/**
 * @param {string} [repoRoot]
 * @returns {number} exit code
 */
export function main(repoRoot = resolve(__dirname, '..')) {
    const { violations } = scanRuntimeLicenses(repoRoot);
    if (violations.length === 0) {
        console.log('check-runtime-licenses: no forbidden AGPL/GPL runtime dependencies.');
        return 0;
    }
    console.error('check-runtime-licenses: forbidden copyleft runtime dependencies:');
    for (const v of violations) {
        console.error(`  - ${v.name}@${v.version} (${v.license})`);
    }
    console.error(
        'Add an explicit allowlist entry in tools/runtime-license-allowlist.json only with security review.',
    );
    return 1;
}

function isMain() {
    const entry = process.argv[1];
    if (!entry) return false;
    return import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
    const root = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '..');
    process.exit(main(root));
}
