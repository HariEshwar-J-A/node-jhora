import { writeFileSync } from 'node:fs';
import { readUtf8Lf } from '../../../tools/read-utf8-lf.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as horizons from '../../core/tests/fixtures/horizons_golden.js';
import * as jhora from '../../core/tests/fixtures/jhora_golden.js';
import {
    HORIZONS_PRESET_ID,
    JHORA_CASE_ID,
    JHORA_PRESET_ID,
    JHORA_TIMEZONE,
    LEGACY_ALTITUDE_M,
    formatGoldenJson,
    formatGoldenJsonl,
    fromHorizonsGoldenCases,
    fromJhoraGoldenCase,
    parseGoldenCorpus,
    toHorizonsGoldenCases,
    toJhoraGoldenCase,
    type HorizonsFixture,
    type JhoraFixture,
} from '../src/index.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../../core/tests/fixtures');

function expectFile(path: string, text: string): void {
    if (process.env.WRITE_GOLDENS === '1') writeFileSync(path, text);
    expect(readUtf8Lf(path)).toBe(text);
}

function dataKeys(mod: Record<string, unknown>): string[] {
    return Object.keys(mod)
        .filter((key) => typeof mod[key] !== 'function')
        .sort();
}

function jhoraFixture(): JhoraFixture {
    return {
        birth: jhora.JHORA_BIRTH,
        conventions: jhora.JHORA_CONVENTIONS,
        ayanamsa: jhora.JHORA_AYANAMSA,
        d1: jhora.JHORA_D1,
        ascendant: jhora.JHORA_ASCENDANT,
        siderealTime: jhora.JHORA_SIDEREAL_TIME,
        d9: jhora.JHORA_D9,
        d9Ascendant: jhora.JHORA_D9_ASCENDANT,
        panchanga: jhora.JHORA_PANCHANGA,
        dasha: jhora.JHORA_DASHA,
        d10Scheme: jhora.JHORA_D10_SCHEME,
        d10Label: jhora.JHORA_D10_LABEL,
        d10: jhora.JHORA_D10,
        d10Ascendant: jhora.JHORA_D10_ASCENDANT,
        d10EvenSignBodies: jhora.JHORA_D10_EVEN_SIGN_BODIES,
    };
}

function horizonsFixture(): HorizonsFixture {
    return {
        epochs: horizons.HORIZONS_EPOCHS,
        toleranceArcsec: horizons.TOLERANCE_ARCSEC,
        futureToleranceArcsec: horizons.FUTURE_TOLERANCE_ARCSEC,
        lastObservedDeltaTYear: horizons.LAST_OBSERVED_DELTAT_YEAR,
        provenance: horizons.HORIZONS_PROVENANCE,
    };
}

describe('legacy fixture conversion', () => {
    it('covers every data export of the legacy modules', () => {
        expect(dataKeys(jhora).sort()).toEqual(
            [
                'JHORA_ASCENDANT',
                'JHORA_AYANAMSA',
                'JHORA_BIRTH',
                'JHORA_CHARTS',
                'JHORA_CONVENTIONS',
                'JHORA_D1',
                'JHORA_D10',
                'JHORA_D10_ASCENDANT',
                'JHORA_D10_EVEN_SIGN_BODIES',
                'JHORA_D10_LABEL',
                'JHORA_D10_SCHEME',
                'JHORA_D9',
                'JHORA_D9_ASCENDANT',
                'JHORA_DASHA',
                'JHORA_PANCHANGA',
                'JHORA_REFERENCE_CHART_ID',
                'JHORA_SIDEREAL_TIME',
            ].sort(),
        );
        expect(dataKeys(horizons).sort()).toEqual([
            'FUTURE_TOLERANCE_ARCSEC',
            'HORIZONS_ENGINE_COMPARE_BODIES',
            'HORIZONS_EPOCHS',
            'HORIZONS_PROVENANCE',
            'LAST_OBSERVED_DELTAT_YEAR',
            'TOLERANCE_ARCSEC',
        ]);
    });

    it('round-trips the JHora fixture losslessly', () => {
        const source = jhoraFixture();
        const golden = toJhoraGoldenCase(source);
        expect(fromJhoraGoldenCase(golden)).toEqual(source);
        expect(toJhoraGoldenCase(fromJhoraGoldenCase(golden))).toEqual(golden);
        expect(golden.id).toBe(JHORA_CASE_ID);
        expect(golden.input.timezone).toBe(JHORA_TIMEZONE);
        expect(golden.input.instant).toBe('2000-01-01T12:00:00Z');
        expect(golden.input.alt).toBe(LEGACY_ALTITUDE_M);
        expect(golden.input.settingsPresetId).toBe(JHORA_PRESET_ID);
        expect(golden.expected['d1.planets.Sun.lon']).toEqual({
            value: jhora.JHORA_D1[0].longitude,
            tolerance: { type: 'arcsec', arcsec: jhora.JHORA_D1[0].toleranceArcsec },
        });
        expect(golden.expected['dasa.vimshottari[0].end']).toMatchObject({
            value: '2000-09-10',
            tolerance: { type: 'seconds', seconds: jhora.JHORA_DASHA.toleranceDays * 86400 },
        });

        const json = formatGoldenJson([golden]);
        expectFile(join(fixtureDir, 'jhora.golden.json'), json);
        expect(parseGoldenCorpus(json)).toEqual([golden]);
        expect(parseGoldenCorpus(formatGoldenJsonl([golden]))).toEqual([golden]);
    });

    it('round-trips the Horizons fixture losslessly', () => {
        const source = horizonsFixture();
        const cases = toHorizonsGoldenCases(source);
        expect(fromHorizonsGoldenCases(cases)).toEqual(source);
        expect(toHorizonsGoldenCases(fromHorizonsGoldenCases(cases))).toEqual(cases);
        expect(cases.map((item) => item.id)).toEqual(
            horizons.HORIZONS_EPOCHS.map((epoch) => {
                const date = /^(\d{4}-\d{2}-\d{2})/.exec(epoch.label);
                if (!date) throw new Error(`bad label ${epoch.label}`);
                return `horizons-${date[1]}`;
            }),
        );
        expect(cases.every((item) => item.input.timezone === 'UTC' && item.input.alt === 0)).toBe(
            true,
        );
        expect(cases.every((item) => item.input.settingsPresetId === HORIZONS_PRESET_ID)).toBe(
            true,
        );
        const future = cases.find((item) => item.id === 'horizons-2100-01-01');
        expect(future?.expected['horizons.planets.Moon.lon']).toMatchObject({
            tolerance: { type: 'arcsec', arcsec: horizons.FUTURE_TOLERANCE_ARCSEC.longitude },
        });

        const json = formatGoldenJson(cases);
        expectFile(join(fixtureDir, 'horizons.golden.json'), json);
        expect(parseGoldenCorpus(json)).toEqual(cases);
        expect(parseGoldenCorpus(formatGoldenJsonl(cases))).toEqual(cases);
    });
});
