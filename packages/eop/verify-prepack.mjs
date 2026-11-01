/**
 * Verify committed eop.bin SHA-256 against pins.json (no network).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = join(__dirname, 'eop.bin');
const pins = JSON.parse(readFileSync(join(__dirname, 'pins.json'), 'utf8'));
const expected = pins.eopBinSha256;

if (!expected || String(expected).startsWith('0000')) {
    console.error('pins.json missing eopBinSha256');
    process.exit(1);
}
if (!existsSync(binPath)) {
    console.error(`Missing committed ${binPath} — run fetch + pack-data locally`);
    process.exit(1);
}
const got = createHash('sha256').update(readFileSync(binPath)).digest('hex');
if (got !== expected) {
    console.error(`eop.bin SHA-256 mismatch: got ${got}, expected ${expected}`);
    process.exit(1);
}
console.log(`eop.bin OK (${got.slice(0, 12)}…)`);
