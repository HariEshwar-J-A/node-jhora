// List tracked TypeScript sources under packages/*/src (excludes .d.ts).
// Uses argv git ls-files so Windows cmd.exe never parses shell quotes.
import { execFileSync } from 'node:child_process';

/** @param {string} root Repository root */
export function listPackageSrcTsFiles(root) {
    return execFileSync('git', ['ls-files', 'packages/*/src/**/*.ts', ':!:**/*.d.ts'], {
        cwd: root,
        encoding: 'utf8',
    })
        .trim()
        .split('\n')
        .filter(Boolean);
}
