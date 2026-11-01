import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { jest } from '@jest/globals';

import { csvWizardImport } from '../src/index.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const probe = join(packageRoot, 'tests/helpers/csv-fold-probe.mjs');

const header = 'name,date,time,timezone,latitude,longitude';
const foldCsv = `${header}
Fold,2021-11-07,01:30:00,America/New_York,40.7,-74
`;

const FOLD_UTC = '2021-11-07T05:30:00Z';

function runProbe(env: NodeJS.ProcessEnv): { resolvedUtc: string; warnings: number } {
    const out = execFileSync(process.execPath, [probe], {
        cwd: packageRoot,
        env: { ...process.env, ...env, NODE_OPTIONS: '--experimental-vm-modules' },
        encoding: 'utf8',
    }).trim();
    return JSON.parse(out) as { resolvedUtc: string; warnings: number };
}

describe('CSV import: DST fold resolution is host-independent', () => {
    const hostZones = ['UTC', 'America/Toronto', 'America/New_York', 'Asia/Kolkata'] as const;

    it.each(hostZones)('TZ=%s resolves repeated 01:30 to the earlier instant', (tz) => {
        const result = runProbe({ TZ: tz });
        expect(result.resolvedUtc).toBe(FOLD_UTC);
        expect(result.warnings).toBe(0);
    });

    it('in-process fold with fake system time on a fall-back date', () => {
        jest.useFakeTimers({ now: new Date('2026-11-01T06:30:00.000Z') });
        try {
            const { importResult } = csvWizardImport(foldCsv);
            expect(importResult.warnings).toEqual([]);
            expect(importResult.charts[0]!.birth.tzResolution.resolvedUtc).toBe(FOLD_UTC);
        } finally {
            jest.useRealTimers();
        }
    });

    it('in-process fold on an ordinary civil date', () => {
        jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });
        try {
            const { importResult } = csvWizardImport(foldCsv);
            expect(importResult.charts[0]!.birth.tzResolution.resolvedUtc).toBe(FOLD_UTC);
        } finally {
            jest.useRealTimers();
        }
    });
});
