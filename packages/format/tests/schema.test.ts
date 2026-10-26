import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CalculationSettingsSchema } from '@node-jhora/core';

import { formatNjhJsonSchema, NjhChartV2Schema, parseNjh } from '../src/index.js';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../schema/njh-chart.schema.json');
const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/sample-v2.json');

describe('NjhChartV2Schema', () => {
    it('accepts the sample fixture and inline settings overrides', () => {
        const chart = parseNjh(readFileSync(fixturePath, 'utf8'));
        expect(NjhChartV2Schema.parse(chart).id).toBe(chart.id);

        const inline = {
            ...chart,
            settingsOverride: {
                kind: 'inline',
                settings: CalculationSettingsSchema.parse({
                    ayanamsa: 'true_citra',
                    ayanamsaOffsetDeg: 0,
                    nodeType: 'true',
                    houseSystem: 'whole_sign',
                    cuspsInMiddle: false,
                    positionMode: 'geometric',
                    topocentric: false,
                    altitudeMetres: 0,
                    sunrise: { limb: 'disc_centre', refraction: false, nominalHour: 6 },
                    dasaYear: { kind: 'mean_tropical', days: 365.24219 },
                    dasamsaScheme: 'jhora_5_8',
                    horaScheme: 'parashara',
                    vargaVariants: {},
                }),
            },
        };
        expect(parseNjh(inline).settingsOverride?.kind).toBe('inline');
    });

    it('rejects unknown preset ids and malformed UUIDs', () => {
        const chart = parseNjh(readFileSync(fixturePath, 'utf8'));
        expect(
            NjhChartV2Schema.safeParse({
                ...chart,
                settingsOverride: { kind: 'preset', presetId: 'not-a-preset' },
            }).success,
        ).toBe(false);
        expect(NjhChartV2Schema.safeParse({ ...chart, id: 'not-uuid' }).success).toBe(false);
    });
});

describe('JSON Schema', () => {
    it('is generated from Zod and drift-checked', () => {
        const text = formatNjhJsonSchema();
        if (process.env.WRITE_GOLDENS === '1') {
            mkdirSync(dirname(schemaPath), { recursive: true });
            writeFileSync(schemaPath, text);
        }
        expect(readFileSync(schemaPath, 'utf8')).toBe(text);
        const json = JSON.parse(text) as {
            title: string;
            properties: { schemaVersion: { const: number } };
        };
        expect(json.title).toBe('NjhChartV2');
        expect(json.properties.schemaVersion.const).toBe(2);
    });
});
