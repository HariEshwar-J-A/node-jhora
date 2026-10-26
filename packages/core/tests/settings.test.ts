import {
    AYANAMSA,
    CalculationSettingsSchema,
    DEFAULT_CONFIG,
    JHORA_PRESET,
    LEGACY_DASHA_YEAR_DAYS,
    NodeJHora,
    PRESET_IDS,
    SETTINGS_HASH_HEX_LENGTH,
    canonicalJson,
    describeCalculation,
    expandCalculationBody,
    getPreset,
    hashSettings,
    resolveConfig,
} from '../src/index.js';
import { sha256Hex, sha256Utf8 } from '../src/settings/sha256.js';

function reverseKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).reverse();
        return Object.fromEntries(entries.map(([key, inner]) => [key, reverseKeys(inner)]));
    }
    return value;
}

describe('SHA-256', () => {
    test('empty string and abc match the FIPS vectors', () => {
        expect(sha256Hex(new Uint8Array())).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        );
        expect(sha256Utf8('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
    });

    test('the 56-byte FIPS vector pads into a second block', () => {
        expect(sha256Utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
            '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
        );
    });
});

describe('canonical JSON', () => {
    test('object key order does not change the text', () => {
        const left = { z: 1, a: { d: true, c: [1, { b: 2, a: 1 }] }, m: 'x' };
        const right = { a: { c: [1, { a: 1, b: 2 }], d: true }, m: 'x', z: 1 };
        expect(canonicalJson(left)).toBe(canonicalJson(right));
        expect(canonicalJson(left)).toBe('{"a":{"c":[1,{"a":1,"b":2}],"d":true},"m":"x","z":1}');
    });
});

describe('CalculationSettingsSchema', () => {
    test.each(PRESET_IDS)('%s validates', (id) => {
        const preset = getPreset(id);
        expect(CalculationSettingsSchema.parse(preset)).toEqual(preset);
        const hash = hashSettings(preset);
        expect(hash).toHaveLength(SETTINGS_HASH_HEX_LENGTH);
        expect(hash).toMatch(/^[0-9a-f]+$/);
        expect(hashSettings(reverseKeys(preset))).toBe(hash);
    });

    test('preset hashes differ', () => {
        const hashes = PRESET_IDS.map((id) => hashSettings(getPreset(id)));
        expect(new Set(hashes).size).toBe(PRESET_IDS.length);
    });

    test('rejects an unknown node type and an unknown field', () => {
        const preset = getPreset('node-jhora-default');
        expect(
            CalculationSettingsSchema.safeParse({ ...preset, nodeType: 'osculating' }).success,
        ).toBe(false);
        expect(CalculationSettingsSchema.safeParse({ ...preset, extra: true }).success).toBe(false);
        expect(
            CalculationSettingsSchema.safeParse({
                ...preset,
                dasaYear: { kind: 'mean_tropical', days: -1 },
            }).success,
        ).toBe(false);
    });
});

describe('presets', () => {
    const location = { latitude: 13.08, longitude: 80.27 };

    test('jhora-default@8.0 records the factory calculation defaults', () => {
        const settings = getPreset('jhora-default@8.0');
        expect(settings).toMatchObject({
            ayanamsa: 'true_citra',
            ayanamsaOffsetDeg: 0,
            nodeType: 'mean',
            houseSystem: 'equal',
            cuspsInMiddle: true,
            positionMode: 'geometric',
            topocentric: false,
            sunrise: { limb: 'disc_centre', refraction: false, nominalHour: 6 },
            dasaYear: { kind: 'mean_tropical', days: 365.24219 },
        });
        expect(settings.vargaVariants.d2).toBe('index:6');
        expect(settings.vargaVariants.d24).toBe('index:1');
        expect(settings.vargaVariants.d10).toBe('index:0');
        expect(settings.vargaVariants.d150).toBe('index:1');
    });

    test('node-jhora-default round-trips through the legacy config', () => {
        const resolved = describeCalculation('node-jhora-default');
        expect(resolved.config).toEqual(DEFAULT_CONFIG);
        expect(resolved.settingsHash).toBe(hashSettings(getPreset('node-jhora-default')));
    });

    test('kp, raman, and lahiri-mean select the named ayanamsa', () => {
        expect(describeCalculation('kp').config).toMatchObject({
            ayanamsaMode: AYANAMSA.KRISHNAMURTI,
            houseSystem: 'Placidus',
            nodeType: 'true',
        });
        expect(describeCalculation('raman').config.ayanamsaMode).toBe(AYANAMSA.RAMAN);
        expect(describeCalculation('lahiri-mean').config).toMatchObject({
            ayanamsaMode: AYANAMSA.LAHIRI,
            nodeType: 'mean',
        });
    });

    test('legacy options and JHORA_PRESET still resolve to the same config', () => {
        expect(describeCalculation(JHORA_PRESET).config).toEqual(resolveConfig(JHORA_PRESET));
        expect(describeCalculation({ ayanamsaOrder: 3, nodeType: 'mean' }).config).toMatchObject({
            ayanamsaMode: AYANAMSA.RAMAN,
            nodeType: 'mean',
            houseSystem: DEFAULT_CONFIG.houseSystem,
        });
        expect(describeCalculation({ ayanamsaMode: 99 }).config.ayanamsaMode).toBe(99);
        expect(describeCalculation({ ayanamsaMode: 99 }).settings.customAyanamsaMode).toBe(99);
    });

    test('NodeJHora accepts a preset id or the existing config object', () => {
        expect(new NodeJHora(location).config).toEqual(DEFAULT_CONFIG);
        expect(new NodeJHora(location).settingsHash).toHaveLength(SETTINGS_HASH_HEX_LENGTH);
        expect(new NodeJHora(location, JHORA_PRESET).config).toEqual(resolveConfig(JHORA_PRESET));
        expect(new NodeJHora(location, 'lahiri-mean').settings.nodeType).toBe('mean');
        expect(new NodeJHora(location, 'kp').config.houseSystem).toBe('Placidus');
        const over = new NodeJHora(location, 'kp');
        expect(describeCalculation({ nodeType: 'mean' }, over.settings).config.nodeType).toBe(
            'mean',
        );
        expect(describeCalculation({ nodeType: 'mean' }, over.settings).config.ayanamsaMode).toBe(
            AYANAMSA.KRISHNAMURTI,
        );
    });
});

describe('expandCalculationBody', () => {
    test('leaves a body that did not opt in untouched', () => {
        const body = { date: '2000-01-01', ayanamsa: 'lahiri', nodeType: 'mean' };
        expect(expandCalculationBody(body)).toBe(body);
    });

    test('a preset fills omitted fields and explicit fields win', () => {
        const expanded = expandCalculationBody({ preset: 'kp', ayanamsa: 'lahiri' });
        expect(expanded.ayanamsa).toBe('lahiri');
        expect(expanded.houseSystem).toBe('placidus');
        expect(expanded.applyDasaYear).toBe(true);
        expect(expanded.dasaYearDays).toBe(getPreset('kp').dasaYear.days);
        expect(expanded.settings).toBeUndefined();
    });

    test('dasaYearDays alone opts into that year length', () => {
        const expanded = expandCalculationBody({ dasaYearDays: 360 });
        expect(expanded.applyDasaYear).toBe(true);
        expect(expanded.dasaYearDays).toBe(360);
        expect(expanded.dasaYearKind).toBe('savana');
    });

    test('an unknown preset id is left for the request schema to reject', () => {
        const body = { preset: 'not-a-preset' };
        expect(expandCalculationBody(body)).toBe(body);
    });

    test('the legacy dasha year constant stays the historical sidereal length', () => {
        expect(LEGACY_DASHA_YEAR_DAYS).toBe(365.256364);
    });
});
