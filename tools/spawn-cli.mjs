/**
 * Cross-platform spawn helpers for pnpm / npm / npx (.cmd on Windows without shell).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} arg */
function quoteWindowsShellArg(arg) {
    if (!/[\s"&|<>^]/.test(arg)) {
        return arg;
    }
    return `"${String(arg).replace(/"/g, '""')}"`;
}

/**
 * Resolve pnpm to `[executable, ...prefixArgs]` (never a bare `pnpm` on Windows).
 * @param {string} cwd
 * @returns {[string, string[]]}
 */
function resolvePnpmInvocation(cwd) {
    const execpath = process.env.npm_execpath;
    if (execpath && /\.(cjs|js|mjs)$/i.test(execpath)) {
        return [process.execPath, [execpath]];
    }
    const localCjs = join(cwd, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');
    if (existsSync(localCjs)) {
        return [process.execPath, [localCjs]];
    }
    if (process.platform === 'win32') {
        return ['pnpm.cmd', []];
    }
    return ['pnpm', []];
}

/**
 * @param {'pnpm' | 'npm' | 'npx'} cmd
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding} [options]
 */
export function spawnCliSync(cmd, args, options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const env = { ...process.env, ...options.env };

    if (cmd === 'pnpm') {
        const [file, prefix] = resolvePnpmInvocation(cwd);
        if (file === 'pnpm.cmd') {
            const command = ['pnpm', ...args.map(quoteWindowsShellArg)].join(' ');
            return spawnSync(command, {
                ...options,
                cwd,
                env,
                shell: true,
                windowsHide: true,
            });
        }
        return spawnSync(file, [...prefix, ...args], {
            ...options,
            cwd,
            env,
            windowsHide: true,
        });
    }

    if (process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx')) {
        const command = [cmd, ...args.map(quoteWindowsShellArg)].join(' ');
        return spawnSync(command, {
            ...options,
            cwd,
            env,
            shell: true,
            windowsHide: true,
        });
    }

    return spawnSync(cmd, args, { ...options, cwd, env, windowsHide: true });
}

/**
 * @param {'pnpm' | 'npm' | 'npx'} cmd
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileSyncOptionsWithStringEncoding} [options]
 */
export function execCliSync(cmd, args, options = {}) {
    const result = spawnCliSync(cmd, args, { ...options, encoding: 'utf8' });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        const err = result.stderr || result.stdout || `${cmd} exited ${result.status}`;
        throw new Error(typeof err === 'string' ? err : err.toString());
    }
    return result.stdout ?? '';
}

/**
 * @param {import('node:child_process').SpawnSyncReturns<string | Buffer>} result
 * @param {string} label
 */
export function assertSpawnOk(result, label) {
    if (result.error) {
        throw new Error(`${label}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        const detail =
            result.stderr?.toString() ||
            result.stdout?.toString() ||
            `${label} exited ${result.status}`;
        throw new Error(detail);
    }
}
