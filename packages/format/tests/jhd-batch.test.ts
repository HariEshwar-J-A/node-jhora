import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { importJhdFolder } from '../src/node/jhd-batch.js';

const GOOD = ['8', '8', '1912', '19.3800', '-5.30', '-77.35', '12.59'].join('\n');
const BAD = ['8', 'x', '1912', '19.3800', '-5.30', '-77.35', '12.59'].join('\n');

describe('importJhdFolder', () => {
    test('recovers per-file errors with line numbers', () => {
        const dir = mkdtempSync(join(tmpdir(), 'jhd-batch-'));
        writeFileSync(join(dir, 'ok.jhd'), GOOD);
        writeFileSync(join(dir, 'bad.jhd'), BAD);

        const results = importJhdFolder(dir);
        expect(results).toHaveLength(2);
        const bad = results.find((r) => r.path.endsWith('bad.jhd'));
        const ok = results.find((r) => r.path.endsWith('ok.jhd'));
        expect(ok?.ok).toBe(true);
        expect(bad?.ok).toBe(false);
        if (bad && !bad.ok) {
            expect(bad.errors[0]?.line).toBe(2);
        }
    });
});
