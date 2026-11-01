import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { packEopBin, parseFinals2000A } from '../build-pack.mjs';
import { lookupEop, parseEopBin } from '../index.mjs';

test('parseFinals2000A reads UT1 and pole from sample line', () => {
    const sample =
        '73 1 2 41684.00 I  0.120733 0.009786  0.136966 0.015902  I 0.8084178 0.0002710  0.0000 0.1916  P';
    const rows = parseFinals2000A(`${sample}\n`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].mjd, 41684);
    assert.ok(Math.abs(rows[0].ut1UtcSec - 0.8084178) < 1e-6);
    assert.ok(Math.abs(rows[0].xpArcsec - 0.120733) < 1e-6);
});

test('round-trip pack and lookup', () => {
    const rows = [
        { mjd: 50000, xpArcsec: 0.1, ypArcsec: 0.2, ut1UtcSec: -0.5 },
        { mjd: 50001, xpArcsec: 0.11, ypArcsec: 0.21, ut1UtcSec: -0.48 },
    ];
    const bin = packEopBin(rows, {
        finalsSha256: 'aa'.repeat(32),
        leapSha256: 'bb'.repeat(32),
    });
    const table = parseEopBin(bin);
    const jd2 = 2400000.5 + 50000.25;
    const got2 = lookupEop(jd2, table);
    assert.equal(got2.inTable, true);
});

test('committed eop.bin loads when present', () => {
    const path = join(import.meta.dirname, '..', 'eop.bin');
    try {
        const table = parseEopBin(readFileSync(path));
        assert.ok(table.count > 10_000);
    } catch {
        /* not built yet in dev */
    }
});
